/**
 * guestbook.ts against a real libsql database built from the migrations.
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
	const { applyMigrations } = await import("@/lib/db/migrate");
	const schema = await import("@/lib/db/schema");
	const client = createClient({ url: `file:${databasePath}` });
	await applyMigrations(client, new URL("../../../../db/migrations/", import.meta.url));
	return { databaseClient: client, databaseTarget: databasePath, db: drizzle(client, { schema }) };
});

vi.mock("@/lib/api/guestbook-notify", () => ({ sendEntryCopy: vi.fn() }));

import { rm } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { db, databaseClient } from "@/lib/db/client";
import { Guestbook, GuestbookModerationLog } from "@/lib/db/schema";
import { createGuestEntry, updateEntryStatus } from "../guestbook";
import { deliverRequestedCopy } from "../guestbook-copy";
import { sendEntryCopy } from "../guestbook-notify";

beforeEach(async () => {
	vi.mocked(sendEntryCopy).mockReset();
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

describe("requested entry copies (real DB)", () => {
	const withCopy = (message: string, email = "ada@example.com") => ({
		...entry(message),
		email,
		copyTheme: "dark" as const,
	});
	const hold = (entryId: number) => db.update(Guestbook).set({ status: "pending" }).where(eq(Guestbook.id, entryId));
	const copySentAt = async (entryId: number) =>
		(await db.select({ at: Guestbook.copySentAt }).from(Guestbook).where(eq(Guestbook.id, entryId)))[0]?.at;

	it("records the opt-in only when there is an address to send to", async () => {
		const { entryId: withEmail } = await createGuestEntry(withCopy("Copy me please"));
		const { entryId: withoutEmail } = await createGuestEntry(withCopy("No address given", ""));

		const rows = await db.select({ id: Guestbook.id, copyTheme: Guestbook.copyTheme }).from(Guestbook);
		expect(rows).toEqual(
			expect.arrayContaining([
				{ id: withEmail, copyTheme: "dark" },
				{ id: withoutEmail, copyTheme: null },
			])
		);
	});

	it("holds a pending entry's copy, then sends it once on approval", async () => {
		const { entryId, submittedAt } = await createGuestEntry(withCopy("Held for review"));
		await hold(entryId);
		vi.mocked(sendEntryCopy).mockResolvedValue({ ok: true });

		await expect(deliverRequestedCopy(entryId)).resolves.toBeNull();
		expect(sendEntryCopy).not.toHaveBeenCalled();
		expect(await copySentAt(entryId)).toBeNull();

		await updateEntryStatus(entryId, "visible");
		await expect(deliverRequestedCopy(entryId)).resolves.toEqual({ ok: true });
		expect(sendEntryCopy).toHaveBeenCalledWith(
			expect.objectContaining({ entryId, email: "ada@example.com", status: "visible", theme: "dark", submittedAt })
		);
		expect(await copySentAt(entryId)).toBeInstanceOf(Date);

		// Approving again (e.g. hide, then approve) never sends a second copy.
		await expect(deliverRequestedCopy(entryId)).resolves.toBeNull();
		expect(sendEntryCopy).toHaveBeenCalledTimes(1);
	});

	it("sends once when two approvals race", async () => {
		const { entryId } = await createGuestEntry(withCopy("Double-clicked approve"));
		vi.mocked(sendEntryCopy).mockResolvedValue({ ok: true });

		const results = await Promise.all([deliverRequestedCopy(entryId), deliverRequestedCopy(entryId)]);

		expect(results.filter((r) => r?.ok)).toHaveLength(1);
		expect(results).toContain(null);
		expect(sendEntryCopy).toHaveBeenCalledTimes(1);
	});

	it("releases the claim after a failed send so a later approval retries", async () => {
		const { entryId } = await createGuestEntry(withCopy("Delivery fails once"));
		vi.mocked(sendEntryCopy).mockResolvedValueOnce({ ok: false, reason: "http_500" });

		await expect(deliverRequestedCopy(entryId)).resolves.toEqual({ ok: false, reason: "http_500" });
		expect(await copySentAt(entryId)).toBeNull();

		vi.mocked(sendEntryCopy).mockResolvedValueOnce({ ok: true });
		await expect(deliverRequestedCopy(entryId)).resolves.toEqual({ ok: true });
	});

	it("releases the claim when sending throws", async () => {
		const { entryId } = await createGuestEntry(withCopy("Delivery throws"));
		vi.mocked(sendEntryCopy).mockRejectedValueOnce(new Error("boom"));

		await expect(deliverRequestedCopy(entryId)).resolves.toEqual({ ok: false, reason: "delivery_error" });
		expect(await copySentAt(entryId)).toBeNull();
	});

	it("does nothing for an entry whose guest did not ask for a copy", async () => {
		const { entryId } = await createGuestEntry({ ...entry("No copy wanted"), email: "ada@example.com" });
		await expect(deliverRequestedCopy(entryId)).resolves.toBeNull();
		expect(sendEntryCopy).not.toHaveBeenCalled();
	});
});
