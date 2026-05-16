import type { APIRoute } from "astro";
import {
	asRecord,
	jsonResponse,
	navidromeErrorResponse,
	readNumber,
	readRecordArray,
	readString,
	subsonicFetchJson,
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
		public: playlist.public === true || playlist.public === "true",
		songCount: readNumber(playlist, "songCount"),
		duration: readNumber(playlist, "duration"),
		coverArt: readString(playlist, "coverArt") ?? readString(playlist, "id"),
		created: readString(playlist, "created"),
		changed: readString(playlist, "changed"),
	};
}

export const GET: APIRoute = async () => {
	try {
		const payload = await subsonicFetchJson("getPlaylists");
		const playlistsRoot = asRecord(payload.playlists);
		const playlists = readRecordArray(playlistsRoot, "playlist")
			.map(serializePlaylist)
			.filter((playlist) => playlist.id && playlist.public);

		return jsonResponse({ playlists });
	} catch (error) {
		return navidromeErrorResponse(error);
	}
};
