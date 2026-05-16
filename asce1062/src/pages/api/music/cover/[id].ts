import type { APIRoute } from "astro";
import { navidromeErrorResponse, proxySubsonicBinary, requireMusicId } from "@/lib/navidrome";

/**
 * GET /api/music/cover/[id]
 *
 * Same-origin cover-art proxy. Keeps Navidrome hidden from the browser and
 * gives the UI a stable URL shape for playlist and track artwork.
 */

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
	const id = requireMusicId(params.id);
	if (id instanceof Response) return id;

	try {
		return await proxySubsonicBinary("getCoverArt", {
			id,
			size: "640",
		});
	} catch (error) {
		return navidromeErrorResponse(error);
	}
};
