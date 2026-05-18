/**
 * Admin authentication utilities.
 *
 * Security properties:
 *  - Runtime auth uses ADMIN_TOKEN_HASH only; no raw token env var is read
 *  - Raw tokens are verified with Argon2 and never stored in cookies
 *  - Admin sessions use a signed, HttpOnly, SameSite=Strict cookie
 *  - Token query params are not accepted because URLs leak into logs/history
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { AstroCookies } from "astro";
import { verify } from "@node-rs/argon2";

const ADMIN_COOKIE_NAME = "admin_session";
const SESSION_VERSION = "v1";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
const MAX_TOKEN_LENGTH = 512;

const COOKIE_OPTIONS = {
	path: "/admin",
	httpOnly: true,
	secure: import.meta.env.PROD,
	sameSite: "strict" as const,
	maxAge: SESSION_TTL_SECONDS,
};

function getAdminTokenHash(): string {
	return (process.env.ADMIN_TOKEN_HASH ?? import.meta.env.ADMIN_TOKEN_HASH ?? "").trim();
}

function safeEqual(a: string, b: string): boolean {
	const ab = Buffer.from(a, "utf8");
	const bb = Buffer.from(b, "utf8");
	if (ab.length !== bb.length) {
		timingSafeEqual(ab, Buffer.alloc(ab.length));
		return false;
	}
	return timingSafeEqual(ab, bb);
}

function signSessionPayload(payload: string, tokenHash: string): string {
	return createHmac("sha256", tokenHash).update(payload).digest("base64url");
}

function getBearerToken(request: Request): string {
	const authHeader = request.headers.get("authorization") || "";
	return authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : "";
}

function normalizeToken(token: string | undefined): string {
	if (!token) return "";
	if (/[\r\n]/.test(token)) return "";
	const normalized = token.trim();
	if (!normalized || normalized.length > MAX_TOKEN_LENGTH) return "";
	return normalized;
}

function isValidSessionCookie(cookies: AstroCookies): boolean {
	const tokenHash = getAdminTokenHash();
	const session = cookies.get(ADMIN_COOKIE_NAME)?.value;
	if (!tokenHash || !session) return false;

	const parts = session.split(".");
	if (parts.length !== 4) return false;

	const [version, expiresAt, nonce, signature] = parts;
	if (version !== SESSION_VERSION || !/^\d+$/.test(expiresAt) || !nonce || !signature) return false;

	const expiresAtMs = Number(expiresAt);
	if (!Number.isSafeInteger(expiresAtMs) || expiresAtMs <= Date.now()) return false;

	const payload = `${version}.${expiresAt}.${nonce}`;
	const expectedSignature = signSessionPayload(payload, tokenHash);
	return safeEqual(signature, expectedSignature);
}

/** Return true when a raw token verifies against ADMIN_TOKEN_HASH. */
export async function verifyAdminToken(token: string | undefined): Promise<boolean> {
	const tokenHash = getAdminTokenHash();
	const normalizedToken = normalizeToken(token);
	if (!normalizedToken || !tokenHash) return false;

	try {
		return await verify(tokenHash, normalizedToken);
	} catch {
		return false;
	}
}

/** Persist an opaque signed admin session cookie. The raw token is never stored. */
export function createAdminSessionCookie(cookies: AstroCookies): void {
	const tokenHash = getAdminTokenHash();
	if (!tokenHash) return;

	const expiresAt = String(Date.now() + SESSION_TTL_SECONDS * 1000);
	const nonce = randomBytes(16).toString("base64url");
	const payload = `${SESSION_VERSION}.${expiresAt}.${nonce}`;
	const signature = signSessionPayload(payload, tokenHash);
	cookies.set(ADMIN_COOKIE_NAME, `${payload}.${signature}`, COOKIE_OPTIONS);
}

/** Remove the admin session cookie using the same options used to set it. */
export function clearAdminSessionCookie(cookies: AstroCookies): void {
	cookies.delete(ADMIN_COOKIE_NAME, {
		path: COOKIE_OPTIONS.path,
		secure: COOKIE_OPTIONS.secure,
		sameSite: COOKIE_OPTIONS.sameSite,
	});
}

/**
 * Verify a POST request's Origin header matches the expected site origin.
 *
 * Defense-in-depth alongside SameSite=Strict: rejects cross-origin form posts
 * even if something unusual slips past cookie policy enforcement.
 * Returns true for non-POST requests (no check needed).
 */
export function checkPostOrigin(request: Request): boolean {
	if (request.method !== "POST") return true;
	const expected = new URL(request.url).origin;
	const origin = request.headers.get("origin");
	if (origin) return origin !== "null" && origin === expected;
	const referer = request.headers.get("referer");
	if (!referer) return false;
	try {
		return new URL(referer).origin === expected;
	} catch {
		return false;
	}
}

/** Verify an incoming admin request via bearer token or signed session cookie. */
export async function checkAdminAuth(request: Request, cookies: AstroCookies): Promise<{ ok: true } | { ok: false }> {
	const token = getBearerToken(request);
	if (token && (await verifyAdminToken(token))) return { ok: true };
	if (isValidSessionCookie(cookies)) return { ok: true };
	return { ok: false };
}
