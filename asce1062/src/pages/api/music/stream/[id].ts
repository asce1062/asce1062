import type { APIRoute } from "astro";
import { navidromeErrorResponse, proxySubsonicBinary, requireMusicId } from "@/lib/navidrome";

/**
 * GET /api/music/stream/[id]
 *
 * Same-origin audio stream proxy. Forwarding happens in navidrome.ts so Range
 * requests and partial-content headers stay consistent for browser seeking.
 */

export const prerender = false;

export const GET: APIRoute = async ({ params, request }) => {
	const id = requireMusicId(params.id);
	if (id instanceof Response) return id;

	try {
		return await proxySubsonicBinary(
			"stream",
			{
				id,
			},
			request.headers
		);
	} catch (error) {
		return navidromeErrorResponse(error);
	}
};
