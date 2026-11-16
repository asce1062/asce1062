import { describe, expect, it, vi } from "vitest";

// The request helpers only use the constants and types of the query module.
vi.mock("@/lib/db/client", () => ({ db: {} }));

import {
	describeResult,
	moderationUrl,
	parseListState,
	parseModerationForm,
	resultParams,
} from "../guestbook-moderation-request";

const params = (query: string) => new URLSearchParams(query);

function form(fields: [string, string][]): FormData {
	const data = new FormData();
	for (const [key, value] of fields) data.append(key, value);
	return data;
}

describe("parseListState", () => {
	it("defaults to the first page of every entry", () => {
		expect(parseListState(params(""))).toEqual({ view: "all", search: "", before: undefined, after: undefined });
	});

	it("reads the view, search and cursor", () => {
		expect(parseListState(params("filter=hidden&q=%20bots%20&before=42"))).toEqual({
			view: "hidden",
			search: "bots",
			before: 42,
			after: undefined,
		});
	});

	it("falls back to 'all' for an unknown view", () => {
		expect(parseListState(params("filter=deleted")).view).toBe("all");
	});

	it("accepts the audit view", () => {
		expect(parseListState(params("filter=audit")).view).toBe("audit");
	});

	it.each(["0", "-1", "1.5", "abc", "1e3", " 7", ""])("drops the cursor %j", (value) => {
		const state = parseListState(params(`before=${encodeURIComponent(value)}`));
		expect(state.before).toBeUndefined();
	});

	it("keeps only `after` when both cursors are given", () => {
		expect(parseListState(params("before=9&after=4"))).toMatchObject({ after: 4, before: undefined });
	});

	it("caps the search length", () => {
		expect(parseListState(params(`q=${"x".repeat(500)}`)).search).toHaveLength(100);
	});
});

describe("moderationUrl", () => {
	it("leaves defaults out", () => {
		expect(moderationUrl({ view: "all", search: "" })).toBe("/admin/guestbook");
	});

	it("encodes the view, search and cursor", () => {
		expect(moderationUrl({ view: "visible", search: "a&b #8", before: 12 })).toBe(
			"/admin/guestbook?filter=visible&q=a%26b+%238&before=12"
		);
	});

	it("round-trips through parseListState", () => {
		const state = { view: "flagged" as const, search: "100% _real_", after: 7, before: undefined };
		const url = new URL(moderationUrl(state), "https://example.test");
		expect(parseListState(url.searchParams)).toEqual(state);
	});

	it("drops the search on the audit view, which has none", () => {
		expect(moderationUrl({ view: "audit", search: "bots", before: 3 })).toBe("/admin/guestbook?filter=audit&before=3");
	});

	it("appends extra parameters", () => {
		expect(moderationUrl({ view: "pending", search: "" }, { done: "hide", changed: "2" })).toBe(
			"/admin/guestbook?filter=pending&done=hide&changed=2"
		);
	});
});

describe("parseModerationForm", () => {
	it("reads a row button", () => {
		expect(parseModerationForm(form([["single", "hide:8"]]))).toEqual({ action: "hide", ids: [8] });
		expect(parseModerationForm(form([["single", "approve-clear:12"]]))).toEqual({ action: "approve-clear", ids: [12] });
	});

	it("acts on the row only, even with other entries ticked", () => {
		const data = form([
			["ids", "1"],
			["ids", "2"],
			["single", "approve:5"],
		]);
		expect(parseModerationForm(data)).toEqual({ action: "approve", ids: [5] });
	});

	it("reads a bulk button with its ticked entries, without repeats", () => {
		const data = form([
			["ids", "3"],
			["ids", "9"],
			["ids", "3"],
			["bulk", "hide"],
		]);
		expect(parseModerationForm(data)).toEqual({ action: "hide", ids: [3, 9] });
	});

	it.each([
		["an unknown row action", [["single", "delete:8"]]],
		["a row id of zero", [["single", "hide:0"]]],
		["a malformed row value", [["single", "hide:8; drop"]]],
		[
			"an unknown bulk action",
			[
				["bulk", "delete"],
				["ids", "1"],
			],
		],
		["a bulk action with nothing ticked", [["bulk", "hide"]]],
		[
			"a bulk action with a bad id",
			[
				["bulk", "hide"],
				["ids", "1"],
				["ids", "x"],
			],
		],
		["no action at all", [["ids", "1"]]],
	] as [string, [string, string][]][])("rejects %s", (_label, fields) => {
		expect(parseModerationForm(form(fields))).toBeNull();
	});

	it("rejects more entries than one action may change", () => {
		const fields: [string, string][] = Array.from({ length: 101 }, (_, i) => ["ids", String(i + 1)]);
		expect(parseModerationForm(form([...fields, ["bulk", "hide"]]))).toBeNull();
	});
});

describe("resultParams and describeResult", () => {
	const notice = (
		action: "approve" | "approve-clear" | "hide",
		result: { changed: number[]; unchanged?: number[]; missing?: number[] },
		copies = { sent: 0, failed: 0 }
	) => describeResult(new URLSearchParams(resultParams(action, { unchanged: [], missing: [], ...result }, copies)));

	it("names a single entry", () => {
		expect(notice("hide", { changed: [8] })).toEqual({ text: "Entry #8 hidden.", ok: true });
	});

	it("counts several entries", () => {
		expect(notice("approve", { changed: [1, 2, 3] })).toEqual({ text: "3 entries approved.", ok: true });
	});

	it("reports skipped and missing entries", () => {
		expect(notice("hide", { changed: [1, 2], unchanged: [3], missing: [4, 5] })).toEqual({
			text: "2 entries hidden. 1 was already in that state. 2 no longer exist.",
			ok: false,
		});
	});

	it("says so when nothing changed", () => {
		expect(notice("approve-clear", { changed: [], unchanged: [1, 2] })).toEqual({
			text: "Nothing changed. 2 were already in that state.",
			ok: false,
		});
	});

	it("reports requested copies", () => {
		expect(notice("approve-clear", { changed: [7] }, { sent: 1, failed: 0 })).toEqual({
			text: "Entry #7 approved and flags cleared. 1 requested copy was emailed.",
			ok: true,
		});
		expect(notice("approve", { changed: [1, 2] }, { sent: 0, failed: 2 })).toEqual({
			text: "2 entries approved. 2 requested copies could not be emailed. Check the function logs.",
			ok: false,
		});
	});

	it("returns null without a valid outcome", () => {
		expect(describeResult(params(""))).toBeNull();
		expect(describeResult(params("done=delete&changed=3"))).toBeNull();
	});

	it("explains an empty selection and a failed action", () => {
		expect(describeResult(params("done=none"))).toEqual({
			text: "Nothing was selected. Tick one or more entries first.",
			ok: false,
		});
		expect(describeResult(params("done=error"))?.text).toMatch(/nothing was changed/);
		expect(describeResult(params("done=toString"))).toBeNull();
	});

	it("treats garbage counts as zero", () => {
		expect(describeResult(params("done=hide&changed=lots&entry=x"))).toEqual({ text: "Nothing changed.", ok: false });
	});
});
