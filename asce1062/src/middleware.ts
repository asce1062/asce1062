import { defineMiddleware } from "astro:middleware";
import { checkAdminAuth, checkPostOrigin } from "@/lib/api/admin-auth";

/**
 * Global middleware
 *
 * For all /admin* routes:
 *  - CSRF: reject cross-origin POST requests
 *  - Security headers applied to every response (including early returns)
 *
 * For /admin/* sub-pages only (not the /admin hub itself):
 *  - Auth enforcement: signed session cookie or bearer token checked; redirect to /admin on failure

 */

/**
 * Apply security headers to an admin response.
 * Called on every return path. Early returns (CSRF 403, auth redirect) included.
 */
function applyAdminHeaders(response: Response): Response {
	// Clickjacking: modern (CSP) + legacy (X-Frame-Options)
	// base-uri and form-action added at low breakage risk for extra injection hardening
	response.headers.set("Content-Security-Policy", "frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
	response.headers.set("X-Frame-Options", "DENY");
	// MIME-type sniffing
	response.headers.set("X-Content-Type-Options", "nosniff");
	// Never cache admin responses. max-age=0 + Expires for maximum compatibility
	response.headers.set("Cache-Control", "no-store, max-age=0");
	response.headers.set("Pragma", "no-cache");
	response.headers.set("Expires", "0");
	// No referrer leak from admin pages at all (stricter than same-origin)
	response.headers.set("Referrer-Policy", "no-referrer");
	// Prevent accidental search engine indexing of admin URLs
	response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
	// Disable browser features not needed by admin pages
	response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
	// HSTS. admin is always HTTPS in production
	if (import.meta.env.PROD) {
		response.headers.set("Strict-Transport-Security", "max-age=31536000");
	}
	return response;
}

export const onRequest = defineMiddleware(async (context, next) => {
	const { request, cookies } = context;
	const { pathname } = new URL(request.url);

	// Exact match + prefix-with-slash prevents false matches on /administer, /admin-panel, etc.
	const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");
	const isAdminSubpage = pathname.startsWith("/admin/");

	if (!isAdminRoute) return next();

	// CSRF: reject cross-origin POSTs before any page logic runs
	if (request.method === "POST" && !checkPostOrigin(request)) {
		return applyAdminHeaders(new Response("Forbidden", { status: 403 }));
	}

	const auth = await checkAdminAuth(request, cookies);

	// Auth enforcement on sub-pages only. /admin handles its own login form
	if (isAdminSubpage && !auth.ok) {
		return applyAdminHeaders(context.redirect("/admin", 303));
	}

	return applyAdminHeaders(await next());
});
