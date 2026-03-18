/**
 * GET /api/avatar.png?gender=male&avatar=3-54-12-14-15-21
 *
 * Composites an avatar from its gender + avatar params and returns a PNG image.
 * Used by email templates so clients that strip data: URIs can fetch it via HTTP.
 *
 * Params are kept separate (not wrapped in a single `state` value) to avoid
 * double-encoding issues with Netlify's function infrastructure, which can
 * incorrectly re-split percent-encoded `&` characters in query values.
 *
 * The response is immutable-cached: the same params always produce the same image.
 */
import type { APIRoute } from "astro";
import { compositeAvatarPng } from "@/lib/email/helpers/avatarImage";

// Must not be prerendered
// This is a dynamic endpoint that composites
// avatar layers at request time based on query params.
// Without this, Astro/Netlify prerender it at build time (with no params),
// store the error response body as dist/api/avatar.png,
// and Netlify serves that static file for every request,
// bypassing the function entirely.
export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
	const gender = url.searchParams.get("gender");
	const avatar = url.searchParams.get("avatar");

	if (!gender || !avatar) {
		return new Response("Missing gender or avatar parameter", { status: 400 });
	}

	// Reconstruct the state string expected by compositeAvatarPng.
	// Values are validated inside compositeAvatarPng; no extra sanitization needed here.
	const state = `gender=${gender}&avatar=${avatar}`;

	const result = await compositeAvatarPng(state);

	if (!result.ok) {
		if (result.kind === "invalid_state") {
			return new Response("Invalid avatar state", { status: 400 });
		}
		// render_error detail is logged in compositeAvatarPng; intentionally not forwarded to the client.
		return new Response("Avatar render failed", { status: 500 });
	}

	return new Response(new Uint8Array(result.buffer), {
		headers: {
			"Content-Type": "image/png",
			// Avatars are deterministic: same params → same image. Cache aggressively.
			"Cache-Control": "public, max-age=31536000, immutable",
		},
	});
};
