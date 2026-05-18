/**
 * Unit tests for admin authentication utilities.
 * Argon2 token verification, signed session cookies, and CSRF checks.
 *
 * These are the primary guards against admin session compromise. Admin raw
 * tokens must only be accepted through explicit input paths, must never be
 * stored in cookies, and query-string tokens must fail closed.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { AstroCookies } from "astro";

vi.mock("@node-rs/argon2", () => ({
	verify: vi.fn(async (hash: string, token: string) => hash === "$argon2id$valid-hash" && token === "valid-token"),
}));

import { verify } from "@node-rs/argon2";
import {
	checkAdminAuth,
	checkPostOrigin,
	clearAdminSessionCookie,
	createAdminSessionCookie,
	verifyAdminToken,
} from "@/lib/api/admin-auth";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Minimal AstroCookies mock. Only the methods used by admin-auth are implemented. */
function makeCookies(sessionValue?: string): AstroCookies {
	return {
		get: vi.fn((name: string) => (name === "admin_session" && sessionValue ? { value: sessionValue } : undefined)),
		set: vi.fn(),
		delete: vi.fn(),
		has: vi.fn(),
		headers: vi.fn(),
	} as unknown as AstroCookies;
}

function makeRequest(
	url: string,
	options?: { method?: string; origin?: string | null; referer?: string | null; authorization?: string | null }
): Request {
	const headers = new Headers();
	if (options?.origin != null) headers.set("origin", options.origin);
	if (options?.referer != null) headers.set("referer", options.referer);
	if (options?.authorization != null) headers.set("authorization", options.authorization);
	return new Request(url, { method: options?.method ?? "GET", headers });
}

async function createSessionForTest(): Promise<string> {
	const cookies = makeCookies();
	createAdminSessionCookie(cookies);
	const [, storedValue] = (cookies.set as ReturnType<typeof vi.fn>).mock.calls[0] as [string, string, object];
	return storedValue;
}

const SITE_URL = "https://alexmbugua.me";
const ADMIN_URL = `${SITE_URL}/admin`;

// ---------------------------------------------------------------------------
// verifyAdminToken
// ---------------------------------------------------------------------------

