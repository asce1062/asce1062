/**
 * Sorting utilities for music library
 * Handles sorting logic for albums, tracks, and trackers
 */

import type { Album, Track } from "@/types/music";

export type AlbumSortBy = "title" | "release" | "artist" | "year" | "duration";
export type TrackSortBy = "title" | "artist" | "album" | "duration";
export type SortOrder = "asc" | "desc";

/**
 * Sort albums by specified field
 */
export function sortAlbums(albums: Album[], sortBy: AlbumSortBy, order: SortOrder = "desc"): Album[] {
	const sorted = [...albums];
	const multiplier = order === "asc" ? 1 : -1;

	switch (sortBy) {
		case "title":
			sorted.sort((a, b) => multiplier * a.album.localeCompare(b.album));
			break;
		case "artist":
			sorted.sort((a, b) => multiplier * a.artist.localeCompare(b.artist));
			break;
		case "duration":
			sorted.sort((a, b) => {
				// Prioritize numeric fields (duration_seconds, duration_seconds) over formatted strings (duration)
				const aDuration = a.duration_seconds || a.duration_seconds || 0;
				const bDuration = b.duration_seconds || b.duration_seconds || 0;
				return multiplier * (aDuration - bDuration);
			});
			break;
		case "year":
		case "release":
		default:
			sorted.sort((a, b) => multiplier * ((a.year || 0) - (b.year || 0)));
			break;
	}

	return sorted;
}

/**
 * Sort tracks by specified field
 * For album/artist sorting, tracks within each album are always kept in ascending order
 * For title/duration sorting, the entire list is sorted and can be reversed
 */
export function sortTracks(tracks: Track[], sortBy: TrackSortBy, order: SortOrder = "asc"): Track[] {
	const sorted = [...tracks];
	const multiplier = order === "asc" ? 1 : -1;

	switch (sortBy) {
		case "title":
			// Simple sort by track name - can be reversed
			sorted.sort((a, b) => multiplier * a.track_name.localeCompare(b.track_name));
			break;
		case "artist":
			sorted.sort((a, b) => {
				// Primary: artist name (respects sort order)
				const artistCompare = multiplier * a.artist.localeCompare(b.artist);
				if (artistCompare !== 0) return artistCompare;
				// Secondary: album name (respects sort order)
				const albumCompare = multiplier * a.album.localeCompare(b.album);
				if (albumCompare !== 0) return albumCompare;
				// Tertiary: disc number, then track position (always ascending)
				const discCompare = (a.disc_number || 1) - (b.disc_number || 1);
				if (discCompare !== 0) return discCompare;
				const posA = parseInt(a.track_position || "0", 10);
				const posB = parseInt(b.track_position || "0", 10);
				return posA - posB;
			});
			break;
		case "album":
			sorted.sort((a, b) => {
				// Primary: album name (respects sort order)
				const albumCompare = multiplier * a.album.localeCompare(b.album);
				if (albumCompare !== 0) return albumCompare;
				// Secondary: disc number, then track position (always ascending)
				const discCompare = (a.disc_number || 1) - (b.disc_number || 1);
				if (discCompare !== 0) return discCompare;
				const posA = parseInt(a.track_position || "0", 10);
				const posB = parseInt(b.track_position || "0", 10);
				return posA - posB;
			});
			break;
		case "duration":
			// Simple sort by duration - can be reversed
			sorted.sort((a, b) => multiplier * ((a.duration_seconds || 0) - (b.duration_seconds || 0)));
			break;
		default:
			break;
	}

	return sorted;
}

/**
 * Group tracks by disc number
 */
export function groupTracksByDisc(tracks: Track[]): Map<number, Track[]> {
	const discGroups = new Map<number, Track[]>();

	tracks.forEach((track) => {
		const discNumber = track.disc_number || 1;
		if (!discGroups.has(discNumber)) {
			discGroups.set(discNumber, []);
		}
		discGroups.get(discNumber)!.push(track);
	});

	// Sort tracks within each disc by track position
	discGroups.forEach((discTracks) => {
		discTracks.sort((a, b) => {
			const posA = parseInt(a.track_position || "0", 10);
			const posB = parseInt(b.track_position || "0", 10);
			return posA - posB;
		});
	});

	return discGroups;
}
