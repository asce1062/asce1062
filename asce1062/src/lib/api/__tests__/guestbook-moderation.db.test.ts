/**
 * guestbook-moderation.ts against a real libsql database built from the
 * migrations: the admin list (filter, search, keyset paging), the tab counts,
 * the audit trail and the status changes.
 */
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const { databasePath } = vi.hoisted(() => ({
	databasePath: `${process.env.TMPDIR ?? "/tmp"}/guestbook-moderation-${Date.now()}-${Math.random().toString(36).slice(2)}.db`,
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

import { rm } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { db, databaseClient } from "@/lib/db/client";
import { Guestbook, GuestbookModerationLog } from "@/lib/db/schema";
import {
	countEntriesByFilter,
	listEntriesForModeration,
	listModerationLog,
	moderateEntries,
} from "../guestbook-moderation";

beforeEach(async () => {
	await db.delete(GuestbookModerationLog);
	await db.delete(Guestbook);
});

afterAll(async () => {
	databaseClient.close();
	await rm(databasePath, { force: true });
});

type Seed = Partial<typeof Guestbook.$inferInsert> & { id: number };

async function seed(rows: Seed[]): Promise<void> {
	await db
		.insert(Guestbook)
		.values(rows.map((row) => ({ name: `Guest ${row.id}`, message: `Message ${row.id}`, ...row })));
}

/** ids 1..n, all visible and unflagged. */
const visibleRows = (n: number): Seed[] =>
	Array.from({ length: n }, (_, i) => ({ id: i + 1, status: "visible" as const }));

const ids = (rows: { id: number }[]) => rows.map((row) => row.id);

describe("listEntriesForModeration", () => {
	it("lists every entry under 'all', including clean visible ones, newest first", async () => {
		await seed([
			{ id: 1, status: "visible" },
			{ id: 2, status: "pending", moderationReason: '["link_only"]', moderationScore: 8 },
			{ id: 3, status: "hidden", moderationReason: '["html_tag"]', moderationScore: 10, isSpam: true },
			{ id: 4, status: "visible" },
		]);

		const page = await listEntriesForModeration({ filter: "all" });

		expect(ids(page.rows)).toEqual([4, 3, 2, 1]);
		expect(page.newer).toBeNull();
		expect(page.older).toBeNull();
	});

	it("filters by status and by flagged", async () => {
		await seed([
			{ id: 1, status: "visible" },
			{ id: 2, status: "pending", moderationReason: '["link_only"]' },
			{ id: 3, status: "hidden", moderationReason: '["html_tag"]' },
			{ id: 4, status: "visible", moderationReason: '["duplicate"]' },
			{ id: 5, status: "hidden" },
		]);

		expect(ids((await listEntriesForModeration({ filter: "visible" })).rows)).toEqual([4, 1]);
		expect(ids((await listEntriesForModeration({ filter: "pending" })).rows)).toEqual([2]);
		expect(ids((await listEntriesForModeration({ filter: "hidden" })).rows)).toEqual([5, 3]);
		expect(ids((await listEntriesForModeration({ filter: "flagged" })).rows)).toEqual([4, 3, 2]);
	});

	it("pages older and newer without skipping or repeating a row", async () => {
		await seed(visibleRows(7));

		const first = await listEntriesForModeration({ filter: "all", limit: 3 });
		expect(ids(first.rows)).toEqual([7, 6, 5]);
		expect(first.newer).toBeNull();
		expect(first.older).toBe(5);

		const second = await listEntriesForModeration({ filter: "all", limit: 3, before: first.older! });
		expect(ids(second.rows)).toEqual([4, 3, 2]);
		expect(second.newer).toBe(4);
		expect(second.older).toBe(2);

		const last = await listEntriesForModeration({ filter: "all", limit: 3, before: second.older! });
		expect(ids(last.rows)).toEqual([1]);
		expect(last.newer).toBe(1);
		expect(last.older).toBeNull();

		const back = await listEntriesForModeration({ filter: "all", limit: 3, after: last.newer! });
		expect(ids(back.rows)).toEqual([4, 3, 2]);
		expect(back.newer).toBe(4);
		expect(back.older).toBe(2);

		const top = await listEntriesForModeration({ filter: "all", limit: 3, after: back.newer! });
		expect(ids(top.rows)).toEqual([7, 6, 5]);
		expect(top.newer).toBeNull();
		expect(top.older).toBe(5);
	});

	it("keeps the filter while paging", async () => {
		await seed([
			{ id: 1, status: "hidden" },
			{ id: 2, status: "visible" },
			{ id: 3, status: "hidden" },
			{ id: 4, status: "visible" },
			{ id: 5, status: "hidden" },
		]);

		const first = await listEntriesForModeration({ filter: "hidden", limit: 2 });
		expect(ids(first.rows)).toEqual([5, 3]);
		const second = await listEntriesForModeration({ filter: "hidden", limit: 2, before: first.older! });
		expect(ids(second.rows)).toEqual([1]);
		expect(second.older).toBeNull();
	});

	it("returns an empty page with no cursors when the cursor runs past the data", async () => {
		await seed(visibleRows(2));

		const page = await listEntriesForModeration({ filter: "all", before: 1 });

		expect(page).toEqual({ rows: [], newer: null, older: null });
	});

	it("searches name, message, email and url, ignoring ASCII case", async () => {
		await seed([
			{ id: 1, name: "Sumus AI", url: "https://sumus.example/" },
			{ id: 2, message: "I found this through SUMUS" },
			{ id: 3, email: "hello@sumus.example" },
			{ id: 4, name: "Ada", message: "Lovely site" },
			{ id: 5, url: "https://sumus.example/bots" },
		]);

		const page = await listEntriesForModeration({ filter: "all", search: "sumus" });

		expect(ids(page.rows)).toEqual([5, 3, 2, 1]);
	});

	it("treats % and _ in the search as literal characters", async () => {
		await seed([
			{ id: 1, message: "100% handmade" },
			{ id: 2, message: "100 handmade" },
			{ id: 3, message: "snake_case fan" },
			{ id: 4, message: "snakeXcase fan" },
		]);

		expect(ids((await listEntriesForModeration({ filter: "all", search: "100%" })).rows)).toEqual([1]);
		expect(ids((await listEntriesForModeration({ filter: "all", search: "snake_case" })).rows)).toEqual([3]);
		expect(ids((await listEntriesForModeration({ filter: "all", search: "%" })).rows)).toEqual([1]);
	});

	it("finds an entry by its id, with or without the #", async () => {
		await seed([{ id: 8, message: "nothing numeric here" }, { id: 9, message: "entry 8 was an ad" }, { id: 80 }]);

		expect(ids((await listEntriesForModeration({ filter: "all", search: "#8" })).rows)).toEqual([8]);
		expect(ids((await listEntriesForModeration({ filter: "all", search: "#999" })).rows)).toEqual([]);
		expect(ids((await listEntriesForModeration({ filter: "all", search: "8" })).rows)).toEqual([80, 9, 8]);
	});

	it("combines search, filter and paging", async () => {
		await seed([
			{ id: 1, status: "visible", message: "buy bots" },
			{ id: 2, status: "hidden", message: "buy bots" },
			{ id: 3, status: "visible", message: "buy bots" },
			{ id: 4, status: "visible", message: "hello" },
			{ id: 5, status: "visible", message: "buy bots" },
		]);

		const first = await listEntriesForModeration({ filter: "visible", search: "bots", limit: 2 });
		expect(ids(first.rows)).toEqual([5, 3]);
		const second = await listEntriesForModeration({
			filter: "visible",
			search: "bots",
			limit: 2,
			before: first.older!,
		});
		expect(ids(second.rows)).toEqual([1]);
		expect(second.newer).toBe(1);
	});

	it("ignores a blank search", async () => {
		await seed(visibleRows(2));

		expect(ids((await listEntriesForModeration({ filter: "all", search: "   " })).rows)).toEqual([2, 1]);
	});
});

describe("query plans", () => {
	const plan = async (sqlText: string): Promise<string> => {
		const result = await databaseClient.execute(`EXPLAIN QUERY PLAN ${sqlText}`);
		return result.rows.map((row) => String(row.detail)).join(" | ");
	};

	it("reads a status tab from the status index, already in id order", async () => {
		const detail = await plan(`SELECT * FROM "Guestbook" WHERE "status" = 'visible' ORDER BY "id" DESC LIMIT 26`);

		expect(detail).toContain("ix_guestbook_status");
		expect(detail).not.toContain("TEMP B-TREE");
	});

	it("keeps using the status index on a later page", async () => {
		const detail = await plan(
			`SELECT * FROM "Guestbook" WHERE "status" = 'visible' AND "id" < 500 ORDER BY "id" DESC LIMIT 26`
		);

		expect(detail).toContain("ix_guestbook_status");
		expect(detail).not.toContain("TEMP B-TREE");
	});

	it("looks an entry up by primary key for a #id search", async () => {
		const detail = await plan(`SELECT * FROM "Guestbook" WHERE "id" = 8 ORDER BY "id" DESC LIMIT 26`);

		expect(detail).toContain("INTEGER PRIMARY KEY");
	});

	it("reads the flagged tab from its partial index, already in id order", async () => {
		const detail = await plan(
			`SELECT * FROM "Guestbook" WHERE "moderationReason" IS NOT NULL ORDER BY "id" DESC LIMIT 26`
		);

		expect(detail).toContain("ix_guestbook_flagged");
		expect(detail).not.toContain("TEMP B-TREE");
	});
});

describe("countEntriesByFilter", () => {
	it("counts every tab", async () => {
		await seed([
			{ id: 1, status: "visible" },
			{ id: 2, status: "visible", moderationReason: '["duplicate"]' },
			{ id: 3, status: "pending", moderationReason: '["link_only"]' },
			{ id: 4, status: "hidden", moderationReason: '["html_tag"]' },
			{ id: 5, status: "hidden" },
		]);

		expect(await countEntriesByFilter()).toEqual({ all: 5, visible: 2, pending: 1, hidden: 2, flagged: 3 });
	});

	it("returns zeros for an empty guestbook", async () => {
		expect(await countEntriesByFilter()).toEqual({ all: 0, visible: 0, pending: 0, hidden: 0, flagged: 0 });
	});
});

describe("moderateEntries", () => {
	it("hides a clean visible entry and appends one audit row", async () => {
		await seed([{ id: 8, status: "visible" }]);

		const result = await moderateEntries([8], "hide");

		expect(result).toEqual({ changed: [8], unchanged: [], missing: [] });
		const [row] = await db.select().from(Guestbook).where(eq(Guestbook.id, 8));
		expect(row).toMatchObject({ status: "hidden", isSpam: true, moderatedBy: "admin" });
		expect(row.moderatedAt).toBeInstanceOf(Date);
		const logs = await db.select().from(GuestbookModerationLog);
		expect(logs).toHaveLength(1);
		expect(logs[0]).toMatchObject({
			entryId: 8,
			action: "hide",
			fromStatus: "visible",
			toStatus: "hidden",
			actor: "admin",
		});
	});

	it("approves a hidden entry and keeps its flags", async () => {
		await seed([{ id: 1, status: "hidden", isSpam: true, moderationReason: '["html_tag"]', moderationScore: 10 }]);

		await moderateEntries([1], "approve");

		const [row] = await db.select().from(Guestbook).where(eq(Guestbook.id, 1));
		expect(row).toMatchObject({
			status: "visible",
			isSpam: false,
			moderationReason: '["html_tag"]',
			moderationScore: 10,
		});
		const [log] = await db.select().from(GuestbookModerationLog);
		expect(log).toMatchObject({ action: "approve", reasonsBefore: '["html_tag"]', reasonsAfter: '["html_tag"]' });
	});

	it("clears the flags on approve-clear but keeps them in the audit row", async () => {
		await seed([{ id: 1, status: "pending", moderationReason: '["link_only"]', moderationScore: 8 }]);

		await moderateEntries([1], "approve-clear");

		const [row] = await db.select().from(Guestbook).where(eq(Guestbook.id, 1));
		expect(row).toMatchObject({ status: "visible", moderationReason: null, moderationScore: null });
		const [log] = await db.select().from(GuestbookModerationLog);
		expect(log).toMatchObject({
			action: "approve_clear",
			reasonsBefore: '["link_only"]',
			scoreBefore: 8,
			reasonsAfter: null,
			scoreAfter: null,
		});
	});

	it("changes several entries at once, one audit row each", async () => {
		await seed(visibleRows(4));

		const result = await moderateEntries([1, 3, 4], "hide");

		expect(result.changed).toEqual([1, 3, 4]);
		const rows = await db.select().from(Guestbook);
		expect(rows.filter((row) => row.status === "hidden").map((row) => row.id)).toEqual([1, 3, 4]);
		expect(await db.select().from(GuestbookModerationLog)).toHaveLength(3);
	});

	it("leaves entries already in the target state alone and writes no audit row for them", async () => {
		await seed([
			{ id: 1, status: "hidden" },
			{ id: 2, status: "visible" },
		]);

		const result = await moderateEntries([1, 2], "hide");

		expect(result).toEqual({ changed: [2], unchanged: [1], missing: [] });
		const [untouched] = await db.select().from(Guestbook).where(eq(Guestbook.id, 1));
		expect(untouched.moderatedAt).toBeNull();
		expect(await db.select().from(GuestbookModerationLog)).toHaveLength(1);
	});

	it("clears flags on an entry that is already visible", async () => {
		await seed([{ id: 1, status: "visible", moderationReason: '["duplicate"]', moderationScore: 5 }]);

		expect(await moderateEntries([1], "approve")).toEqual({ changed: [], unchanged: [1], missing: [] });
		expect(await moderateEntries([1], "approve-clear")).toEqual({ changed: [1], unchanged: [], missing: [] });
	});

	it("reports unknown ids as missing and writes nothing for them", async () => {
		await seed([{ id: 1, status: "visible" }]);

		const result = await moderateEntries([1, 999_999], "hide");

		expect(result).toEqual({ changed: [1], unchanged: [], missing: [999_999] });
		expect(await db.select().from(GuestbookModerationLog)).toHaveLength(1);
	});

	it("ignores duplicate and invalid ids", async () => {
		await seed([{ id: 1, status: "visible" }]);

		const result = await moderateEntries([1, 1, 0, -3, 1.5, Number.NaN], "hide");

		expect(result).toEqual({ changed: [1], unchanged: [], missing: [] });
		expect(await db.select().from(GuestbookModerationLog)).toHaveLength(1);
	});

	/**
	 * Run `raced` so that `interloper` commits after it has read the entry but
	 * before its own write: the state it read is stale by the time it writes.
	 */
	async function withStaleRead<T>(interloper: () => Promise<unknown>, raced: () => Promise<T>): Promise<T> {
		const batch = db.batch.bind(db);
		const spy = vi.spyOn(db, "batch").mockImplementationOnce(async (statements) => {
			spy.mockRestore();
			await interloper();
			return batch(statements);
		});
		try {
			return await raced();
		} finally {
			spy.mockRestore();
		}
	}

	it("writes nothing when another request hid the entry first", async () => {
		await seed([{ id: 5, status: "visible" }]);

		const loser = await withStaleRead(
			() => moderateEntries([5], "hide"),
			() => moderateEntries([5], "hide")
		);

		expect(loser).toEqual({ changed: [], unchanged: [5], missing: [] });
		expect(await db.select().from(GuestbookModerationLog)).toHaveLength(1);
	});

	it("does not overwrite a conflicting change made after the entry was read", async () => {
		await seed([{ id: 5, status: "pending", moderationReason: '["link_only"]', moderationScore: 8 }]);

		const loser = await withStaleRead(
			() => moderateEntries([5], "hide"),
			() => moderateEntries([5], "approve-clear")
		);

		expect(loser.changed).toEqual([]);
		const [row] = await db.select().from(Guestbook).where(eq(Guestbook.id, 5));
		expect(row).toMatchObject({ status: "hidden", moderationReason: '["link_only"]' });
		const logs = await db.select().from(GuestbookModerationLog);
		expect(logs).toHaveLength(1);
		expect(logs[0]).toMatchObject({ action: "hide", fromStatus: "pending", toStatus: "hidden" });
	});

	it("still applies the rest of a bulk action when one entry lost a race", async () => {
		await seed(visibleRows(3));

		const result = await withStaleRead(
			() => moderateEntries([2], "hide"),
			() => moderateEntries([1, 2, 3], "hide")
		);

		expect(result).toEqual({ changed: [1, 3], unchanged: [2], missing: [] });
		expect(await db.select().from(GuestbookModerationLog)).toHaveLength(3);
	});

	it("stores the audit time in the same format as an ORM insert", async () => {
		await seed([{ id: 1, status: "visible" }]);

		await moderateEntries([1], "hide");

		const [log] = await db.select().from(GuestbookModerationLog);
		const [row] = await db.select().from(Guestbook).where(eq(Guestbook.id, 1));
		expect(log.at).toEqual(row.moderatedAt);
	});

	it("does nothing for an empty selection", async () => {
		expect(await moderateEntries([], "hide")).toEqual({ changed: [], unchanged: [], missing: [] });
	});

	it("refuses more ids than the bulk limit", async () => {
		const tooMany = Array.from({ length: 101 }, (_, i) => i + 1);

		await expect(moderateEntries(tooMany, "hide")).rejects.toThrow(/at most 100/);
	});
});

describe("listModerationLog", () => {
	it("pages the audit trail newest first", async () => {
		await seed(visibleRows(5));
		for (const id of [1, 2, 3, 4, 5]) await moderateEntries([id], "hide");

		const first = await listModerationLog({ limit: 2 });
		expect(first.rows.map((row) => row.entryId)).toEqual([5, 4]);
		expect(first.newer).toBeNull();

		const second = await listModerationLog({ limit: 2, before: first.older! });
		expect(second.rows.map((row) => row.entryId)).toEqual([3, 2]);

		const back = await listModerationLog({ limit: 2, after: second.newer! });
		expect(back.rows.map((row) => row.entryId)).toEqual([5, 4]);
		expect(back.newer).toBeNull();
	});
});
