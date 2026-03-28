/**
 * Unit tests for src/middleware.ts
 * CSRF enforcement, token upgrade (303 + cookie), auth redirect,
 * passthrough for non-admin routes, security headers on ALL paths.
 *
 * Design constraints:
 *  - `astro:middleware` is a Vite virtual module. We mock `defineMiddleware`
 *    to be a no-op wrapper so `onRequest` is the raw handler function.
 *  - `@/lib/api/admin-auth` is mocked so middleware tests don't depend on
 *    token validation logic (that is covered in admin-auth.test.ts).
 *  - `context.redirect()` returns a real Response so `applyAdminHeaders`
 *    can mutate its headers. Verify they are set on every return path.
 */

// vi.mock calls are hoisted to the top of the module by Vitest. They must
// appear before any imports that resolve the mocked modules.
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

vi.mock("astro:middleware", () => ({
	// defineMiddleware is a pass-through in Astro; return the handler directly
	// so `onRequest` is the raw async function we can call in tests.
	defineMiddleware: (fn: unknown) => fn,
}));

vi.mock("@/lib/api/admin-auth", () => ({
	checkPostOrigin: vi.fn(),
	checkAdminAuth: vi.fn(),
	setAdminCookie: vi.fn(),
	deleteAdminCookie: vi.fn(),
}));

// Import AFTER mocks are registered
import { onRequest } from "@/middleware";
import { checkPostOrigin, checkAdminAuth, setAdminCookie } from "@/lib/api/admin-auth";

// onRequest is typed as AstroMiddleware but the mock strips the wrapper, leaving
// a plain async function. Cast once here so tests can call it without `as Function`.
type RequestHandler = (
	context: Parameters<typeof onRequest>[0],
	next: Parameters<typeof onRequest>[1]
) => Promise<Response>;
const handler = onRequest as unknown as RequestHandler;

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const SITE = "https://alexmbugua.me";

function makeRequest(path: string, method = "GET"): Request {
	return new Request(`${SITE}${path}`, { method });
}

/**
 * Minimal AstroAPIContext mock.
 * `redirect()` returns a real Response with a Location header so tests can
 * assert on the redirect target, and `applyAdminHeaders` can write to it.
 */
function makeContext(path: string, method = "GET") {
	const request = makeRequest(path, method);
	const cookies = {
		get: vi.fn(),
		set: vi.fn(),
		delete: vi.fn(),
		has: vi.fn(),
		headers: vi.fn(),
	};
	const next = vi.fn(async () => new Response("OK", { status: 200 }));
	const redirect = vi.fn((url: string, status = 302) => new Response(null, { status, headers: { Location: url } }));
	return { request, cookies, next, redirect } as unknown as Parameters<typeof onRequest>[0] & {
		next: typeof next;
		redirect: typeof redirect;
	};
}

// ---------------------------------------------------------------------------
// Security-header assertions (applied to every admin response path)
// ---------------------------------------------------------------------------

const EXPECTED_SECURITY_HEADERS: Record<string, string> = {
	"Content-Security-Policy": "frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
	"X-Frame-Options": "DENY",
	"X-Content-Type-Options": "nosniff",
	"Cache-Control": "no-store, max-age=0",
	Pragma: "no-cache",
	Expires: "0",
	"Referrer-Policy": "no-referrer",
	"X-Robots-Tag": "noindex, nofollow, noarchive",
	"Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
};

function assertSecurityHeaders(response: Response) {
	for (const [header, value] of Object.entries(EXPECTED_SECURITY_HEADERS)) {
		expect(response.headers.get(header), `Header: ${header}`).toBe(value);
	}
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
	vi.resetAllMocks();
});

