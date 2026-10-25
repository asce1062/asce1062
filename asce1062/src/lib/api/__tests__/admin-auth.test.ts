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

vi.mock("@/lib/api/admin-session-store", () => ({
	getAdminSessionGeneration: vi.fn(async () => 0),
	incrementAdminSessionGeneration: vi.fn(async () => undefined),
}));

import { createHmac } from "node:crypto";
import { verify } from "@node-rs/argon2";
import { getAdminSessionGeneration, incrementAdminSessionGeneration } from "@/lib/api/admin-session-store";
import {
	checkAdminAuth,
	checkPostOrigin,
	clearAdminSessionCookie,
	createAdminSessionCookie,
	revokeAdminSessions,
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
	await createAdminSessionCookie(cookies);
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
		vi.stubEnv("ADMIN_TOKEN_HASH", undefined);
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
		vi.useRealTimers();
		vi.mocked(getAdminSessionGeneration).mockResolvedValue(0);
	});

	// Admin auth is the signed session cookie only: the login form verifies the raw
	// token once and sets the cookie. There is no bearer-token path.
	it("returns ok:false without a session cookie", async () => {
		await expect(checkAdminAuth(makeCookies())).resolves.toEqual({ ok: false });
	});

	it("returns ok:true when a signed admin session cookie is valid", async () => {
		const session = await createSessionForTest();
		await expect(checkAdminAuth(makeCookies(session))).resolves.toEqual({ ok: true });
	});

	it("returns ok:false when the signed admin session cookie is tampered", async () => {
		const session = await createSessionForTest();
		await expect(checkAdminAuth(makeCookies(`${session}.tampered`))).resolves.toEqual({ ok: false });
	});

	it("returns ok:false when the generation field is altered (it is covered by the signature)", async () => {
		const session = await createSessionForTest();
		const [version, expiresAt, , nonce, signature] = session.split(".");
		await expect(checkAdminAuth(makeCookies(`${version}.${expiresAt}.1.${nonce}.${signature}`))).resolves.toEqual({
			ok: false,
		});
	});

	it("returns ok:false when ADMIN_TOKEN_HASH is missing, even with a session cookie", async () => {
		const session = await createSessionForTest();
		vi.stubEnv("ADMIN_TOKEN_HASH", undefined);
		await expect(checkAdminAuth(makeCookies(session))).resolves.toEqual({ ok: false });
	});

	it("returns ok:false once the session has expired", async () => {
		vi.useFakeTimers();
		const session = await createSessionForTest();
		vi.advanceTimersByTime(7 * 24 * 60 * 60 * 1000 + 1);
		await expect(checkAdminAuth(makeCookies(session))).resolves.toEqual({ ok: false });
	});

	it("returns ok:false after logout moved the generation on (stale session)", async () => {
		const session = await createSessionForTest();
		vi.mocked(getAdminSessionGeneration).mockResolvedValue(1);
		await expect(checkAdminAuth(makeCookies(session))).resolves.toEqual({ ok: false });
	});

	it("fails closed when the generation cannot be read, flagging the genuine cookie as unavailable", async () => {
		const session = await createSessionForTest();
		vi.mocked(getAdminSessionGeneration).mockRejectedValue(new Error("database unavailable"));
		await expect(checkAdminAuth(makeCookies(session))).resolves.toEqual({ ok: false, unavailable: true });
	});

	it("never flags a forged cookie as unavailable, even while the database is down", async () => {
		const session = await createSessionForTest();
		vi.mocked(getAdminSessionGeneration).mockRejectedValue(new Error("database unavailable"));
		await expect(checkAdminAuth(makeCookies(session.replace(/[^.]+$/, "forged")))).resolves.toEqual({ ok: false });
	});

	it.each([
		["a 4-part v2 cookie", (s: string) => s.split(".").toSpliced(2, 1).join(".")],
		["an extra segment", (s: string) => `${s}.extra`],
		["a non-numeric generation", (s: string) => s.split(".").with(2, "x").join(".")],
		["a negative generation", (s: string) => s.split(".").with(2, "-1").join(".")],
		["a non-numeric expiry", (s: string) => s.split(".").with(1, "soon").join(".")],
		["an unsafe-integer expiry", (s: string) => s.split(".").with(1, "9".repeat(20)).join(".")],
		["an empty nonce", (s: string) => s.split(".").with(3, "").join(".")],
		["an empty signature", (s: string) => s.split(".").with(4, "").join(".")],
	])("rejects %s without reading the generation", async (_label, mutate) => {
		const session = await createSessionForTest();
		vi.mocked(getAdminSessionGeneration).mockClear();
		await expect(checkAdminAuth(makeCookies(mutate(session)))).resolves.toEqual({ ok: false });
		expect(getAdminSessionGeneration).not.toHaveBeenCalled();
	});

	it("rejects a v1 cookie signed the old way (raw hash as the HMAC key)", async () => {
		const payload = `v1.${Date.now() + 60_000}.bm9uY2U`;
		const signature = createHmac("sha256", "$argon2id$valid-hash").update(payload).digest("base64url");
		await expect(checkAdminAuth(makeCookies(`${payload}.${signature}`))).resolves.toEqual({ ok: false });
	});

	it("checks format, expiry and signature before touching the database", async () => {
		const session = await createSessionForTest();
		vi.mocked(getAdminSessionGeneration).mockClear();
		await checkAdminAuth(makeCookies());
		await checkAdminAuth(makeCookies(`${session}.tampered`));
		await checkAdminAuth(makeCookies(session.replace(/[^.]+$/, "forged")));
		expect(getAdminSessionGeneration).not.toHaveBeenCalled();
	});

	it("never runs argon2: checking a session is a cheap HMAC comparison", async () => {
		const session = await createSessionForTest();
		vi.mocked(verify).mockClear();
		await checkAdminAuth(makeCookies(session));
		await checkAdminAuth(makeCookies());
		expect(verify).not.toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// revokeAdminSessions
// ---------------------------------------------------------------------------

describe("revokeAdminSessions", () => {
	afterEach(() => {
		vi.clearAllMocks();
	});

	it("moves the session generation on", async () => {
		await revokeAdminSessions();
		expect(incrementAdminSessionGeneration).toHaveBeenCalledOnce();
	});

	it("surfaces a storage failure instead of reporting a logout that did not revoke", async () => {
		vi.mocked(incrementAdminSessionGeneration).mockRejectedValueOnce(new Error("database unavailable"));
		await expect(revokeAdminSessions()).rejects.toThrow("database unavailable");
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
		await expect(createAdminSessionCookie(cookies)).resolves.toBe(true);
		expect(cookies.set).toHaveBeenCalledWith("admin_session", expect.any(String), expect.any(Object));
	});

	it("binds the session to the current generation (v2.expiresAt.generation.nonce.signature)", async () => {
		vi.mocked(getAdminSessionGeneration).mockResolvedValueOnce(42);
		const cookies = makeCookies();
		await createAdminSessionCookie(cookies);
		const [, storedValue] = (cookies.set as ReturnType<typeof vi.fn>).mock.calls[0] as [string, string, object];
		const parts = storedValue.split(".");
		expect(parts).toHaveLength(5);
		expect(parts[0]).toBe("v2");
		expect(parts[2]).toBe("42");
	});

	it("does not sign with the raw ADMIN_TOKEN_HASH (a derived key is used)", async () => {
		const cookies = makeCookies();
		await createAdminSessionCookie(cookies);
		const [, storedValue] = (cookies.set as ReturnType<typeof vi.fn>).mock.calls[0] as [string, string, object];
		const payload = storedValue.slice(0, storedValue.lastIndexOf("."));
		const rawKeySignature = createHmac("sha256", "$argon2id$valid-hash").update(payload).digest("base64url");
		expect(storedValue.endsWith(rawKeySignature)).toBe(false);
	});

	it("sets no cookie and reports failure when the generation cannot be read", async () => {
		vi.mocked(getAdminSessionGeneration).mockRejectedValueOnce(new Error("database unavailable"));
		const cookies = makeCookies();
		await expect(createAdminSessionCookie(cookies)).resolves.toBe(false);
		expect(cookies.set).not.toHaveBeenCalled();
	});

	it("does not store the raw admin token in the cookie", async () => {
		const cookies = makeCookies();
		await createAdminSessionCookie(cookies);
		const [, storedValue] = (cookies.set as ReturnType<typeof vi.fn>).mock.calls[0] as [string, string, object];
		expect(storedValue).not.toContain("valid-token");
	});

	it("sets path: /admin", async () => {
		const cookies = makeCookies();
		await createAdminSessionCookie(cookies);
		const [, , opts] = (cookies.set as ReturnType<typeof vi.fn>).mock.calls[0] as [
			string,
			string,
			Record<string, unknown>,
		];
		expect(opts.path).toBe("/admin");
	});

	it("sets sameSite: strict", async () => {
		const cookies = makeCookies();
		await createAdminSessionCookie(cookies);
		const [, , opts] = (cookies.set as ReturnType<typeof vi.fn>).mock.calls[0] as [
			string,
			string,
			Record<string, unknown>,
		];
		expect(opts.sameSite).toBe("strict");
	});

	it("sets httpOnly: true", async () => {
		const cookies = makeCookies();
		await createAdminSessionCookie(cookies);
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
