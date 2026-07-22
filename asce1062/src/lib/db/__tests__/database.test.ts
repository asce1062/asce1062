import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveDatabaseConfig } from "../client";
import { Guestbook, GuestbookModerationLog } from "../schema";

const temporaryDatabases: string[] = [];

afterEach(async () => {
	await Promise.all(temporaryDatabases.splice(0).map((path) => rm(path, { force: true })));
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

describe("guestbook database baseline", () => {
	it("creates compatible tables and round-trips dates, booleans, and moderation logs", async () => {
		const databasePath = join(tmpdir(), `guestbook-${crypto.randomUUID()}.db`);
		temporaryDatabases.push(databasePath);
		const client = createClient({ url: `file:${databasePath}` });
		const migration = await readFile(
			new URL("../../../../db/migrations/0000_guestbook_baseline.sql", import.meta.url),
			"utf8"
		);

		await client.executeMultiple(migration);
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
});