afterEach(() => {
	vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Non-admin routes (passthrough)
// ---------------------------------------------------------------------------

describe("non-admin routes", () => {
	it("calls next() and returns its response for /", async () => {
		const ctx = makeContext("/");
		const response = await handler(ctx, ctx.next);
		expect(ctx.next).toHaveBeenCalledOnce();
		expect(response.status).toBe(200);
	});

	it("calls next() for /blog/some-post", async () => {
		const ctx = makeContext("/blog/some-post");
		await handler(ctx, ctx.next);
		expect(ctx.next).toHaveBeenCalledOnce();
	});

	it("does NOT treat /administer as an admin route (path-guard: prefix+slash only)", async () => {
		const ctx = makeContext("/administer");
		await handler(ctx, ctx.next);
		expect(ctx.next).toHaveBeenCalledOnce();
	});

	it("does NOT treat /admin-panel as an admin route", async () => {
		const ctx = makeContext("/admin-panel");
		await handler(ctx, ctx.next);
		expect(ctx.next).toHaveBeenCalledOnce();
	});

	it("does NOT apply security headers to non-admin responses", async () => {
		const ctx = makeContext("/about");
		const response = await handler(ctx, ctx.next);
		// Security headers should NOT be present on non-admin pages
		expect(response.headers.get("X-Robots-Tag")).toBeNull();
		expect(response.headers.get("X-Frame-Options")).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// CSRF enforcement (cross-origin POST → 403)
// ---------------------------------------------------------------------------

describe("CSRF enforcement", () => {
	it("returns 403 for a cross-origin POST to /admin", async () => {
		vi.mocked(checkPostOrigin).mockReturnValue(false);
		const ctx = makeContext("/admin", "POST");
		const response = await handler(ctx, ctx.next);
		expect(response.status).toBe(403);
	});

	it("returns 403 for a cross-origin POST to /admin/dashboard", async () => {
		vi.mocked(checkPostOrigin).mockReturnValue(false);
		const ctx = makeContext("/admin/dashboard", "POST");
		const response = await handler(ctx, ctx.next);
		expect(response.status).toBe(403);
	});

	it("applies security headers to the 403 CSRF response (critical: early exit must include headers)", async () => {
		vi.mocked(checkPostOrigin).mockReturnValue(false);
		const ctx = makeContext("/admin", "POST");
		const response = await handler(ctx, ctx.next);
		assertSecurityHeaders(response);
	});

	it("does NOT call next() on CSRF rejection", async () => {
		vi.mocked(checkPostOrigin).mockReturnValue(false);
		const ctx = makeContext("/admin", "POST");
		await handler(ctx, ctx.next);
		expect(ctx.next).not.toHaveBeenCalled();
	});

	it("allows a same-origin POST to proceed past the CSRF check", async () => {
		vi.mocked(checkPostOrigin).mockReturnValue(true);
		// checkAdminAuth needs to return something. Use ok:false so it falls through to next()
		vi.mocked(checkAdminAuth).mockReturnValue({ ok: false });
		// /admin (not a subpage). Auth check is skipped, next() called
		const ctx = makeContext("/admin", "POST");
		const response = await handler(ctx, ctx.next);
		expect(response.status).toBe(200); // next() ran
	});
});

// ---------------------------------------------------------------------------
// Token upgrade. ?token= in URL → set cookie + 303
// ---------------------------------------------------------------------------

describe("token upgrade (query → cookie + redirect)", () => {
	it("redirects 303 when a valid token is in the query string", async () => {
		vi.mocked(checkAdminAuth).mockReturnValue({
			ok: true,
			fromQuery: true,
			token: "valid-token",
			cleanUrl: `${SITE}/admin`,
		});
		const ctx = makeContext("/admin?token=valid-token");
		const response = await handler(ctx, ctx.next);
		expect(response.status).toBe(303);
	});

	it("redirect Location is the cleanUrl (token removed from URL)", async () => {
		vi.mocked(checkAdminAuth).mockReturnValue({
			ok: true,
			fromQuery: true,
			token: "valid-token",
			cleanUrl: `${SITE}/admin`,
		});
		const ctx = makeContext("/admin?token=valid-token");
		const response = await handler(ctx, ctx.next);
		expect(response.headers.get("Location")).toBe(`${SITE}/admin`);
	});

	it("calls setAdminCookie with the token from auth result", async () => {
		vi.mocked(checkAdminAuth).mockReturnValue({
			ok: true,
			fromQuery: true,
			token: "valid-token",
			cleanUrl: `${SITE}/admin`,
		});
		const ctx = makeContext("/admin?token=valid-token");
		await handler(ctx, ctx.next);
		expect(setAdminCookie).toHaveBeenCalledWith(ctx.cookies, "valid-token");
	});

	it("applies security headers to the 303 redirect response", async () => {
		vi.mocked(checkAdminAuth).mockReturnValue({
			ok: true,
			fromQuery: true,
			token: "valid-token",
			cleanUrl: `${SITE}/admin`,
		});
		const ctx = makeContext("/admin?token=valid-token");
		const response = await handler(ctx, ctx.next);
		assertSecurityHeaders(response);
	});

	it("does NOT call next() during token upgrade (redirect is the final response)", async () => {
		vi.mocked(checkAdminAuth).mockReturnValue({
			ok: true,
			fromQuery: true,
			token: "valid-token",
			cleanUrl: `${SITE}/admin`,
		});
		const ctx = makeContext("/admin?token=valid-token");
		await handler(ctx, ctx.next);
		expect(ctx.next).not.toHaveBeenCalled();
	});

	it("token upgrade works on /admin sub-pages (not just hub)", async () => {
		vi.mocked(checkAdminAuth).mockReturnValue({
			ok: true,
			fromQuery: true,
			token: "valid-token",
			cleanUrl: `${SITE}/admin/dashboard`,
		});
		const ctx = makeContext("/admin/dashboard?token=valid-token");
		const response = await handler(ctx, ctx.next);
		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(`${SITE}/admin/dashboard`);
	});
});

// ---------------------------------------------------------------------------
// Auth enforcement on sub-pages
// ---------------------------------------------------------------------------

describe("auth enforcement on /admin/* sub-pages", () => {
	it("redirects to /admin when cookie auth fails on a sub-page", async () => {
		vi.mocked(checkAdminAuth).mockReturnValue({ ok: false });
		const ctx = makeContext("/admin/dashboard");
		const response = await handler(ctx, ctx.next);
		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe("/admin");
	});

	it("applies security headers to the auth-enforcement redirect", async () => {
		vi.mocked(checkAdminAuth).mockReturnValue({ ok: false });
		const ctx = makeContext("/admin/guestbook");
		const response = await handler(ctx, ctx.next);
		assertSecurityHeaders(response);
	});

	it("does NOT call next() on auth redirect", async () => {
		vi.mocked(checkAdminAuth).mockReturnValue({ ok: false });
		const ctx = makeContext("/admin/settings");
		await handler(ctx, ctx.next);
		expect(ctx.next).not.toHaveBeenCalled();
	});

	it("does NOT redirect on /admin (hub) when auth fails. Hub handles its own login form", async () => {
		vi.mocked(checkAdminAuth).mockReturnValue({ ok: false });
		const ctx = makeContext("/admin");
		const response = await handler(ctx, ctx.next);
		// Auth enforcement is only for sub-pages; /admin itself should call next()
		expect(ctx.next).toHaveBeenCalledOnce();
		expect(response.status).toBe(200);
	});

	it("calls next() for /admin/* when auth is valid via cookie", async () => {
		vi.mocked(checkAdminAuth).mockReturnValue({
			ok: true,
			fromQuery: false,
			token: "valid-token",
			cleanUrl: `${SITE}/admin/dashboard`,
		});
		const ctx = makeContext("/admin/dashboard");
		const response = await handler(ctx, ctx.next);
		expect(ctx.next).toHaveBeenCalledOnce();
		expect(response.status).toBe(200);
	});
});

// ---------------------------------------------------------------------------
// Security headers on the happy path (next() response)
// ---------------------------------------------------------------------------

describe("security headers on happy-path admin responses", () => {
	it("applies all security headers to the next() response on /admin", async () => {
		vi.mocked(checkAdminAuth).mockReturnValue({ ok: false });
		const ctx = makeContext("/admin");
		const response = await handler(ctx, ctx.next);
		assertSecurityHeaders(response);
	});

	it("applies all security headers when auth passes on /admin/page", async () => {
		vi.mocked(checkAdminAuth).mockReturnValue({
			ok: true,
			fromQuery: false,
			token: "tok",
			cleanUrl: `${SITE}/admin/page`,
		});
		const ctx = makeContext("/admin/page");
		const response = await handler(ctx, ctx.next);
		assertSecurityHeaders(response);
	});
});
