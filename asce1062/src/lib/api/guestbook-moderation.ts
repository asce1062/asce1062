/**
 * Admin moderation queries for the guestbook: the entry list (filter, search,
 * paging), the tab counts, the audit trail and the status changes.
 *
 * Built to stay cheap as the guestbook grows:
 *  - Lists are keyset-paged on the primary key (`id < cursor`), so an unsearched
 *    page reads only its own rows however deep it is. OFFSET would read and
 *    discard every row before the page, and the database bills for rows read.
 *  - Newest first means id descending. `id` is the rowid, so the "all" list walks
 *    the table backwards, a status tab walks ix_guestbook_status (which carries
 *    the rowid) and the flagged tab walks ix_guestbook_flagged. None of them sort.
 *  - The tab counts read the status and flagged indexes, not the entries. That
 *    is still one index entry per guestbook entry on every page load.
 *  - Search is a substring match and has no index to use. It walks rows newest
 *    first and stops once a page is full, so a rare term reads the whole table.
 *    `#id` skips the text match and is a primary key lookup.
 */
import { and, asc, count, desc, eq, gt, inArray, isNotNull, lt, or, sql, type SQL } from "drizzle-orm";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";
import { db } from "@/lib/db/client";
import { Guestbook, GuestbookModerationLog } from "@/lib/db/schema";
import { MODERATED_BY, type GuestEntry, type ModerationStatus } from "@/lib/api/guestbook";

export const MODERATION_FILTERS = ["all", "visible", "pending", "hidden", "flagged"] as const;
export type ModerationFilter = (typeof MODERATION_FILTERS)[number];

export const MODERATION_ACTIONS = ["approve", "approve-clear", "hide"] as const;
export type ModerationAction = (typeof MODERATION_ACTIONS)[number];

const MODERATION_PAGE_SIZE = 25;
/** Longest search term used. Anything past it is dropped. */
export const MODERATION_SEARCH_MAX = 100;
/** Most entries one action may change: one batch, one transaction. */
export const MODERATION_BULK_MAX = 100;

export type ModerationLogRow = typeof GuestbookModerationLog.$inferSelect;

/**
 * One page of a newest-first list. `newer` and `older` are the cursors for the
 * neighbouring pages (pass them back as `after` / `before`), or null when there
 * is nothing in that direction.
 */
export interface KeysetPage<T> {
	rows: T[];
	newer: number | null;
	older: number | null;
}

export interface KeysetCursor {
	/** Rows older than this id. */
	before?: number;
	/** Rows newer than this id. Wins over `before` when both are given. */
	after?: number;
	limit?: number;
}

export interface EntryListOptions extends KeysetCursor {
	filter: ModerationFilter;
	search?: string;
}

export interface ModerationResult {
	/** Entries whose status or flags changed. Each has a new audit row. */
	changed: number[];
	/** Entries already in the requested state. Nothing was written for them. */
	unchanged: number[];
	/** Ids with no entry. */
	missing: number[];
}

type FetchRows<T> = (where: SQL | undefined, newestFirst: boolean, limit: number) => Promise<T[]>;

/**
 * Keyset paging over a newest-first (id descending) list. Reads one row past the
 * page to learn whether the direction of travel continues, and one row the other
 * way to learn whether there is a way back.
 */
async function keysetPage<T extends { id: number }>(
	idColumn: SQLiteColumn,
	{ before, after, limit = MODERATION_PAGE_SIZE }: KeysetCursor,
	fetchRows: FetchRows<T>
): Promise<KeysetPage<T>> {
	const exists = async (where: SQL): Promise<boolean> => (await fetchRows(where, true, 1)).length > 0;

	if (after !== undefined) {
		// Walk upwards from the cursor, then flip back to newest-first.
		const ascending = await fetchRows(gt(idColumn, after), false, limit + 1);
		const rows = ascending.slice(0, limit).reverse();
		if (rows.length === 0) return { rows, newer: null, older: null };
		const oldest = rows[rows.length - 1].id;
		return {
			rows,
			newer: ascending.length > limit ? rows[0].id : null,
			older: (await exists(lt(idColumn, oldest))) ? oldest : null,
		};
	}

	const descending = await fetchRows(before === undefined ? undefined : lt(idColumn, before), true, limit + 1);
	const rows = descending.slice(0, limit);
	if (rows.length === 0) return { rows, newer: null, older: null };
	const newest = rows[0].id;
	return {
		rows,
		newer: before !== undefined && (await exists(gt(idColumn, newest))) ? newest : null,
		older: descending.length > limit ? rows[rows.length - 1].id : null,
	};
}

