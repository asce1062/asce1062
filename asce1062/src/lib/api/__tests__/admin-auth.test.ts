/**
 * Unit tests for admin authentication utilities.
 * isValidToken (timing-safe), checkPostOrigin (CSRF)
 * checkAdminAuth (clean URL token upgrade), cookie option consistency
 *
 * These are the primary guards against admin session compromise. A regression
 * in timing-safe comparison silently downgrades to a timing oracle; a
 * regression in CSRF validation opens cross-origin POST as an attack surface.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { AstroCookies } from "astro";
import { isValidToken, checkPostOrigin, checkAdminAuth, setAdminCookie, deleteAdminCookie } from "@/lib/api/admin-auth";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Minimal AstroCookies mock. Only the methods used by admin-auth are implemented. */
function makeCookies(tokenValue?: string): AstroCookies {
	return {
		get: vi.fn((name: string) => (name === "admin_token" && tokenValue ? { value: tokenValue } : undefined)),
		set: vi.fn(),
		delete: vi.fn(),
		has: vi.fn(),
		headers: vi.fn(),
	} as unknown as AstroCookies;
}

function makeRequest(
	url: string,
	options?: { method?: string; origin?: string | null; referer?: string | null }
): Request {
	const headers = new Headers();
	if (options?.origin != null) headers.set("origin", options.origin);
	if (options?.referer != null) headers.set("referer", options.referer);
	return new Request(url, { method: options?.method ?? "GET", headers });
}

const SITE_URL = "https://alexmbugua.me";
const ADMIN_URL = `${SITE_URL}/admin`;

// ---------------------------------------------------------------------------
// isValidToken
// ---------------------------------------------------------------------------

