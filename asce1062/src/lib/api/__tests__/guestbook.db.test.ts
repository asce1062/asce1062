/**
 * guestbook.ts against a real libsql database built from the baseline migration.
 *
 * The other guestbook tests mock the DB, which hid the timestamp-format bug that
 * kept rate limiting from ever firing. These run the real query path end to end.
 */
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const { databasePath } = vi.hoisted(() => ({
	databasePath: `${process.env.TMPDIR ?? "/tmp"}/guestbook-api-${Date.now()}-${Math.random().toString(36).slice(2)}.db`,
}));

vi.mock("@/lib/db/client", async () => {
	const { createClient } = await import("@libsql/client");
	const { drizzle } = await import("drizzle-orm/libsql");
	const { readFile } = await import("node:fs/promises");
	const schema = await import("@/lib/db/schema");
	const client = createClient({ url: `file:${databasePath}` });
	await client.executeMultiple(
		await readFile(new URL("../../../../db/migrations/0000_guestbook_baseline.sql", import.meta.url), "utf8")
	);
	return { databaseClient: client, databaseTarget: databasePath, db: drizzle(client, { schema }) };
});

import { rm } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { db, databaseClient } from "@/lib/db/client";
import { Guestbook, GuestbookModerationLog } from "@/lib/db/schema";
import { createGuestEntry, updateEntryStatus } from "../guestbook";

beforeEach(async () => {
	await db.delete(GuestbookModerationLog);
	await db.delete(Guestbook);
});

afterAll(async () => {
	databaseClient.close();
	await rm(databasePath, { force: true });
});

const entry = (message: string) => ({
	name: "Ada",
	email: "",
	url: null,
	message,
	ip: "203.0.113.7",
	userAgent: "vitest",
});

describe("createGuestEntry (real DB)", () => {
	it("flags the 3rd copy of a message from one IP as duplicate + rate_limited", async () => {
		const first = await createGuestEntry(entry("Hello from the same visitor"));
		const second = await createGuestEntry(entry("Hello from the same visitor"));
		const third = await createGuestEntry(entry("Hello from the same visitor"));

		expect(first.classification.reasons).not.toContain("duplicate");
		expect(second.classification.reasons).toContain("duplicate");
		expect(third.classification.reasons).toEqual(expect.arrayContaining(["duplicate", "rate_limited"]));
	});

	it("rate-limits a burst of distinct messages from one IP", async () => {
		await createGuestEntry(entry("First distinct message here"));
		await createGuestEntry(entry("Second distinct message here"));
		const third = await createGuestEntry(entry("Third distinct message here"));

		expect(third.classification.reasons).toContain("rate_limited");
	});
});

describe("updateEntryStatus (real DB)", () => {
	it("updates the entry and appends one audit row", async () => {
		const { entryId } = await createGuestEntry(entry("Moderate me please"));

		await expect(updateEntryStatus(entryId, "hidden")).resolves.toBe(true);

		const [row] = await db.select().from(Guestbook).where(eq(Guestbook.id, entryId));
		const logs = await db.select().from(GuestbookModerationLog);
		expect(row.status).toBe("hidden");
		expect(logs).toHaveLength(1);
		expect(logs[0]).toMatchObject({ entryId, action: "hide", fromStatus: "visible", toStatus: "hidden" });
	});

	it("returns false and writes no audit row for an unknown entry", async () => {
		await expect(updateEntryStatus(999_999, "hidden")).resolves.toBe(false);
		expect(await db.select().from(GuestbookModerationLog)).toHaveLength(0);
	});
});
