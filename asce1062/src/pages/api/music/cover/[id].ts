import type { APIRoute } from "astro";
import {
	isInPublicCatalog,
	navidromeErrorResponse,
	notFoundResponse,
	proxySubsonicBinary,
	requireMusicId,
} from "@/lib/navidrome";

/**
 * GET /api/music/cover/[id]
 *
 * Same-origin cover-art proxy. Keeps Navidrome hidden from the browser and
 * gives the UI a stable URL shape for playlist and track artwork. Only covers
 * used by public playlists and their tracks are served.
 */

export const prerender = false;

export const GET: APIRoute = async ({ params, request }) => {
	const id = requireMusicId(params.id);
	if (id instanceof Response) return id;

	try {
		if (!(await isInPublicCatalog("coverIds", id))) return notFoundResponse();
		return await proxySubsonicBinary("getCoverArt", { id, size: "640" }, request);
	} catch (error) {
		return navidromeErrorResponse(error);
	}
};
