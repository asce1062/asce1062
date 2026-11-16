/**
 * Request parsing and URL building for the admin moderation page.
 *
 * The page keeps its whole state (view, search, page cursor) in the query
 * string, so every action can redirect back to exactly where the moderator was.
 * Everything arriving in a query string or form body is untrusted and is
 * narrowed here before it reaches a query.
 */
import {
	MODERATION_ACTIONS,
	MODERATION_BULK_MAX,
	MODERATION_FILTERS,
	MODERATION_SEARCH_MAX,
	type ModerationAction,
	type ModerationFilter,
	type ModerationResult,
} from "@/lib/api/guestbook-moderation";

const MODERATION_PATH = "/admin/guestbook";

/** The entry tabs plus the audit trail. */
const MODERATION_VIEWS = [...MODERATION_FILTERS, "audit"] as const;
export type ModerationView = ModerationFilter | "audit";

export interface ListState {
	view: ModerationView;
	search: string;
	before?: number;
	after?: number;
}

export interface ModerationRequest {
	action: ModerationAction;
	ids: number[];
}

/** How many requested copies went out, or failed, after an approval. */
export interface CopyOutcome {
	sent: number;
	failed: number;
}

const isView = (value: string | null): value is ModerationView => MODERATION_VIEWS.includes(value as ModerationView);
const isAction = (value: string | null): value is ModerationAction =>
	MODERATION_ACTIONS.includes(value as ModerationAction);

/** A positive integer written in plain digits, or undefined. */
function positiveInt(value: string | null | undefined): number | undefined {
	if (!value || !/^\d{1,15}$/.test(value)) return undefined;
	const parsed = Number(value);
	return parsed > 0 ? parsed : undefined;
}

const count = (value: string | null): number => positiveInt(value) ?? 0;

export function parseListState(params: URLSearchParams): ListState {
	const requested = params.get("filter");
	const after = positiveInt(params.get("after"));
	return {
		view: isView(requested) ? requested : "all",
		search: (params.get("q") ?? "").trim().slice(0, MODERATION_SEARCH_MAX),
		// One cursor at most. `after` wins, matching the list queries.
		after,
		before: after === undefined ? positiveInt(params.get("before")) : undefined,
	};
}

/**
 * URL for a list state. Defaults are left out, so the plain page stays
 * `/admin/guestbook`. Changing the view or the search drops the page cursor:
 * a cursor only means something within one list.
 */
export function moderationUrl(state: ListState, extra?: Record<string, string>): string {
	const params = new URLSearchParams();
	if (state.view !== "all") params.set("filter", state.view);
	if (state.search && state.view !== "audit") params.set("q", state.search);
	if (state.after !== undefined) params.set("after", String(state.after));
	else if (state.before !== undefined) params.set("before", String(state.before));
	for (const [key, value] of Object.entries(extra ?? {})) params.set(key, value);
	const query = params.toString();
	return query ? `${MODERATION_PATH}?${query}` : MODERATION_PATH;
}

/**
 * Read a moderation action from the posted form.
 *
 * A row button posts `single=<action>:<id>` and acts on that one entry whatever
 * else is ticked. A bulk button posts `bulk=<action>` and acts on every ticked
 * `ids` checkbox. Returns null for anything else, including an empty selection
 * and more entries than one action may change.
 */
export function parseModerationForm(formData: FormData): ModerationRequest | null {
	const text = (key: string): string | null => {
		const value = formData.get(key);
		return typeof value === "string" ? value : null;
	};

	const single = /^([a-z-]+):(\d{1,15})$/.exec(text("single") ?? "");
	if (single) {
		const id = positiveInt(single[2]);
		return isAction(single[1]) && id !== undefined ? { action: single[1], ids: [id] } : null;
	}

	const bulk = text("bulk");
	if (!isAction(bulk)) return null;
	const ids = formData.getAll("ids").map((value) => (typeof value === "string" ? positiveInt(value) : undefined));
	if (ids.length === 0 || ids.length > MODERATION_BULK_MAX || ids.includes(undefined)) return null;
	return { action: bulk, ids: [...new Set(ids as number[])] };
}

/** Query parameters that carry an action's outcome across the redirect. */
export function resultParams(
	action: ModerationAction,
	result: ModerationResult,
	copies: CopyOutcome
): Record<string, string> {
	const params: Record<string, string> = { done: action, changed: String(result.changed.length) };
	if (result.changed.length === 1) params.entry = String(result.changed[0]);
	if (result.unchanged.length > 0) params.unchanged = String(result.unchanged.length);
	if (result.missing.length > 0) params.missing = String(result.missing.length);
	if (copies.sent > 0) params.copies = String(copies.sent);
	if (copies.failed > 0) params.copyFailures = String(copies.failed);
	return params;
}

const PAST_TENSE: Record<ModerationAction, string> = {
	approve: "approved",
	"approve-clear": "approved and flags cleared",
	hide: "hidden",
};

export interface ResultNotice {
	text: string;
	/** False when the action changed nothing or part of it went wrong. */
	ok: boolean;
}

export type PlainNotice = "none" | "error";

/** Outcomes that are not an action result: nothing was ticked, or the action failed. */
const PLAIN_NOTICES: Record<PlainNotice, string> = {
	none: "Nothing was selected. Tick one or more entries first.",
	error: "That action could not be completed and nothing was changed. Check the function logs.",
};

/** The banner for the outcome carried in the query string, or null when there is none. */
export function describeResult(params: URLSearchParams): ResultNotice | null {
	const action = params.get("done");
	if (action === "none" || action === "error") return { text: PLAIN_NOTICES[action], ok: false };
	if (!isAction(action)) return null;

	const changed = count(params.get("changed"));
	const entry = positiveInt(params.get("entry"));
	const unchanged = count(params.get("unchanged"));
	const missing = count(params.get("missing"));
	const copies = count(params.get("copies"));
	const copyFailures = count(params.get("copyFailures"));
	const verb = PAST_TENSE[action];

	const parts: string[] = [];
	if (changed === 0) parts.push("Nothing changed.");
	else if (changed === 1 && entry !== undefined) parts.push(`Entry #${entry} ${verb}.`);
	else parts.push(`${changed} ${changed === 1 ? "entry" : "entries"} ${verb}.`);

	if (unchanged > 0) parts.push(`${unchanged} ${unchanged === 1 ? "was" : "were"} already in that state.`);
	if (missing > 0) parts.push(`${missing} no longer ${missing === 1 ? "exists" : "exist"}.`);
	if (copies > 0) parts.push(`${copies} requested ${copies === 1 ? "copy was" : "copies were"} emailed.`);
	if (copyFailures > 0) {
		parts.push(
			`${copyFailures} requested ${copyFailures === 1 ? "copy" : "copies"} could not be emailed. Check the function logs.`
		);
	}

	return { text: parts.join(" "), ok: changed > 0 && missing === 0 && copyFailures === 0 };
}
