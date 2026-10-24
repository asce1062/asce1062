import type { APIRoute } from "astro";
import {
	getPublicCatalog,
	isPublicPlaylist,
	jsonResponse,
	navidromeErrorResponse,
	readNumber,
	readString,
} from "@/lib/navidrome";

/**
 * GET /api/music/playlists
 *
 * Returns only playlists marked public in Navidrome. This is the public-facing
 * browse surface for the floating player; private playlists stay server-side
 * and are filtered before the response reaches the browser.
 */

export const prerender = false;

function serializePlaylist(playlist: Record<string, unknown>) {
	return {
		id: readString(playlist, "id"),
		name: readString(playlist, "name") ?? "Untitled playlist",
		comment: readString(playlist, "comment"),
		owner: readString(playlist, "owner"),
		public: isPublicPlaylist(playlist),
		songCount: readNumber(playlist, "songCount"),
		duration: readNumber(playlist, "duration"),
		coverArt: readString(playlist, "coverArt") ?? readString(playlist, "id"),
		created: readString(playlist, "created"),
		changed: readString(playlist, "changed"),
	};
}

export const GET: APIRoute = async () => {
	try {
		// Served from the same catalog that gates /playlist, /stream and /cover, so
		// the list never offers something those routes would refuse.
		const catalog = await getPublicCatalog();
		const playlists = catalog.playlists.map(serializePlaylist).filter((playlist) => playlist.id);

		return jsonResponse({ playlists });
	} catch (error) {
		return navidromeErrorResponse(error);
	}
};
