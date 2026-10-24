import { describe, expect, it } from "vitest";
import {
	ENTRY_LIMITS,
	ENTRY_STYLE_DEFAULTS,
	normalizeAvatarState,
	parseEntryStyle,
	readGuestbookForm,
	sanitizeEntryUrl,
	serializeEntryStyle,
} from "../guestbook-input";

function form(fields: Record<string, string>): FormData {
	const data = new FormData();
	for (const [key, value] of Object.entries(fields)) data.set(key, value);
	return data;
}

describe("sanitizeEntryUrl", () => {
	it("keeps http and https URLs in normalized form", () => {
		expect(sanitizeEntryUrl(" https://example.com/a b ")).toBe("https://example.com/a%20b");
		expect(sanitizeEntryUrl("http://example.com")).toBe("http://example.com/");
	});

	it.each(["javascript:alert(1)", "JAVASCRIPT:alert(1)", "data:text/html,<b>x</b>", "vbscript:x", "ftp://example.com"])(
		"rejects non-http(s) scheme %s",
		(url) => {
			expect(sanitizeEntryUrl(url)).toBeNull();
		}
	);

	it("strips embedded newlines so text emails cannot gain forged lines", () => {
		expect(sanitizeEntryUrl("https://a.com/x\nStatus: VISIBLE")).toBe("https://a.com/xStatus:%20VISIBLE");
		expect(sanitizeEntryUrl("https://a.com\nStatus: VISIBLE")).toBeNull();
	});

	it("rejects empty, unparseable and oversized input", () => {
		expect(sanitizeEntryUrl("")).toBeNull();
		expect(sanitizeEntryUrl(null)).toBeNull();
		expect(sanitizeEntryUrl("not a url")).toBeNull();
		expect(sanitizeEntryUrl(`https://example.com/${"a".repeat(ENTRY_LIMITS.url)}`)).toBeNull();
	});
});

describe("parseEntryStyle", () => {
	it("keeps values the customizer can produce", () => {
		const style = {
			bg: "bamboo",
			borderColor: "accent",
			borderWidth: "2.5px",
			borderStyle: "dashed",
			borderRadius: "1rem",
		};
		expect(parseEntryStyle(JSON.stringify(style))).toEqual(style);
		expect(parseEntryStyle(JSON.stringify({ ...style, bg: "none" })).bg).toBe("none");
	});

	it("replaces injected CSS with defaults field by field", () => {
		const parsed = parseEntryStyle(
			JSON.stringify({
				bg: "x);background:url(https://evil/x",
				borderColor: "primary);position:fixed",
				borderWidth: "1px;position:fixed;inset:0",
				borderStyle: "solid;z-index:99999",
				borderRadius: "0.25rem;background:red",
			})
		);
		expect(parsed).toEqual(ENTRY_STYLE_DEFAULTS);
	});

	it("ignores prototype keys and non-object JSON", () => {
		expect(parseEntryStyle(JSON.stringify({ borderColor: "constructor" })).borderColor).toBe(
			ENTRY_STYLE_DEFAULTS.borderColor
		);
		expect(parseEntryStyle("[1,2]")).toEqual(ENTRY_STYLE_DEFAULTS);
		expect(parseEntryStyle("null")).toEqual(ENTRY_STYLE_DEFAULTS);
		expect(parseEntryStyle("{not json")).toEqual(ENTRY_STYLE_DEFAULTS);
		expect(parseEntryStyle(null)).toEqual(ENTRY_STYLE_DEFAULTS);
	});

	it("round-trips through serializeEntryStyle with only known keys", () => {
		const json = serializeEntryStyle(parseEntryStyle(JSON.stringify({ bg: "bamboo", extra: "x" })));
		expect(Object.keys(JSON.parse(json)).sort()).toEqual([
			"bg",
			"borderColor",
			"borderRadius",
			"borderStyle",
			"borderWidth",
		]);
	});
});

describe("normalizeAvatarState", () => {
	it("re-serializes a valid state and rejects anything else", () => {
		expect(normalizeAvatarState("gender=male&avatar=1-1-1-1-1-1")).toMatch(/^gender=male&avatar=[\d-]+$/);
		expect(normalizeAvatarState("gender=male%26x=1&avatar=1")).toBeNull();
		expect(normalizeAvatarState("")).toBeNull();
		expect(normalizeAvatarState(null)).toBeNull();
	});
});

describe("readGuestbookForm", () => {
	it("coerces missing optional fields instead of throwing", () => {
		const fields = readGuestbookForm(form({ name: "Ada", message: "Hi" }));
		expect(fields.email).toBe("");
		expect(fields.url).toBeNull();
		expect(fields.style).toBeNull();
		expect(fields.avatarState).toBeNull();
		expect(fields.isSubmittable).toBe(true);
	});

	it("trims email and drops oversized optional fields", () => {
		const fields = readGuestbookForm(
			form({
				name: "Ada",
				message: "Hi",
				email: " ada@example.com ",
				url: `https://example.com/${"a".repeat(ENTRY_LIMITS.url)}`,
			})
		);
		expect(fields.email).toBe("ada@example.com");
		expect(fields.url).toBeNull();
		expect(readGuestbookForm(form({ name: "Ada", message: "Hi", email: `${"a".repeat(250)}@b.co` })).email).toBe("");
	});

	it("is not submittable when name or message is missing, blank or over the limit", () => {
		expect(readGuestbookForm(form({ message: "Hi" })).isSubmittable).toBe(false);
		expect(readGuestbookForm(form({ name: "  ", message: "Hi" })).isSubmittable).toBe(false);
		expect(readGuestbookForm(form({ name: "a".repeat(ENTRY_LIMITS.name + 1), message: "Hi" })).isSubmittable).toBe(
			false
		);
		expect(readGuestbookForm(form({ name: "Ada", message: "a".repeat(ENTRY_LIMITS.message + 1) })).isSubmittable).toBe(
			false
		);
	});

	it("is not submittable when the honeypot is filled", () => {
		expect(readGuestbookForm(form({ name: "Ada", message: "Hi", "bot-field": "x" })).isSubmittable).toBe(false);
	});

	it("only keeps the avatar state when the submitter opted in", () => {
		const state = "gender=male&avatar=1-1-1-1-1-1";
		expect(readGuestbookForm(form({ name: "Ada", message: "Hi", avatarState: state })).avatarState).toBeNull();
		expect(
			readGuestbookForm(form({ name: "Ada", message: "Hi", avatarState: state, avatarOptIn: "on" })).avatarState
		).not.toBeNull();
	});
});
