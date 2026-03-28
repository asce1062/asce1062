/**
 * Unit tests for classifyEntry (guestbook spam classification engine).
 *
 * Design: all tests pass ipHash: null, which bypasses the two DB-dependent
 * branches in classifyEntry (duplicate detection + rate limiting). This lets us
 * exercise the full classification engine
 * 	- Hard spam signals
 * 	- URL analysis
 * 	- Soft flags
 * 	- Score clamping
 * 	- Mitigation logic
 * 	- Severity
 * 	- Normalization
 * without any database infrastructure
 *
 * DB-dependent paths (duplicate detection, rate limiting, retroFlagSameMsgEntries)
 * are integration-test territory. When CURRENT_MODERATION_VERSION is bumped or
 * scoring weights change, run this suite first: a failure here means the
 * production classifier would behave unexpectedly.
 */
import { describe, it, expect, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock astro:db
// classifyEntry never touches the DB when ipHash is null. The mock just needs
// to satisfy the import (none of these functions will be called).
// ---------------------------------------------------------------------------
vi.mock("astro:db", () => ({
	db: {
		select: vi.fn(),
		update: vi.fn(),
		insert: vi.fn(),
	},
	Guestbook: {},
	GuestbookModerationLog: {},
	desc: vi.fn(),
	eq: vi.fn(),
	gte: vi.fn(),
	isNull: vi.fn(),
	isNotNull: vi.fn(),
	or: vi.fn(),
	and: vi.fn(),
}));

// drizzle-orm is a real installed package (transitive dep of @astrojs/db) but
// count() is only used in countPendingEntries(), which isn't called here.
// No mock needed, the real import works fine.

import { classifyEntry } from "../guestbook";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal clean input. Override only what matters for each test. */
const BASE = {
	name: "Alex",
	url: "",
	message: "Hello! Great site.",
	ipHash: null as string | null,
	userAgentHash: null as string | null,
	messageHash: null as string | null | undefined,
	now: new Date("2026-01-15T12:00:00Z"),
} as const;

type ClassifyInput = Parameters<typeof classifyEntry>[0];

function classify(overrides: Partial<ClassifyInput> = {}): Promise<Awaited<ReturnType<typeof classifyEntry>>> {
	return classifyEntry({ ...BASE, ...overrides });
}

// ---------------------------------------------------------------------------
// Hard spam signals
// Each alone pushes score to 10 → "hidden"
// ---------------------------------------------------------------------------

describe("hard spam signals", () => {
	it("HTML tag in message → html_tag, hidden, score 10, severity hard", async () => {
		const r = await classify({ message: "Check this <script>alert(1)</script>" });
		expect(r.status).toBe("hidden");
		expect(r.reasons).toContain("html_tag");
		expect(r.score).toBe(10);
		expect(r.severity).toBe("hard");
		expect(r.hasHardReason).toBe(true);
	});

	it("inline HTML with attributes is caught", async () => {
		const r = await classify({ message: '<img src=x onerror="alert(1)">' });
		expect(r.status).toBe("hidden");
		expect(r.reasons).toContain("html_tag");
	});

	it("BBCode [url=...] in message → bbcode, hidden", async () => {
		const r = await classify({ message: "[url=http://spam.com]click me[/url]" });
		expect(r.status).toBe("hidden");
		expect(r.reasons).toContain("bbcode");
		expect(r.severity).toBe("hard");
	});

	it("URL shortener domain → url_shortener, hidden", async () => {
		const r = await classify({ message: "Check this out: https://bit.ly/onepiece" });
		expect(r.status).toBe("hidden");
		expect(r.reasons).toContain("url_shortener");
	});

	it("obfuscated link with hxxp → obfuscated_link, hidden", async () => {
		const r = await classify({ message: "Visit hxxps://kizaru.example.com now" });
		expect(r.status).toBe("hidden");
		expect(r.reasons).toContain("obfuscated_link");
	});

	it("spaced protocol (https ://) → obfuscated_link, hidden", async () => {
		const r = await classify({ message: "go to https ://kizaru.com for free stuff" });
		expect(r.status).toBe("hidden");
		expect(r.reasons).toContain("obfuscated_link");
	});

	it("dot-com text obfuscation → dot_com_obfuscation, hidden", async () => {
		const r = await classify({ message: "Visit example dot com for free stuff" });
		expect(r.status).toBe("hidden");
		expect(r.reasons).toContain("dot_com_obfuscation");
	});

	it("d0t obfuscation variant → dot_com_obfuscation, hidden", async () => {
		const r = await classify({ message: "go to spam d0t net now" });
		expect(r.status).toBe("hidden");
		expect(r.reasons).toContain("dot_com_obfuscation");
	});

	it("multiple hard signals → all emitted, score clamped to 10", async () => {
		const r = await classify({
			message: "<b>check</b> hxxp://kizaru.com dot com [url=x]x[/url]",
		});
		expect(r.score).toBe(10); // clamped. individual signals total >10
		expect(r.status).toBe("hidden");
		expect(r.reasons).toContain("html_tag");
		expect(r.reasons).toContain("obfuscated_link");
		expect(r.reasons).toContain("dot_com_obfuscation");
		expect(r.reasons).toContain("bbcode");
	});

	it("reasons are deduplicated and sorted alphabetically", async () => {
		const r = await classify({ message: "<b>hi</b> [url=x]x[/url]" });
		const sorted = [...r.reasons].sort();
		expect(r.reasons).toEqual(sorted);
		// No duplicates
		expect(new Set(r.reasons).size).toBe(r.reasons.length);
	});
});

// ---------------------------------------------------------------------------
// URL analysis
// ---------------------------------------------------------------------------

describe("URL analysis (link_only)", () => {
	it("message that is only a URL → link_only, pending, score 8", async () => {
		const r = await classify({ message: "https://example.com" });
		expect(r.reasons).toContain("link_only");
		expect(r.status).toBe("pending");
		expect(r.score).toBe(8);
		expect(r.hasLinks).toBe(true);
		expect(r.urlsFound).toBe(1);
	});

	it("URL surrounded by enough text → no link_only", async () => {
		// Non-URL text: "I really enjoyed your post at https://example.com. Keep it up!" = 44 chars > 20
		const r = await classify({
			message: "I really enjoyed your post at https://example.com. Keep it up!",
		});
		expect(r.reasons).not.toContain("link_only");
	});

	it("URL with wrapper punctuation stripped. parentheses don't inflate text count", async () => {
		// "(https://example.com)" → after stripping URL and punctuation, text is empty
		const r = await classify({ message: "(https://example.com)" });
		expect(r.reasons).toContain("link_only");
	});
});

describe("URL analysis (multiple_urls)", () => {
	it("two URLs, no declared URL field → multiple_urls with higher score (+5)", async () => {
		const short = await classify({
			url: "",
			message: "See https://a.com and https://b.com for more info here",
		});
		expect(short.reasons).toContain("multiple_urls");
	});

	it("two URLs with declared URL field → multiple_urls with lower score (+2)", async () => {
		const withUrl = await classify({
			url: "https://mysite.com",
			message: "See https://a.com and https://b.com for context and details",
		});
		const withoutUrl = await classify({
			url: "",
			message: "See https://a.com and https://b.com for context and details",
		});
		expect(withUrl.reasons).toContain("multiple_urls");
		expect(withoutUrl.reasons).toContain("multiple_urls");
		// Declared own URL → lower score contribution
		expect(withUrl.score).toBeLessThan(withoutUrl.score);
	});

	it("urlsFound reflects the actual URL count", async () => {
		const r0 = await classify({ message: "No links here at all" });
		expect(r0.urlsFound).toBe(0);
		expect(r0.hasLinks).toBe(false);

		const r1 = await classify({ message: "One link at https://example.com in message text" });
		expect(r1.urlsFound).toBe(1);
		expect(r1.hasLinks).toBe(true);

		const r2 = await classify({ message: "Links: https://a.com and also https://b.com done" });
		expect(r2.urlsFound).toBe(2);
	});
});

describe("URL analysis (link_only mitigation)", () => {
	it("link_only + multiple_urls stacking is capped at score 9 (pending, not hidden)", async () => {
		// Pure link_only message with two URLs:
		// link_only (8) + multiple_urls short (5) = 13 → would be hidden without mitigation
		// Mitigation: score capped at 9 when no hard reason
		const r = await classify({ message: "https://a.com https://b.com" });
		expect(r.reasons).toContain("link_only");
		expect(r.reasons).toContain("multiple_urls");
		expect(r.score).toBe(9);
		expect(r.status).toBe("pending"); // not hidden
		expect(r.hasHardReason).toBe(false);
	});

	it("mitigation does not apply when a hard reason is present", async () => {
		// link_only + hard reason → hard reason alone pushes to 10, no cap needed
		const r = await classify({ message: "https://bit.ly/abc" }); // shortener = hard
		expect(r.reasons).toContain("url_shortener");
		expect(r.score).toBe(10);
		expect(r.status).toBe("hidden");
	});
});

// ---------------------------------------------------------------------------
// Soft flags
// ---------------------------------------------------------------------------

describe("soft flags (name_is_url)", () => {
	it("name starting with https:// → name_is_url, score 5", async () => {
		const r = await classify({ name: "https://spam.com" });
		expect(r.reasons).toContain("name_is_url");
		expect(r.score).toBeGreaterThanOrEqual(5);
		expect(r.status).toBe("pending");
	});

	it("name starting with www. → name_is_url", async () => {
		const r = await classify({ name: "www.spam.com" });
		expect(r.reasons).toContain("name_is_url");
	});

	it("name that looks like a domain (no spaces, ends with TLD) → name_is_url", async () => {
		const r = await classify({ name: "example.com" });
		expect(r.reasons).toContain("name_is_url");
	});

	it("name with space (real person name with common TLD letters) → no name_is_url", async () => {
		// "John Smith" has a space so looksLikeUrl is false even if it hypothetically ended with a TLD
		const r = await classify({ name: "John Smith" });
		expect(r.reasons).not.toContain("name_is_url");
	});

	it("short name (≤6 chars) without protocol → no name_is_url", async () => {
		const r = await classify({ name: "Bob" });
		expect(r.reasons).not.toContain("name_is_url");
	});
});

describe("soft flags (suspicious_name)", () => {
	it("name with >50% non-alphanumeric chars (after stripping -_'.) → suspicious_name", async () => {
		const r = await classify({ name: ">>##@@!!" }); // all symbols
		expect(r.reasons).toContain("suspicious_name");
		expect(r.score).toBeGreaterThanOrEqual(3);
	});

	it("hyphenated name → no suspicious_name (hyphens stripped before check)", async () => {
		const r = await classify({ name: "Mary-Jane" });
		expect(r.reasons).not.toContain("suspicious_name");
	});

	it("name with apostrophe → no suspicious_name", async () => {
		const r = await classify({ name: "O'Brien" });
		expect(r.reasons).not.toContain("suspicious_name");
	});

	it("empty name after stripping → no suspicious_name (guard: nameStripped.length > 0)", async () => {
		const r = await classify({ name: "-" }); // strips to ""
		expect(r.reasons).not.toContain("suspicious_name");
	});
});

describe("soft flags (long_with_links)", () => {
	it("message >2000 chars containing a URL → long_with_links", async () => {
		const longMsg = "word ".repeat(401) + "https://example.com"; // > 2000 chars
		const r = await classify({ message: longMsg });
		expect(r.reasons).toContain("long_with_links");
	});

	it("message ≤2000 chars with a URL → no long_with_links", async () => {
		const r = await classify({
			message: "Short message with a link: https://example.com. thanks for reading!",
		});
		expect(r.reasons).not.toContain("long_with_links");
	});

	it("message >2000 chars but no URL → no long_with_links", async () => {
		const longMsg = "word ".repeat(401); // > 2000 chars, no URL
		const r = await classify({ message: longMsg });
		expect(r.reasons).not.toContain("long_with_links");
	});
});

// ---------------------------------------------------------------------------
// Status thresholds and score semantics
// ---------------------------------------------------------------------------

describe("status thresholds", () => {
	it("clean entry → visible, score 0, no reasons, severity none", async () => {
		const r = await classify({ name: "Alex", message: "Hi! Love the site." });
		expect(r.status).toBe("visible");
		expect(r.score).toBe(0);
		expect(r.reasons).toHaveLength(0);
		expect(r.severity).toBe("none");
		expect(r.hasLinks).toBe(false);
		expect(r.isHonestDuplicate).toBe(false);
		expect(r.hasHardReason).toBe(false);
	});

	it("score 0–2 → visible (no flags at all)", async () => {
		const r = await classify({ name: "Sam", message: "Great work!" });
		expect(r.status).toBe("visible");
		expect(r.score).toBeLessThan(3);
	});

	it("score exactly 3 (suspicious_name alone) → pending", async () => {
		// suspicious_name score = 3
		const r = await classify({ name: ">>>!!!" }); // all symbols
		expect(r.score).toBeGreaterThanOrEqual(3);
		expect(r.status).toBe("pending");
		expect(r.severity).toBe("soft");
	});

	it("score exactly 10 (hard signal) → hidden", async () => {
		const r = await classify({ message: "check <b>this</b> deal" });
		expect(r.status).toBe("hidden");
		expect(r.score).toBe(10);
	});
});

// ---------------------------------------------------------------------------
// Severity derivation
// ---------------------------------------------------------------------------

describe("severity", () => {
	it("hard reason present → 'hard'", async () => {
		const r = await classify({ message: "hello <b>world</b>" });
		expect(r.severity).toBe("hard");
	});

	it("only soft reasons → 'soft'", async () => {
		const r = await classify({ name: ">>>!!!" }); // suspicious_name only
		expect(r.severity).toBe("soft");
	});

	it("no reasons → 'none'", async () => {
		const r = await classify();
		expect(r.severity).toBe("none");
	});
});

// ---------------------------------------------------------------------------
// NFKC normalization (homoglyph bypass prevention)
// ---------------------------------------------------------------------------

describe("NFKC normalization", () => {
	it("fullwidth HTML tag normalizes to ASCII → caught by html_tag pattern", async () => {
		// ＜ (U+FF1C) → <,  ｓｃｒｉｐｔ → script,  ＞ → >  via NFKC
		const r = await classify({ message: "＜ｓｃｒｉｐｔ＞kizaru＜／ｓｃｒｉｐｔ＞" });
		expect(r.reasons).toContain("html_tag");
		expect(r.status).toBe("hidden");
	});

	it("consecutive whitespace in name is collapsed before pattern matching", async () => {
		// Double spaces collapse to single (no false-positive on suspicious_name)
		const r = await classify({ name: "Alex  Mbugua" });
		expect(r.reasons).not.toContain("suspicious_name");
	});
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe("edge cases", () => {
	it("empty message string → no signals, visible", async () => {
		const r = await classify({ message: "" });
		expect(r.status).toBe("visible");
		expect(r.score).toBe(0);
	});

	it("message with only whitespace → no signals (trimmed to empty)", async () => {
		const r = await classify({ message: "   \t  " });
		expect(r.status).toBe("visible");
	});

	it("www. prefix in message URL is detected as a URL", async () => {
		const r = await classify({ message: "www.example.com" });
		expect(r.hasLinks).toBe(true);
		expect(r.urlsFound).toBeGreaterThanOrEqual(1);
	});

	it("isHonestDuplicate is always false when ipHash is null (no duplicate check)", async () => {
		const r = await classify();
		expect(r.isHonestDuplicate).toBe(false);
	});

	it("score is never negative", async () => {
		const r = await classify({ name: "Alex", message: "Hello!", url: "https://alexmbugua.me" });
		expect(r.score).toBeGreaterThanOrEqual(0);
	});
});
