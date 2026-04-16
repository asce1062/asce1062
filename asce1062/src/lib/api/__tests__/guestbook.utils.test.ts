/**
 * Unit tests for guestbook utility functions.
 * hashValue, safeParseReasons, assertStatus
 *
 * `hashValue` is security-sensitive: it determines whether duplicate
 * detection works correctly. The SHA-256 output must be stable (same input
 * → same hash) and always 64 hex characters. A regression here silently
 * breaks dedup and rate-limiting in the guestbook.
 *
 * `astro:db` is a Vite virtual module. It must be mocked before any import
 * from guestbook.ts so Vitest can resolve the module.
 */
import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("astro:db", () => ({
	db: {
		select: vi.fn(),
		insert: vi.fn(),
		update: vi.fn(),
		delete: vi.fn(),
	},
	Guestbook: {},
	eq: vi.fn(),
	and: vi.fn(),
	gt: vi.fn(),
	sql: vi.fn(),
}));

import { hashValue, safeParseReasons, assertStatus } from "@/lib/api/guestbook";

// ---------------------------------------------------------------------------
// hashValue
// ---------------------------------------------------------------------------

describe("hashValue", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("returns a 64-character hex string", async () => {
		const result = await hashValue("test-input");
		expect(result).toHaveLength(64);
		expect(result).toMatch(/^[0-9a-f]{64}$/);
	});

	it("is stable: same input always produces the same output (determinism)", async () => {
		const a = await hashValue("alice");
		const b = await hashValue("alice");
		expect(a).toBe(b);
	});

	it("produces different hashes for different inputs (collision resistance)", async () => {
		const a = await hashValue("alice");
		const b = await hashValue("bob");
		expect(a).not.toBe(b);
	});

	it("is case-sensitive: 'Alice' and 'alice' produce different hashes", async () => {
		const a = await hashValue("Alice");
		const b = await hashValue("alice");
		expect(a).not.toBe(b);
	});

	it("uses a default pepper when GUESTBOOK_HASH_PEPPER is not set outside production", async () => {
		vi.stubEnv("PROD", false);
		// No env stub → falls back to 'guestbook-default-pepper'
		const result = await hashValue("input");
		expect(result).toHaveLength(64);
		expect(result).toMatch(/^[0-9a-f]{64}$/);
	});

	it("uses a custom pepper from GUESTBOOK_HASH_PEPPER when set", async () => {
		vi.stubEnv("GUESTBOOK_HASH_PEPPER", "custom-pepper-123");
		const withCustomPepper = await hashValue("input");
		// Without stub: uses default pepper
		vi.unstubAllEnvs();
		vi.stubEnv("PROD", false);
		const withDefaultPepper = await hashValue("input");
		// Different peppers → different hashes for the same input
		expect(withCustomPepper).not.toBe(withDefaultPepper);
	});

	it("custom pepper hashes are still 64-char hex", async () => {
		vi.stubEnv("GUESTBOOK_HASH_PEPPER", "my-pepper");
		const result = await hashValue("hello");
		expect(result).toHaveLength(64);
		expect(result).toMatch(/^[0-9a-f]{64}$/);
	});

	it("throws in production when GUESTBOOK_HASH_PEPPER is missing", async () => {
		vi.stubEnv("PROD", true);
		await expect(hashValue("input")).rejects.toThrow("GUESTBOOK_HASH_PEPPER is required in production");
	});

	it("hashes an empty string without throwing", async () => {
		const result = await hashValue("");
		expect(result).toHaveLength(64);
		expect(result).toMatch(/^[0-9a-f]{64}$/);
	});

	it("hashes a very long string without throwing", async () => {
		const result = await hashValue("a".repeat(10_000));
		expect(result).toHaveLength(64);
	});

	it("never returns null or undefined (always a string)", async () => {
		const result = await hashValue("anything");
		expect(result).not.toBeNull();
		expect(result).not.toBeUndefined();
		expect(typeof result).toBe("string");
	});
});

// ---------------------------------------------------------------------------
// safeParseReasons
// ---------------------------------------------------------------------------

describe("safeParseReasons", () => {
	it("returns empty array for null", () => {
		expect(safeParseReasons(null)).toEqual([]);
	});

	it("returns empty array for empty string", () => {
		expect(safeParseReasons("")).toEqual([]);
	});

	it("returns empty array for invalid JSON", () => {
		expect(safeParseReasons("not-json")).toEqual([]);
	});

	it("returns empty array for malformed JSON", () => {
		expect(safeParseReasons("{broken:")).toEqual([]);
	});

	it("returns empty array when JSON is a non-array value (string)", () => {
		expect(safeParseReasons('"just-a-string"')).toEqual([]);
	});

	it("returns empty array when JSON is a non-array value (number)", () => {
		expect(safeParseReasons("42")).toEqual([]);
	});

	it("returns empty array when JSON is a non-array value (object)", () => {
		expect(safeParseReasons('{"key":"value"}')).toEqual([]);
	});

	it("returns empty array when JSON is null literal", () => {
		expect(safeParseReasons("null")).toEqual([]);
	});

	it("parses a valid string array", () => {
		expect(safeParseReasons('["link_only","multiple_urls"]')).toEqual(["link_only", "multiple_urls"]);
	});

	it("parses an array with a single element", () => {
		expect(safeParseReasons('["spam_phrase"]')).toEqual(["spam_phrase"]);
	});

	it("returns an empty array for an empty JSON array", () => {
		expect(safeParseReasons("[]")).toEqual([]);
	});

	it("filters out non-string elements from a mixed array", () => {
		// Only string elements are kept, numbers and objects are filtered out
		expect(safeParseReasons('["link_only", 42, null, {"x":1}, "html_tag"]')).toEqual(["link_only", "html_tag"]);
	});

	it("filters out an array containing only non-string elements", () => {
		expect(safeParseReasons("[1, 2, 3]")).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// assertStatus
// ---------------------------------------------------------------------------

describe("assertStatus", () => {
	it("does not throw for 'visible'", () => {
		expect(() => assertStatus("visible")).not.toThrow();
	});

	it("does not throw for 'pending'", () => {
		expect(() => assertStatus("pending")).not.toThrow();
	});

	it("does not throw for 'hidden'", () => {
		expect(() => assertStatus("hidden")).not.toThrow();
	});

	it("throws for an unknown status string", () => {
		expect(() => assertStatus("approved")).toThrow(/invalid status/i);
	});

	it("throws for empty string", () => {
		expect(() => assertStatus("")).toThrow(/invalid status/i);
	});

	it("throws for a numeric string", () => {
		expect(() => assertStatus("0")).toThrow(/invalid status/i);
	});

	it("is case-sensitive: 'Visible' is not valid", () => {
		expect(() => assertStatus("Visible")).toThrow(/invalid status/i);
	});

	it("is case-sensitive: 'HIDDEN' is not valid", () => {
		expect(() => assertStatus("HIDDEN")).toThrow(/invalid status/i);
	});

	it("throws for a whitespace-padded valid status", () => {
		expect(() => assertStatus(" visible ")).toThrow(/invalid status/i);
	});

	it("error message includes the invalid value", () => {
		expect(() => assertStatus("bogus")).toThrow("bogus");
	});
});