describe("isValidToken", () => {
	beforeEach(() => {
		vi.stubEnv("ADMIN_TOKEN", "super-secret-token");
	});

	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("returns true for the correct token", () => {
		expect(isValidToken("super-secret-token")).toBe(true);
	});

	it("returns false for a wrong token of the same length", () => {
		// Same length as "super-secret-token" (18) but wrong content
		expect(isValidToken("super-secret-WRONG")).toBe(false);
	});

	it("returns false for a wrong token of different length", () => {
		expect(isValidToken("wrong-token")).toBe(false);
	});

	it("returns false for undefined", () => {
		expect(isValidToken(undefined)).toBe(false);
	});

	it("returns false for empty string", () => {
		expect(isValidToken("")).toBe(false);
	});

	it("returns false when ADMIN_TOKEN env is empty (not configured)", () => {
		vi.unstubAllEnvs();
		vi.stubEnv("ADMIN_TOKEN", "");
		expect(isValidToken("super-secret-token")).toBe(false);
	});

	it("strips \\r\\n from candidate before comparison (sanitizeToken)", () => {
		// Token with appended CRLF still matches after sanitization
		expect(isValidToken("super-secret-token\r\n")).toBe(true);
	});

	it("strips \\n from candidate", () => {
		expect(isValidToken("super-secret-token\n")).toBe(true);
	});

	it("token that splits across CRLF and reconstructs the valid token still matches", () => {
		// "super-sec" + "\r\n" + "ret-token" → strip CR+LF → "super-sec"+"ret-token" = "super-secret-token"
		// sec + ret = secret, the CRLF strip accidentally reconstructs the valid token.
		// This is expected: sanitizeToken removes CR/LF bytes, not a semantic guard.
		expect(isValidToken("super-sec\r\nret-token")).toBe(true);
	});

	it("token with CRLF that does NOT reconstruct the valid token does not match", () => {
		// "super-sec\r\nWRONG-token" → "super-secWRONG-token" ≠ "super-secret-token"
		expect(isValidToken("super-sec\r\nWRONG-token")).toBe(false);
	});

	it("truncates candidate to 256 characters before comparison", () => {
		// A 257-char string starting with the correct token is truncated to 256,
		// which no longer matches "super-secret-token" (18 chars)
		expect(isValidToken("super-secret-token" + "x".repeat(239))).toBe(false);
	});

	it("a very long wrong token does not match (timing-safe: still returns false)", () => {
		expect(isValidToken("a".repeat(300))).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// checkPostOrigin
// ---------------------------------------------------------------------------

describe("checkPostOrigin", () => {
	it("returns true for GET request (no check needed)", () => {
		expect(checkPostOrigin(makeRequest(ADMIN_URL, { method: "GET" }))).toBe(true);
	});

	it("returns true for HEAD request", () => {
		expect(checkPostOrigin(makeRequest(ADMIN_URL, { method: "HEAD" }))).toBe(true);
	});

	it("returns true for POST from the same origin", () => {
		expect(checkPostOrigin(makeRequest(ADMIN_URL, { method: "POST", origin: SITE_URL }))).toBe(true);
	});

	it("returns false for POST from a different origin", () => {
		expect(checkPostOrigin(makeRequest(ADMIN_URL, { method: "POST", origin: "https://kizaru.example.com" }))).toBe(
			false
		);
	});

	it('returns false when Origin is the string "null" (sandboxed iframe)', () => {
		expect(checkPostOrigin(makeRequest(ADMIN_URL, { method: "POST", origin: "null" }))).toBe(false);
	});

	it("falls back to Referer when Origin is absent (same-origin Referer → true)", () => {
		expect(checkPostOrigin(makeRequest(ADMIN_URL, { method: "POST", referer: `${ADMIN_URL}/login` }))).toBe(true);
	});

	it("falls back to Referer when cross-origin Referer → false", () => {
		expect(
			checkPostOrigin(makeRequest(ADMIN_URL, { method: "POST", referer: "https://kizaru.example.com/form" }))
		).toBe(false);
	});

	it("returns false for POST with no Origin and no Referer", () => {
		expect(checkPostOrigin(makeRequest(ADMIN_URL, { method: "POST" }))).toBe(false);
	});

	it("returns false for POST with a malformed Referer URL (URL constructor throws)", () => {
		expect(checkPostOrigin(makeRequest(ADMIN_URL, { method: "POST", referer: "not-a-valid-url" }))).toBe(false);
	});

	it("Origin takes precedence over Referer when both are present", () => {
		// Same-origin Origin + cross-origin Referer → true (Origin wins)
		const req = new Request(ADMIN_URL, {
			method: "POST",
			headers: {
				origin: SITE_URL,
				referer: "https://kizaru.example.com/form",
			},
		});
		expect(checkPostOrigin(req)).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// checkAdminAuth (token upgrade / clean URL)
// ---------------------------------------------------------------------------

describe("checkAdminAuth", () => {
	beforeEach(() => {
		vi.stubEnv("ADMIN_TOKEN", "valid-token");
	});

	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("returns ok:true + fromQuery:true when token is in the query string", () => {
		const request = makeRequest(`${ADMIN_URL}?token=valid-token`);
		const result = checkAdminAuth(request, makeCookies());
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.fromQuery).toBe(true);
	});

	it("cleanUrl has the token parameter removed (critical: token must not persist in URL)", () => {
		const request = makeRequest(`${ADMIN_URL}?token=valid-token`);
		const result = checkAdminAuth(request, makeCookies());
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.cleanUrl).not.toContain("token=");
		}
	});

	it("cleanUrl retains unrelated query parameters when stripping the token", () => {
		const request = makeRequest(`${ADMIN_URL}?token=valid-token&page=2&filter=pending`);
		const result = checkAdminAuth(request, makeCookies());
		expect(result.ok).toBe(true);
		if (result.ok) {
			const url = new URL(result.cleanUrl);
			expect(url.searchParams.get("page")).toBe("2");
			expect(url.searchParams.get("filter")).toBe("pending");
			expect(url.searchParams.has("token")).toBe(false);
		}
	});

	it("returns ok:true + fromQuery:false when token comes from the cookie", () => {
		const request = makeRequest(ADMIN_URL);
		const result = checkAdminAuth(request, makeCookies("valid-token"));
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.fromQuery).toBe(false);
	});

	it("query token takes precedence over cookie when both are present", () => {
		const request = makeRequest(`${ADMIN_URL}?token=valid-token`);
		const result = checkAdminAuth(request, makeCookies("valid-token"));
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.fromQuery).toBe(true);
	});

	it("returns ok:false when there is no token anywhere", () => {
		expect(checkAdminAuth(makeRequest(ADMIN_URL), makeCookies()).ok).toBe(false);
	});

	it("returns ok:false when the query token is wrong", () => {
		expect(checkAdminAuth(makeRequest(`${ADMIN_URL}?token=wrong`), makeCookies()).ok).toBe(false);
	});

	it("returns ok:false when the cookie token is wrong", () => {
		expect(checkAdminAuth(makeRequest(ADMIN_URL), makeCookies("wrong")).ok).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// setAdminCookie / deleteAdminCookie (cookie option consistency)
// ---------------------------------------------------------------------------

describe("setAdminCookie", () => {
	it("calls cookies.set with the admin_token name", () => {
		const cookies = makeCookies();
		setAdminCookie(cookies, "my-token");
		expect(cookies.set).toHaveBeenCalledWith("admin_token", expect.any(String), expect.any(Object));
	});

	it("strips \\r\\n from the token before storing (sanitizeToken)", () => {
		const cookies = makeCookies();
		setAdminCookie(cookies, "my-token\r\n");
		const [, storedValue] = (cookies.set as ReturnType<typeof vi.fn>).mock.calls[0] as [string, string, object];
		expect(storedValue).toBe("my-token");
		expect(storedValue).not.toContain("\r");
		expect(storedValue).not.toContain("\n");
	});

	it("sets path: /admin", () => {
		const cookies = makeCookies();
		setAdminCookie(cookies, "tok");
		const [, , opts] = (cookies.set as ReturnType<typeof vi.fn>).mock.calls[0] as [
			string,
			string,
			Record<string, unknown>,
		];
		expect(opts.path).toBe("/admin");
	});

	it("sets sameSite: strict", () => {
		const cookies = makeCookies();
		setAdminCookie(cookies, "tok");
		const [, , opts] = (cookies.set as ReturnType<typeof vi.fn>).mock.calls[0] as [
			string,
			string,
			Record<string, unknown>,
		];
		expect(opts.sameSite).toBe("strict");
	});

	it("sets httpOnly: true", () => {
		const cookies = makeCookies();
		setAdminCookie(cookies, "tok");
		const [, , opts] = (cookies.set as ReturnType<typeof vi.fn>).mock.calls[0] as [
			string,
			string,
			Record<string, unknown>,
		];
		expect(opts.httpOnly).toBe(true);
	});
});

describe("deleteAdminCookie", () => {
	it("calls cookies.delete with the admin_token name", () => {
		const cookies = makeCookies();
		deleteAdminCookie(cookies);
		expect(cookies.delete).toHaveBeenCalledWith("admin_token", expect.any(Object));
	});

	it("uses the same path as setAdminCookie (/admin)", () => {
		const cookies = makeCookies();
		deleteAdminCookie(cookies);
		const [, opts] = (cookies.delete as ReturnType<typeof vi.fn>).mock.calls[0] as [string, Record<string, unknown>];
		expect(opts.path).toBe("/admin");
	});

	it("uses the same sameSite as setAdminCookie (strict)", () => {
		const cookies = makeCookies();
		deleteAdminCookie(cookies);
		const [, opts] = (cookies.delete as ReturnType<typeof vi.fn>).mock.calls[0] as [string, Record<string, unknown>];
		expect(opts.sameSite).toBe("strict");
	});
});
