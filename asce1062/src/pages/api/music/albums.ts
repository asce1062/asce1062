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
 * GET /api/music/albums
 *
 * Small same-origin JSON endpoint for featured/starred Navidrome albums.
 * Currently not used by the floating player, but kept with the music API
 * surface so future album views can reuse the same server-only gateway.
 */

export const prerender = false;

function serializeAlbum(album: Record<string, unknown>) {
	return {
		id: readString(album, "id"),
		name: readString(album, "name") ?? "Untitled album",
		artist: readString(album, "artist") ?? "Unknown artist",
		artistId: readString(album, "artistId"),
		coverArt: readString(album, "coverArt") ?? readString(album, "id"),
		year: readNumber(album, "year"),
		genre: readString(album, "genre"),
		songCount: readNumber(album, "songCount"),
		duration: readNumber(album, "duration"),
		created: readString(album, "created"),
	};
}

export const GET: APIRoute = async () => {
	try {
		const payload = await subsonicFetchJson("getAlbumList2", {
			type: "starred",
			size: "24",
		});
		const albumList = asRecord(payload.albumList2);
		const albums = readRecordArray(albumList, "album")
			.map(serializeAlbum)
			.filter((album) => album.id);

		return jsonResponse({ albums });
	} catch (error) {
		return navidromeErrorResponse(error);
	}
};
