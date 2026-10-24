import { createClient } from "@libsql/client";
import { gte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { resolveDatabaseConfig } from "../client";
import { applyMigrations } from "../migrate";
import { Guestbook, GuestbookModerationLog } from "../schema";

const MIGRATIONS = new URL("../../../../db/migrations/", import.meta.url);
const temporaryDatabases: string[] = [];

function temporaryClient() {
	const databasePath = join(tmpdir(), `guestbook-${crypto.randomUUID()}.db`);
	temporaryDatabases.push(databasePath);
	return createClient({ url: `file:${databasePath}` });
}

afterEach(async () => {
	await Promise.all(temporaryDatabases.splice(0).map((path) => rm(path, { force: true, recursive: true })));
});

describe("database configuration", () => {
	it("uses local SQLite only outside production when no remote credentials exist", () => {
		expect(resolveDatabaseConfig({ production: false })).toEqual({
			url: "file:.astro/content.db",
			authToken: undefined,
		});
	});

	it("requires both remote credentials in production", () => {
		expect(() => resolveDatabaseConfig({ production: true })).toThrow(
			"ASTRO_DB_REMOTE_URL and ASTRO_DB_APP_TOKEN are required together in production"
		);
	});

	it("rejects partially configured remote credentials", () => {
		expect(() => resolveDatabaseConfig({ production: false, url: "libsql://guestbook.example" })).toThrow(
			"ASTRO_DB_REMOTE_URL and ASTRO_DB_APP_TOKEN must be configured together"
		);
	});
});

describe("guestbook migrations", () => {
	it("applies each migration once and records it", async () => {
		const client = temporaryClient();
		const first = await applyMigrations(client, MIGRATIONS);
		const second = await applyMigrations(client, MIGRATIONS);

		expect(first[0]).toBe("0000_guestbook_baseline.sql");
		expect(second).toEqual([]);
		const recorded = await client.execute(`SELECT "name" FROM "_migrations" ORDER BY "name"`);
		expect(recorded.rows.map((row) => row.name)).toEqual(first);
		client.close();
	});

	it("applies each migration once when two runs race", async () => {
		const client = temporaryClient();
		const [first, second] = await Promise.all([
			applyMigrations(client, MIGRATIONS),
			applyMigrations(client, MIGRATIONS),
		]);

		expect([...first, ...second].sort()).toEqual(
			(await client.execute(`SELECT "name" FROM "_migrations" ORDER BY "name"`)).rows.map((row) => row.name)
		);
		client.close();
	});

	it("brings a database created by the baseline alone up to date", async () => {
		// Production predates the tracking table: the baseline was applied directly.
		const client = temporaryClient();
		const baseline = await readFile(new URL("0000_guestbook_baseline.sql", MIGRATIONS), "utf8");
		await client.executeMultiple(baseline);

		await expect(applyMigrations(client, MIGRATIONS)).resolves.toEqual(
			expect.arrayContaining(["0000_guestbook_baseline.sql", "0001_guestbook_copy_theme.sql"])
		);
		const columns = await client.execute(`SELECT "name" FROM pragma_table_info('Guestbook')`);
		expect(columns.rows.map((row) => row.name)).toContain("copyTheme");
		client.close();
	});

	it("rewrites valid legacy CURRENT_TIMESTAMP values to ISO and leaves other values alone", async () => {
		const client = temporaryClient();
		const migrations = await mkdtemp(join(tmpdir(), "migrations-"));
		temporaryDatabases.push(migrations);
		// Stop before 0002 so the legacy rows exist when it runs.
		for (const name of ["0000_guestbook_baseline.sql", "0001_guestbook_copy_theme.sql"]) {
			await writeFile(join(migrations, name), await readFile(new URL(name, MIGRATIONS), "utf8"));
		}
		await applyMigrations(client, pathToFileURL(`${migrations}/`));
		await client.execute(`INSERT INTO "Guestbook" ("name", "message") VALUES ('Legacy', 'SQL default')`);
		await client.execute({
			sql: `INSERT INTO "Guestbook" ("name", "message", "timestamp", "moderatedAt", "adminNotifiedAt", "copySentAt")
				VALUES ('Mixed', 'x', ?, ?, ?, ?)`,
			args: ["2025-06-26 16:42:01", "2026-03-01T10:15:00.000Z", "not a date", "2025-13-45 99:99:99"],
		});
		await client.execute(
			`INSERT INTO "GuestbookModerationLog" ("entryId", "action", "toStatus", "actor", "at")
			VALUES (2, 'approve', 'visible', 'admin', '2025-06-27 08:00:00')`
		);

		await expect(applyMigrations(client, MIGRATIONS)).resolves.toEqual(["0002_normalize_legacy_timestamps.sql"]);

		const rows = await client.execute(
			`SELECT "timestamp", "moderatedAt", "adminNotifiedAt", "copySentAt" FROM "Guestbook" ORDER BY "id"`
		);
		expect(rows.rows[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.000Z$/);
		expect({ ...rows.rows[1] }).toEqual({
			timestamp: "2025-06-26T16:42:01.000Z",
			moderatedAt: "2026-03-01T10:15:00.000Z",
			adminNotifiedAt: "not a date",
			copySentAt: "2025-13-45 99:99:99", // right shape, invalid date: kept, not nulled
		});
		const log = await client.execute(`SELECT "at" FROM "GuestbookModerationLog"`);
		expect(log.rows[0].at).toBe("2025-06-27T08:00:00.000Z");
		client.close();
	});

	it("rolls back a failed migration and leaves it unrecorded", async () => {
		const directory = await mkdtemp(join(tmpdir(), "migrations-"));
		temporaryDatabases.push(directory);
		await writeFile(join(directory, "0000_ok.sql"), `CREATE TABLE "a" ("id" integer);`);
		await writeFile(
			join(directory, "0001_bad.sql"),
			`CREATE TABLE "b" ("id" integer); INSERT INTO "missing" VALUES (1);`
		);
		const client = temporaryClient();

		await expect(applyMigrations(client, pathToFileURL(`${directory}/`))).rejects.toThrow(
			"Migration 0001_bad.sql failed"
		);
		const tables = await client.execute(`SELECT "name" FROM sqlite_master WHERE type = 'table' AND "name" = 'b'`);
		const recorded = await client.execute(`SELECT "name" FROM "_migrations"`);
		expect(tables.rows).toHaveLength(0);
		expect(recorded.rows.map((row) => row.name)).toEqual(["0000_ok.sql"]);
		client.close();
	});
});

describe("guestbook database baseline", () => {
	it("creates compatible tables and round-trips dates, booleans, and moderation logs", async () => {
		const client = temporaryClient();
		await applyMigrations(client, MIGRATIONS);
		await client.execute("PRAGMA foreign_keys = ON");
		const database = drizzle(client);
		const timestamp = new Date("2026-07-22T12:34:56.789Z");
		const [entry] = await database
			.insert(Guestbook)
			.values({ name: "Astro 7", message: "Migration verified", timestamp, isSpam: false })
			.returning();

		expect(entry.id).toBe(1);
		expect(entry.timestamp).toEqual(timestamp);
		expect(entry.isSpam).toBe(false);

		await database.insert(GuestbookModerationLog).values({
			entryId: entry.id,
			action: "approve",
			toStatus: "visible",
			actor: "test",
		});
		const [log] = await database.select().from(GuestbookModerationLog);
		expect(log.entryId).toBe(entry.id);
		expect(log.at).toBeInstanceOf(Date);

		client.close();
	});

	// Window queries (rate limit, duplicates) compare timestamps as text against
	// ISO bounds. SQLite's CURRENT_TIMESTAMP is "YYYY-MM-DD HH:MM:SS", and " "
	// sorts before "T", so a row stored by the SQL default never falls inside a
	// same-day window. Inserts that omit the timestamp must still store ISO.
	it("stores omitted timestamps as ISO so same-day window queries match", async () => {
		const client = temporaryClient();
		await applyMigrations(client, MIGRATIONS);
		const database = drizzle(client);

		const [entry] = await database.insert(Guestbook).values({ name: "Window", message: "Same day" }).returning();
		await database.insert(GuestbookModerationLog).values({
			entryId: entry.id,
			action: "approve",
			toStatus: "visible",
			actor: "test",
		});

		const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
		const inWindow = await database.select().from(Guestbook).where(gte(Guestbook.timestamp, tenMinutesAgo));
		const logsInWindow = await database
			.select()
			.from(GuestbookModerationLog)
			.where(gte(GuestbookModerationLog.at, tenMinutesAgo));

		expect(inWindow).toHaveLength(1);
		expect(logsInWindow).toHaveLength(1);
		client.close();
	});
});
