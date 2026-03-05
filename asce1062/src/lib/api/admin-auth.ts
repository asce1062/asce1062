/**
 * Admin authentication utilities
 *
 * Centralizes cookie name, options, and token verification.
 *
 * Security properties:
 *  - Tokens are sanitized (trimmed, CRLF-stripped) before comparison
 *  - Comparison is timing-safe to prevent length-based timing leaks
 *  - Cookie options match on set and delete to ensure consistent browser behavior
 *  - ?token= query hits receive a cookie and are redirected to the clean URL
 *    so the token never stays in browser history or server logs
 */
import { timingSafeEqual } from "node:crypto";
import type { AstroCookies } from "astro";

const ADMIN_COOKIE_NAME = "admin_token";

const COOKIE_OPTIONS = {
	path: "/admin",
	httpOnly: true,
	secure: import.meta.env.PROD,
	sameSite: "strict" as const,
	maxAge: 60 * 60 * 24 * 7, // 7 days
};

/** Strip CR/LF, trim, and cap length. Guards against copy-paste artifacts and oversized inputs. */
function sanitizeToken(value: string): string {
	return value
		.replace(/[\r\n]/g, "")
		.trim()
		.slice(0, 256);
}

/**
 * Timing-safe string equality.
 *
 * When lengths differ, a dummy comparison is performed anyway so the
 * function always runs in proportional time regardless of input.
 */
function safeEqual(a: string, b: string): boolean {
	const ab = Buffer.from(a, "utf8");
	const bb = Buffer.from(b, "utf8");
	if (ab.length !== bb.length) {
		// Consume constant time relative to `a` length, then return false.
		timingSafeEqual(ab, Buffer.alloc(ab.length));
		return false;
	}
	return timingSafeEqual(ab, bb);
}

/** Read the raw admin token from the cookie jar. */
export function getAdminCookieToken(cookies: AstroCookies): string | undefined {
	return cookies.get(ADMIN_COOKIE_NAME)?.value;
}

/** Return true when candidate is non-empty and matches the configured ADMIN_TOKEN. */
export function isValidToken(candidate: string | undefined): boolean {
	const ADMIN_TOKEN = import.meta.env.ADMIN_TOKEN;
	if (!ADMIN_TOKEN || !candidate) return false;
	return safeEqual(sanitizeToken(candidate), sanitizeToken(ADMIN_TOKEN));
}

/** Persist the admin session cookie. Sanitizes the token before storage. */
export function setAdminCookie(cookies: AstroCookies, token: string): void {
	cookies.set(ADMIN_COOKIE_NAME, sanitizeToken(token), COOKIE_OPTIONS);
}

/** Remove the admin session cookie using the same options used to set it. */
export function deleteAdminCookie(cookies: AstroCookies): void {
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
	// Treat the string "null" (sent by sandboxed contexts) as a failure.
	if (origin) return origin !== "null" && origin === expected;
	// No Origin header. Fall back to Referer (older browsers / same-origin fetches)
	const referer = request.headers.get("referer");
	if (!referer) return false;
	try {
		return new URL(referer).origin === expected;
	} catch {
		return false;
	}
}

/**
 * Verify an incoming sub-page request via cookie or ?token= query param.
 *
 * When the token arrives via the query string, returns `cleanUrl` (the same
 * URL with the token param stripped) so the caller can set the cookie and
 * immediately redirect preventing the token from lingering in browser
 * history, server logs, or referrer headers.
 */
export function checkAdminAuth(
	request: Request,
	cookies: AstroCookies
): { ok: true; fromQuery: boolean; token: string; cleanUrl: string } | { ok: false } {
	const url = new URL(request.url);
	const queryToken = url.searchParams.get("token") ?? undefined;
	const cookieToken = getAdminCookieToken(cookies);
	const candidate = queryToken ?? cookieToken;
	if (!isValidToken(candidate)) return { ok: false };

	const cleanUrl = new URL(url);
	cleanUrl.searchParams.delete("token");

	return { ok: true, fromQuery: Boolean(queryToken), token: sanitizeToken(candidate!), cleanUrl: cleanUrl.toString() };
}