describe("verifyAdminToken", () => {
	beforeEach(() => {
		vi.stubEnv("ADMIN_TOKEN_HASH", "$argon2id$valid-hash");
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		vi.clearAllMocks();
	});

	it("returns true for a valid raw token against ADMIN_TOKEN_HASH", async () => {
		await expect(verifyAdminToken("valid-token")).resolves.toBe(true);
		expect(verify).toHaveBeenCalledWith("$argon2id$valid-hash", "valid-token");
	});

	it("returns false for an invalid raw token", async () => {
		await expect(verifyAdminToken("invalid-token")).resolves.toBe(false);
	});

	it("returns false when the token is empty", async () => {
		await expect(verifyAdminToken("")).resolves.toBe(false);
		expect(verify).not.toHaveBeenCalled();
	});

	it("returns false for oversized token input", async () => {
		await expect(verifyAdminToken("a".repeat(513))).resolves.toBe(false);
		expect(verify).not.toHaveBeenCalled();
	});

	it("returns false for token input containing CRLF", async () => {
		await expect(verifyAdminToken("valid-token\r\n")).resolves.toBe(false);
		expect(verify).not.toHaveBeenCalled();
	});

	it("returns false when ADMIN_TOKEN_HASH is missing", async () => {
		vi.unstubAllEnvs();
		await expect(verifyAdminToken("valid-token")).resolves.toBe(false);
		expect(verify).not.toHaveBeenCalled();
	});

	it("reads ADMIN_TOKEN_HASH from Astro env when process env is unset", async () => {
		vi.unstubAllEnvs();
		const originalHash = import.meta.env.ADMIN_TOKEN_HASH;
		const originalProcessHash = process.env.ADMIN_TOKEN_HASH;
		delete process.env.ADMIN_TOKEN_HASH;
		Reflect.set(import.meta.env, "ADMIN_TOKEN_HASH", "$argon2id$valid-hash");

		await expect(verifyAdminToken("valid-token")).resolves.toBe(true);

		Reflect.set(import.meta.env, "ADMIN_TOKEN_HASH", originalHash);
		process.env.ADMIN_TOKEN_HASH = originalProcessHash;
	});

	it("fails closed when ADMIN_TOKEN_HASH is malformed", async () => {
		vi.mocked(verify).mockRejectedValueOnce(new Error("invalid hash"));
		await expect(verifyAdminToken("valid-token")).resolves.toBe(false);
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

	it("falls back to Referer when Origin is absent (same-origin Referer -> true)", () => {
		expect(checkPostOrigin(makeRequest(ADMIN_URL, { method: "POST", referer: `${ADMIN_URL}/login` }))).toBe(true);
	});

	it("falls back to Referer when cross-origin Referer -> false", () => {
		expect(
			checkPostOrigin(makeRequest(ADMIN_URL, { method: "POST", referer: "https://kizaru.example.com/form" }))
		).toBe(false);
	});

	it("returns false for POST with no Origin and no Referer", () => {
		expect(checkPostOrigin(makeRequest(ADMIN_URL, { method: "POST" }))).toBe(false);
	});

	it("returns false for POST with a malformed Referer URL", () => {
		expect(checkPostOrigin(makeRequest(ADMIN_URL, { method: "POST", referer: "not-a-valid-url" }))).toBe(false);
	});

	it("Origin takes precedence over Referer when both are present", () => {
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
// checkAdminAuth
// ---------------------------------------------------------------------------

describe("checkAdminAuth", () => {
	beforeEach(() => {
		vi.stubEnv("ADMIN_TOKEN_HASH", "$argon2id$valid-hash");
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		vi.clearAllMocks();
	});

	it("returns ok:true when a valid bearer token is in the Authorization header", async () => {
		const request = makeRequest(ADMIN_URL, { authorization: "Bearer valid-token" });
		await expect(checkAdminAuth(request, makeCookies())).resolves.toEqual({ ok: true });
	});

	it("returns ok:false when the bearer token is invalid", async () => {
		const request = makeRequest(ADMIN_URL, { authorization: "Bearer invalid-token" });
		await expect(checkAdminAuth(request, makeCookies())).resolves.toEqual({ ok: false });
	});

	it("returns ok:false when the Authorization header is missing", async () => {
		await expect(checkAdminAuth(makeRequest(ADMIN_URL), makeCookies())).resolves.toEqual({ ok: false });
	});

	it("returns ok:false when Authorization is not a bearer token", async () => {
		const request = makeRequest(ADMIN_URL, { authorization: "Basic valid-token" });
		await expect(checkAdminAuth(request, makeCookies())).resolves.toEqual({ ok: false });
		expect(verify).not.toHaveBeenCalled();
	});

	it("rejects token query params instead of accepting or upgrading them", async () => {
		const request = makeRequest(`${ADMIN_URL}?token=valid-token`);
		await expect(checkAdminAuth(request, makeCookies())).resolves.toEqual({ ok: false });
		expect(verify).not.toHaveBeenCalled();
	});

	it("returns ok:false when ADMIN_TOKEN_HASH is missing", async () => {
		vi.unstubAllEnvs();
		const request = makeRequest(ADMIN_URL, { authorization: "Bearer valid-token" });
		await expect(checkAdminAuth(request, makeCookies())).resolves.toEqual({ ok: false });
	});

	it("returns ok:true when a signed admin session cookie is valid", async () => {
		const session = await createSessionForTest();
		await expect(checkAdminAuth(makeRequest(ADMIN_URL), makeCookies(session))).resolves.toEqual({ ok: true });
	});

	it("returns ok:false when the signed admin session cookie is tampered", async () => {
		const session = await createSessionForTest();
		await expect(checkAdminAuth(makeRequest(ADMIN_URL), makeCookies(`${session}.tampered`))).resolves.toEqual({
			ok: false,
		});
	});
});

// ---------------------------------------------------------------------------
// createAdminSessionCookie / clearAdminSessionCookie
// ---------------------------------------------------------------------------

describe("createAdminSessionCookie", () => {
	beforeEach(() => {
		vi.stubEnv("ADMIN_TOKEN_HASH", "$argon2id$valid-hash");
	});

	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("calls cookies.set with the admin_session name", async () => {
		const cookies = makeCookies();
		createAdminSessionCookie(cookies);
		expect(cookies.set).toHaveBeenCalledWith("admin_session", expect.any(String), expect.any(Object));
	});

	it("does not store the raw admin token in the cookie", async () => {
		const cookies = makeCookies();
		createAdminSessionCookie(cookies);
		const [, storedValue] = (cookies.set as ReturnType<typeof vi.fn>).mock.calls[0] as [string, string, object];
		expect(storedValue).not.toContain("valid-token");
	});

	it("sets path: /admin", async () => {
		const cookies = makeCookies();
		createAdminSessionCookie(cookies);
		const [, , opts] = (cookies.set as ReturnType<typeof vi.fn>).mock.calls[0] as [
			string,
			string,
			Record<string, unknown>,
		];
		expect(opts.path).toBe("/admin");
	});

	it("sets sameSite: strict", async () => {
		const cookies = makeCookies();
		createAdminSessionCookie(cookies);
		const [, , opts] = (cookies.set as ReturnType<typeof vi.fn>).mock.calls[0] as [
			string,
			string,
			Record<string, unknown>,
		];
		expect(opts.sameSite).toBe("strict");
	});

	it("sets httpOnly: true", async () => {
		const cookies = makeCookies();
		createAdminSessionCookie(cookies);
		const [, , opts] = (cookies.set as ReturnType<typeof vi.fn>).mock.calls[0] as [
			string,
			string,
			Record<string, unknown>,
		];
		expect(opts.httpOnly).toBe(true);
	});
});

describe("clearAdminSessionCookie", () => {
	it("calls cookies.delete with the admin_session name", () => {
		const cookies = makeCookies();
		clearAdminSessionCookie(cookies);
		expect(cookies.delete).toHaveBeenCalledWith("admin_session", expect.any(Object));
	});

	it("uses the same path as createAdminSessionCookie (/admin)", () => {
		const cookies = makeCookies();
		clearAdminSessionCookie(cookies);
		const [, opts] = (cookies.delete as ReturnType<typeof vi.fn>).mock.calls[0] as [string, Record<string, unknown>];
		expect(opts.path).toBe("/admin");
	});

	it("uses the same sameSite as createAdminSessionCookie (strict)", () => {
		const cookies = makeCookies();
		clearAdminSessionCookie(cookies);
		const [, opts] = (cookies.delete as ReturnType<typeof vi.fn>).mock.calls[0] as [string, Record<string, unknown>];
		expect(opts.sameSite).toBe("strict");
	});
});
