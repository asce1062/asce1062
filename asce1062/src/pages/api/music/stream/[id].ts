import type { APIRoute } from "astro";
import {
	getPublicCatalog,
	navidromeErrorResponse,
	notFoundResponse,
	proxySubsonicBinary,
	requireMusicId,
} from "@/lib/navidrome";

/**
 * GET /api/music/stream/[id]
 *
 * Same-origin audio stream proxy. Forwarding happens in navidrome.ts so Range
 * requests and partial-content headers stay consistent for browser seeking.
 * Only tracks in public playlists are served; the proxy holds the server's
 * credentials, so anything else would expose the whole library.
 */

export const prerender = false;

export const GET: APIRoute = async ({ params, request }) => {
	const id = requireMusicId(params.id);
	if (id instanceof Response) return id;

	try {
		if (!(await getPublicCatalog()).trackIds.has(id)) return notFoundResponse();
		return await proxySubsonicBinary("stream", { id }, request);
	} catch (error) {
		return navidromeErrorResponse(error);
	}
};
