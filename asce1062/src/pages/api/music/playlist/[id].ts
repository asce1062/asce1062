import type { APIRoute } from "astro";
import {
	asRecord,
	jsonResponse,
	navidromeErrorResponse,
	readNumber,
	readRecordArray,
	readString,
	requireMusicId,
	subsonicFetchJson,
} from "@/lib/navidrome";

/**
 * GET /api/music/playlist/[id]
 *
 * Loads one public playlist's metadata and playable entries from Navidrome.
 * The client receives normalized track records only; stream and cover URLs are
 * still resolved through separate same-origin proxy routes.
 */

export const prerender = false;

function serializeTrack(track: Record<string, unknown>) {
	return {
		id: readString(track, "id"),
		parent: readString(track, "parent"),
		title: readString(track, "title") ?? "Untitled track",
		album: readString(track, "album"),
		artist: readString(track, "artist") ?? "Unknown artist",
		track: readNumber(track, "track"),
		year: readNumber(track, "year"),
		genre: readString(track, "genre"),
		coverArt: readString(track, "coverArt"),
		duration: readNumber(track, "duration"),
		suffix: readString(track, "suffix"),
		contentType: readString(track, "contentType"),
	};
}

export const GET: APIRoute = async ({ params }) => {
	const id = requireMusicId(params.id);
	if (id instanceof Response) return id;

	try {
		const payload = await subsonicFetchJson("getPlaylist", { id });
		const playlist = asRecord(payload.playlist);
		const tracks = readRecordArray(playlist, "entry")
			.map(serializeTrack)
			.filter((track) => track.id);

		return jsonResponse({
			playlist: playlist
				? {
						id: readString(playlist, "id"),
						name: readString(playlist, "name") ?? "Untitled playlist",
						comment: readString(playlist, "comment"),
						owner: readString(playlist, "owner"),
						public: playlist.public === true || playlist.public === "true",
						songCount: readNumber(playlist, "songCount"),
						duration: readNumber(playlist, "duration"),
						coverArt: readString(playlist, "coverArt") ?? id,
					}
				: null,
			tracks,
		});
	} catch (error) {
		return navidromeErrorResponse(error);
	}
};