function filterCondition(filter: ModerationFilter): SQL | undefined {
	if (filter === "all") return undefined;
	if (filter === "flagged") return isNotNull(Guestbook.moderationReason);
	return eq(Guestbook.status, filter);
}

/**
 * `#8` finds entry 8 by primary key. Anything else is a substring match on the
 * fields a moderator can see, with `%`, `_` and `\\` escaped so they match
 * themselves. A bare number matches both that entry id and the text.
 */
function searchCondition(search: string | undefined): SQL | undefined {
	const term = (search ?? "").trim().slice(0, MODERATION_SEARCH_MAX);
	if (!term) return undefined;

	const idOnly = /^#(\d{1,9})$/.exec(term);
	if (idOnly) return eq(Guestbook.id, Number(idOnly[1]));

	const pattern = `%${term.replace(/[\\%_]/g, "\\$&")}%`;
	const contains = (column: SQLiteColumn): SQL => sql`${column} LIKE ${pattern} ESCAPE '\\'`;
	const bareNumber = /^\d{1,9}$/.test(term);

	return or(
		contains(Guestbook.name),
		contains(Guestbook.message),
		contains(Guestbook.email),
		contains(Guestbook.url),
		...(bareNumber ? [eq(Guestbook.id, Number(term))] : [])
	);
}

/**
 * One page of entries for the admin list, newest first. Unlike the public page,
 * "all" really is every entry, so an entry the classifier let through can still
 * be found and hidden.
 */
export async function listEntriesForModeration(options: EntryListOptions): Promise<KeysetPage<GuestEntry>> {
	const scope = and(filterCondition(options.filter), searchCondition(options.search));

	return keysetPage(Guestbook.id, options, async (where, newestFirst, limit) => {
		const rows = await db
			.select()
			.from(Guestbook)
			.where(and(scope, where))
			.orderBy(newestFirst ? desc(Guestbook.id) : asc(Guestbook.id))
			.limit(limit);
		return rows as unknown as GuestEntry[];
	});
}

/**
 * Entry totals for the filter tabs, in one round trip. Both counts are answered
 * from an index (status, flagged) without touching the entries themselves.
 */
export async function countEntriesByFilter(): Promise<Record<ModerationFilter, number>> {
	const [byStatus, flagged] = await db.batch([
		db.select({ status: Guestbook.status, value: count() }).from(Guestbook).groupBy(Guestbook.status),
		db.select({ value: count() }).from(Guestbook).where(isNotNull(Guestbook.moderationReason)),
	]);

	const forStatus = (status: ModerationStatus): number => byStatus.find((row) => row.status === status)?.value ?? 0;
	return {
		// Summed over every group, so legacy rows with no status still count here.
		all: byStatus.reduce((total, row) => total + row.value, 0),
		visible: forStatus("visible"),
		pending: forStatus("pending"),
		hidden: forStatus("hidden"),
		flagged: flagged[0]?.value ?? 0,
	};
}

/** One page of the audit trail, newest first. */
export async function listModerationLog(cursor: KeysetCursor = {}): Promise<KeysetPage<ModerationLogRow>> {
	return keysetPage(GuestbookModerationLog.id, cursor, (where, newestFirst, limit) =>
		db
			.select()
			.from(GuestbookModerationLog)
			.where(where)
			.orderBy(newestFirst ? desc(GuestbookModerationLog.id) : asc(GuestbookModerationLog.id))
			.limit(limit)
	);
}

type CurrentState = Pick<GuestEntry, "id" | "status" | "moderationReason" | "moderationScore">;

