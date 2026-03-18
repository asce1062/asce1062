/**
 * GET /api/avatar.png?state=gender%3Dmale%26avatar%3D3-54-12-14-15-21
 *
 * Composites an avatar from its stored state string and returns a PNG image.
 * Used by email templates so clients that strip data: URIs can fetch it via HTTP.
 *
 * The response is immutable-cached: the same state always produces the same image.
 */
import type { APIRoute } from "astro";
import { compositeAvatarPng } from "@/lib/email/helpers/avatarImage";

// Longest valid state: "gender=female&avatar=XX-XX-XX-XX-XX-XX" ≈ 38 chars. 256 is a safe ceiling.
const MAX_STATE_LENGTH = 256;

export const GET: APIRoute = async ({ url }) => {
	// Reject repeated state params. get() silently takes the first, which is confusing.
	if (url.searchParams.getAll("state").length > 1) {
		return new Response("Duplicate state parameter", { status: 400 });
	}

	const state = url.searchParams.get("state");

	if (!state) {
		return new Response("Missing state parameter", { status: 400 });
	}

	if (state.length > MAX_STATE_LENGTH) {
		return new Response("State parameter too long", { status: 400 });
	}

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
			// Avatars are deterministic: same state → same image. Cache aggressively.
			"Cache-Control": "public, max-age=31536000, immutable",
		},
	});
};
