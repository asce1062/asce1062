/**
 * Unit tests for email security utilities.
 * sanitizeUrl, sanitizeHeaderValue, parseEmailAddress, sanitizeUserText
 * truncate, wrapText
 *
 * All functions are pure (no I/O, no env vars). No mocking required.
 * These are the last-mile defences before user-supplied data reaches
 * email headers and anchor hrefs.
 * A regression here directly enables email header injection or XSS via email clients.
 */
import { describe, it, expect } from "vitest";
import {
	sanitizeUrl,
	sanitizeHeaderValue,
	parseEmailAddress,
	sanitizeUserText,
	truncate,
	wrapText,
} from "@/config/email-config";

// ---------------------------------------------------------------------------
// sanitizeUrl
// ---------------------------------------------------------------------------

describe("sanitizeUrl", () => {
	it("allows https: URLs", () => {
		expect(sanitizeUrl("https://example.com")).toBe("https://example.com");
	});

	it("allows http: URLs", () => {
		expect(sanitizeUrl("http://example.com")).toBe("http://example.com");
	});

	it("preserves query strings and fragments on valid URLs", () => {
		const url = "https://example.com/path?q=1#anchor";
		expect(sanitizeUrl(url)).toBe(url);
	});

	it("blocks javascript: scheme → undefined", () => {
		expect(sanitizeUrl("javascript:alert(1)")).toBeUndefined();
	});

	it("blocks data: scheme → undefined", () => {
		expect(sanitizeUrl("data:text/html,<h1>hi</h1>")).toBeUndefined();
	});

	it("blocks vbscript: scheme → undefined", () => {
		expect(sanitizeUrl("vbscript:msgbox(1)")).toBeUndefined();
	});

	it("blocks file: scheme → undefined", () => {
		expect(sanitizeUrl("file:///etc/passwd")).toBeUndefined();
	});

	it("returns undefined for a relative path", () => {
		expect(sanitizeUrl("/relative/path")).toBeUndefined();
	});

	it("returns undefined for plain text (URL constructor throws)", () => {
		expect(sanitizeUrl("not-a-url")).toBeUndefined();
	});

	it("returns undefined for empty string", () => {
		expect(sanitizeUrl("")).toBeUndefined();
	});

	it("returns undefined for undefined", () => {
		expect(sanitizeUrl(undefined)).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// sanitizeHeaderValue
// ---------------------------------------------------------------------------

describe("sanitizeHeaderValue", () => {
	it("returns the value unchanged for a clean string", () => {
		expect(sanitizeHeaderValue("Alex Mbugua")).toBe("Alex Mbugua");
	});

	it("strips \\r\\n (CRLF header-injection attempt)", () => {
		const result = sanitizeHeaderValue("name\r\nX-Injected: kizaru");
		expect(result).not.toContain("\r");
		expect(result).not.toContain("\n");
	});

	it("replaces CRLF sequence with a single space (preserves word separation)", () => {
		// /[\r\n]+/g and \r\n is one match → one replacement space
		expect(sanitizeHeaderValue("line1\r\nline2")).toBe("line1 line2");
	});

	it("strips standalone \\n", () => {
		const result = sanitizeHeaderValue("line1\nline2");
		expect(result).not.toContain("\n");
	});

	it("strips standalone \\r", () => {
		const result = sanitizeHeaderValue("line1\rline2");
		expect(result).not.toContain("\r");
	});

	it("truncates to 120 characters", () => {
		const long = "a".repeat(200);
		expect(sanitizeHeaderValue(long)?.length).toBe(120);
	});

	it("does not truncate a string of exactly 120 characters", () => {
		const exact = "a".repeat(120);
		expect(sanitizeHeaderValue(exact)).toBe(exact);
	});

	it("truncates a string of 121 characters to 120", () => {
		const oneOver = "a".repeat(121);
		expect(sanitizeHeaderValue(oneOver)?.length).toBe(120);
	});

	it("returns undefined for empty string", () => {
		expect(sanitizeHeaderValue("")).toBeUndefined();
	});

	it("returns undefined for undefined", () => {
		expect(sanitizeHeaderValue(undefined)).toBeUndefined();
	});

	it("returns undefined for whitespace-only string", () => {
		expect(sanitizeHeaderValue("   ")).toBeUndefined();
	});

	it("returns undefined when the entire string is CRLF (nothing left after strip)", () => {
		expect(sanitizeHeaderValue("\r\n")).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// parseEmailAddress
// ---------------------------------------------------------------------------

describe("parseEmailAddress", () => {
	it("accepts a valid email address", () => {
		expect(parseEmailAddress("user@example.com")).toBe("user@example.com");
	});

	it("accepts plus-addressed email", () => {
		expect(parseEmailAddress("user+tag@example.com")).toBe("user+tag@example.com");
	});

	it("accepts email with subdomain", () => {
		expect(parseEmailAddress("user@mail.example.com")).toBe("user@mail.example.com");
	});

	it("rejects a plain string with no @ sign", () => {
		expect(parseEmailAddress("not-an-email")).toBeUndefined();
	});

	it("rejects a domain with no username", () => {
		expect(parseEmailAddress("@example.com")).toBeUndefined();
	});

	it("rejects email with embedded \\r\\n (header-injection attempt)", () => {
		// After CRLF stripping, "user\r\nX-Injected: kizaru@example.com" → invalid email
		expect(parseEmailAddress("user\r\nX-Injected: kizaru@example.com")).toBeUndefined();
	});

	it("strips \\n before validation. Resulting address is accepted if valid", () => {
		// parseEmailAddress strips \n via replace(/[\r\n]/g, ""), then validates.
		// "user\nextra@example.com" → "userextra@example.com" (valid email → accepted).
		// The \\r\\n CRLF test above covers the injection defense. That combination
		// produces an invalid local-part after stripping. Bare \\n alone results in a
		// validly-structured address post-strip, so the function returns it.
		expect(parseEmailAddress("user\nextra@example.com")).toBe("userextra@example.com");
	});

	it("returns undefined for empty string", () => {
		expect(parseEmailAddress("")).toBeUndefined();
	});

	it("returns undefined for undefined", () => {
		expect(parseEmailAddress(undefined)).toBeUndefined();
	});

	it("returns undefined for whitespace-only string", () => {
		expect(parseEmailAddress("   ")).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// sanitizeUserText
// ---------------------------------------------------------------------------

describe("sanitizeUserText", () => {
	it("removes NUL byte (\\u0000)", () => {
		expect(sanitizeUserText("hello\u0000world")).toBe("helloworld");
	});

	it("removes C0 control chars \\u0001–\\u0008", () => {
		const input = "\u0001\u0002\u0003\u0004\u0005\u0006\u0007\u0008";
		expect(sanitizeUserText(input)).toBe("");
	});

	it("removes \\u000B (vertical tab) and \\u000C (form feed)", () => {
		expect(sanitizeUserText("a\u000Bb\u000Cc")).toBe("abc");
	});

	it("removes C0 control chars \\u000E–\\u001F", () => {
		const input = Array.from({ length: 18 }, (_, i) => String.fromCharCode(0x0e + i)).join("");
		expect(sanitizeUserText(input)).toBe("");
	});

	it("removes DEL (\\u007F)", () => {
		expect(sanitizeUserText("a\u007Fb")).toBe("ab");
	});

	it("removes C1 control chars \\u0080 and \\u009F", () => {
		expect(sanitizeUserText("\u0080\u009F")).toBe("");
	});

	it("preserves \\t (tab) (meaningful in plain-text email)", () => {
		expect(sanitizeUserText("col1\tcol2")).toBe("col1\tcol2");
	});

	it("preserves \\n (newline) (meaningful in plain-text email)", () => {
		expect(sanitizeUserText("line1\nline2")).toBe("line1\nline2");
	});

	it("preserves \\r (carriage return) (meaningful in plain-text email)", () => {
		expect(sanitizeUserText("line\r\n")).toBe("line\r\n");
	});

	it("leaves regular ASCII text unchanged", () => {
		expect(sanitizeUserText("Hello, World!")).toBe("Hello, World!");
	});

	it("preserves Unicode above \\u00A0 (non-ASCII printable)", () => {
		expect(sanitizeUserText("café ✓ 🎉")).toBe("café ✓ 🎉");
	});

	it("handles empty string", () => {
		expect(sanitizeUserText("")).toBe("");
	});
});

// ---------------------------------------------------------------------------
// truncate
// ---------------------------------------------------------------------------

describe("truncate", () => {
	it("returns text unchanged when shorter than max", () => {
		expect(truncate("hello", 10)).toBe("hello");
	});

	it("returns text unchanged when exactly equal to max (boundary: no truncation)", () => {
		expect(truncate("hello", 5)).toBe("hello");
	});

	it("truncates and appends ellipsis when one character over the limit", () => {
		expect(truncate("hello!", 5)).toBe("hello…");
	});

	it("truncates to max characters and appends ellipsis", () => {
		expect(truncate("hello world", 5)).toBe("hello…");
	});

	it("handles max of 0. Returns only the ellipsis", () => {
		expect(truncate("hello", 0)).toBe("…");
	});

	it("handles empty string input", () => {
		expect(truncate("", 10)).toBe("");
	});
});

// ---------------------------------------------------------------------------
// wrapText
// ---------------------------------------------------------------------------

describe("wrapText", () => {
	it("returns short lines unchanged", () => {
		expect(wrapText("a b c")).toBe("a b c");
	});

	it("does not add a newline for a line that fits exactly at the default width (72)", () => {
		const line = "a".repeat(72);
		expect(wrapText(line)).toBe(line);
	});

	it("wraps a long line at the last word boundary before width", () => {
		// 15 words × "word " = 74 chars total (just over the 72-char limit)
		const words = Array(15).fill("word").join(" ");
		const result = wrapText(words, 72);
		const lines = result.split("\n");
		expect(lines.length).toBeGreaterThan(1);
		for (const line of lines) {
			// Every wrapped line must be ≤ 72 chars (single oversized words are exempted)
			expect(line.length).toBeLessThanOrEqual(72);
		}
	});

	it("preserves existing newlines (each line wrapped independently)", () => {
		const text = "Short line\nAnother short line\nThird line";
		expect(wrapText(text)).toBe(text);
	});

	it("wraps each paragraph independently (multi-paragraph text)", () => {
		const long = "word ".repeat(20).trim(); // 99 chars
		const text = `Para one: ${long}\nPara two: ${long}`;
		const result = wrapText(text, 72);
		// Both paragraphs are long and will each produce extra newlines
		expect(result.split("\n").length).toBeGreaterThan(2);
	});

	it("does not break a single word that exceeds the width (emitted as-is)", () => {
		const longWord = "a".repeat(80); // 80 > 72
		expect(wrapText(longWord, 72)).toBe(longWord);
	});

	it("handles empty string", () => {
		expect(wrapText("")).toBe("");
	});

	it("respects a custom width", () => {
		// "ab cd" = 5 chars; with width 3 the first word "ab" (2) + " cd" (3) would exceed 3
		const text = "ab cd ef";
		const result = wrapText(text, 3);
		expect(result).toContain("\n");
	});
});