/** Would this action change the entry? Approve-clear also applies to a visible entry that still carries flags. */
function needsChange(entry: CurrentState, action: ModerationAction): boolean {
	if (action === "hide") return entry.status !== "hidden";
	if (action === "approve") return entry.status !== "visible";
	return entry.status !== "visible" || entry.moderationReason !== null;
}

/**
 * Apply one moderation action to one or more entries (admin action).
 *
 *  - `approve`        makes the entry visible and keeps its classifier flags.
 *  - `approve-clear`  makes it visible and removes the flags (a false positive).
 *  - `hide`           takes it off the public page. Works on any entry, including
 *                     one the classifier passed.
 *
 * Every status change and its GuestbookModerationLog row go in a single batch
 * (one transaction on libsql): they all commit or none do, and the audit row
 * keeps the classifier output even when approve-clear nulls it on the entry.
 * Entries already in the requested state are skipped, including ones another
 * request changed first, so repeating an action never adds a duplicate audit row.
 */
export async function moderateEntries(
	ids: readonly number[],
	action: ModerationAction,
	options?: { moderatedBy?: string }
): Promise<ModerationResult> {
	const wanted = [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))];
	if (wanted.length > MODERATION_BULK_MAX) {
		throw new Error(`[guestbook] moderateEntries takes at most ${MODERATION_BULK_MAX} entries, got ${wanted.length}`);
	}
	if (wanted.length === 0) return { changed: [], unchanged: [], missing: [] };

	const status: ModerationStatus = action === "hide" ? "hidden" : "visible";
	const clearFlags = action === "approve-clear";
	const actor = options?.moderatedBy ?? MODERATED_BY.admin;
	const at = new Date();
	const logAction = action === "approve-clear" ? "approve_clear" : action;

	// Read current state before mutating. The audit rows need the pre-action values.
	const current: CurrentState[] = await db
		.select({
			id: Guestbook.id,
			status: Guestbook.status,
			moderationReason: Guestbook.moderationReason,
			moderationScore: Guestbook.moderationScore,
		})
		.from(Guestbook)
		.where(inArray(Guestbook.id, wanted));

	const found = new Map(current.map((entry) => [entry.id, entry]));
	const targets = wanted.flatMap((id) => {
		const entry = found.get(id);
		return entry && needsChange(entry, action) ? [entry] : [];
	});

	// Each update only applies while the entry is still in the state read above,
	// and its audit row is only written when that update changed a row
	// (`changes()` reports the statement just before it). So when two requests
	// race on one entry, a single one wins and writes a single audit row whose
	// "before" columns are true.
	const statements = targets.map(
		(entry) =>
			[
				db
					.update(Guestbook)
					.set({
						status,
						isSpam: status === "hidden",
						moderatedAt: at,
						moderatedBy: actor,
						...(clearFlags ? { moderationReason: null, moderationScore: null } : {}),
					})
					.where(
						and(
							eq(Guestbook.id, entry.id),
							sql`${Guestbook.status} IS ${entry.status}`,
							sql`${Guestbook.moderationReason} IS ${entry.moderationReason}`
						)
					)
					.returning({ id: Guestbook.id }),
				db.run(sql`
					INSERT INTO "GuestbookModerationLog"
						("entryId", "action", "fromStatus", "toStatus", "reasonsBefore", "scoreBefore", "reasonsAfter", "scoreAfter", "actor", "at")
					SELECT ${entry.id}, ${logAction}, ${entry.status}, ${status}, ${entry.moderationReason}, ${entry.moderationScore},
						${clearFlags ? null : entry.moderationReason}, ${clearFlags ? null : entry.moderationScore}, ${actor}, ${at.toISOString()}
					WHERE changes() > 0
				`),
			] as const
	);

	const changed: number[] = [];
	const [first, ...rest] = statements.flat();
	if (first) {
		const results = await db.batch([first, ...rest]);
		// Results alternate update, insert. An update that lost a race returns no row.
		targets.forEach((entry, index) => {
			const updated = results[index * 2];
			if (Array.isArray(updated) && updated.length > 0) changed.push(entry.id);
		});
	}

	return {
		changed,
		unchanged: wanted.filter((id) => found.has(id) && !changed.includes(id)),
		missing: wanted.filter((id) => !found.has(id)),
	};
}
