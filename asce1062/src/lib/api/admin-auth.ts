/**
 * Admin authentication utilities.
 *
 * Security properties:
 *  - Runtime auth uses ADMIN_TOKEN_HASH only; no raw token env var is read
 *  - Raw tokens are verified with Argon2 and never stored in cookies
 *  - Admin sessions use a signed, HttpOnly, SameSite=Strict cookie
 *  - The cookie signing key is derived from ADMIN_TOKEN_HASH (HKDF), not the hash itself
 *  - Each session carries the server-side generation current at login; logout moves
 *    the generation on, so every outstanding session (a copied cookie too) is revoked
 *  - Token query params are not accepted because URLs leak into logs/history
 */
import { createHmac, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";
import type { AstroCookies } from "astro";
import { verify } from "@node-rs/argon2";
import { getAdminSessionGeneration, incrementAdminSessionGeneration } from "@/lib/api/admin-session-store";

const ADMIN_COOKIE_NAME = "admin_session";
const SESSION_VERSION = "v2";
const SESSION_KEY_INFO = "alexmbugua.me admin session v2";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
const MAX_TOKEN_LENGTH = 512;

/**
 * `unavailable`: the cookie is genuine (signed, unexpired) but whether it was
 * revoked could not be checked. Never access; lets logout still try to revoke.
 */
type AdminAuthResult = { ok: true } | { ok: false; unavailable?: true };

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

/** Session signing key: derived for this one purpose, so the hash is not reused as a key. */
function deriveSessionKey(tokenHash: string): Buffer {
	return Buffer.from(hkdfSync("sha256", tokenHash, "", SESSION_KEY_INFO, 32));
}

function signSessionPayload(payload: string, tokenHash: string): string {
	return createHmac("sha256", deriveSessionKey(tokenHash)).update(payload).digest("base64url");
}

/** The current generation, or null when it cannot be read (callers fail closed). */
async function readGeneration(): Promise<number | null> {
	try {
		return await getAdminSessionGeneration();
	} catch (err) {
		console.error("[admin-auth] could not read the admin session generation", err);
		return null;
	}
}

function normalizeToken(token: string | undefined): string {
	if (!token) return "";
	if (/[\r\n]/.test(token)) return "";
	const normalized = token.trim();
	if (!normalized || normalized.length > MAX_TOKEN_LENGTH) return "";
	return normalized;
}

/**
 * Format, expiry and signature are checked first (no I/O), so a forged or stale
 * cookie never reaches the database. Only a genuine session pays for the
 * generation read that tells whether it has been revoked since.
 *
 * "unavailable" means the cookie is signed and unexpired but the generation
 * could not be read: still not authenticated, but distinct from a bad cookie.
 */
async function checkSessionCookie(cookies: AstroCookies): Promise<"valid" | "invalid" | "unavailable"> {
	const tokenHash = getAdminTokenHash();
	const session = cookies.get(ADMIN_COOKIE_NAME)?.value;
	if (!tokenHash || !session) return "invalid";

	const parts = session.split(".");
	if (parts.length !== 5) return "invalid";

	const [version, expiresAt, generation, nonce, signature] = parts;
	if (version !== SESSION_VERSION || !/^\d+$/.test(expiresAt) || !/^\d+$/.test(generation) || !nonce || !signature) {
		return "invalid";
	}

	const expiresAtMs = Number(expiresAt);
	if (!Number.isSafeInteger(expiresAtMs) || expiresAtMs <= Date.now()) return "invalid";

	const payload = `${version}.${expiresAt}.${generation}.${nonce}`;
	if (!safeEqual(signature, signSessionPayload(payload, tokenHash))) return "invalid";

	const currentGeneration = await readGeneration();
	if (currentGeneration === null) return "unavailable";
	return Number(generation) === currentGeneration ? "valid" : "invalid";
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

/**
 * Persist an opaque signed admin session cookie bound to the current generation.
 * The raw token is never stored. Returns false (and sets nothing) when no
 * session can be issued, so the caller can report the login as failed.
 */
export async function createAdminSessionCookie(cookies: AstroCookies): Promise<boolean> {
	const tokenHash = getAdminTokenHash();
	if (!tokenHash) return false;

	const generation = await readGeneration();
	if (generation === null) return false;

	const expiresAt = String(Date.now() + SESSION_TTL_SECONDS * 1000);
	const nonce = randomBytes(16).toString("base64url");
	const payload = `${SESSION_VERSION}.${expiresAt}.${generation}.${nonce}`;
	const signature = signSessionPayload(payload, tokenHash);
	cookies.set(ADMIN_COOKIE_NAME, `${payload}.${signature}`, COOKIE_OPTIONS);
	return true;
}

/**
 * Revoke every outstanding admin session (single log-out = sign out everywhere).
 * Throws when the generation could not be moved on, so a failed revocation is
 * never reported as a successful logout.
 */
export async function revokeAdminSessions(): Promise<void> {
	await incrementAdminSessionGeneration();
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

/**
 * Verify an incoming admin request by its signed session cookie (a cheap HMAC
 * check, then one generation read). The raw token is verified with argon2 only
 * by the login form, which then sets this cookie; there is no header-based login.
 */
export async function checkAdminAuth(cookies: AstroCookies): Promise<AdminAuthResult> {
	const result = await checkSessionCookie(cookies);
	if (result === "valid") return { ok: true };
	return result === "unavailable" ? { ok: false, unavailable: true } : { ok: false };
}
