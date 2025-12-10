/**
 * Shared utilities for track list rendering
 * Used in both Astro components and client-side JavaScript
 */

import { formatDuration } from "./auth";
import type { Track } from "@/types/music";

export interface TrackListColumn {
	name: "number" | "title" | "artist" | "album" | "duration" | "menu";
	visible: boolean;
}

export interface TrackListConfig {
	columns: ("number" | "title" | "artist" | "album" | "duration" | "menu")[];
	showHeader?: boolean;
	compact?: boolean;
}

/**
 * Generate grid template columns CSS based on selected columns
 */
export function generateGridTemplate(columns: string[]): string {
	return columns
		.map((col) => {
			switch (col) {
				case "number":
					return "minmax(40px, auto)";
				case "title":
					return "1fr";
				case "artist":
					return "1fr";
				case "album":
					return "1fr";
				case "duration":
					return "minmax(60px, auto)";
				case "menu":
					return "minmax(40px, auto)";
				default:
					return "auto";
			}
		})
		.join(" ");
}

/**
 * Generate track list header HTML
 */
export function generateTrackListHeader(columns: string[], compact = false): string {
	const headers: Record<string, string> = {
		number: "#",
		title: "Title",
		artist: "Artist",
		album: "Album",
		duration: "Duration",
		menu: "",
	};

	// Exclude 'number' from grid template since it's handled by placeholder
	const gridColumns = columns.filter((col) => col !== "number");
	const gridTemplate = generateGridTemplate(gridColumns);
	const padding = compact ? "py-2" : "py-3";

	// Add placeholder cells for track number and play/pause icon columns
	const placeholderCells = `
		<div class="w-6 text-right">${columns.includes("number") ? "#" : ""}</div>
		<div class="w-5"></div>
	`;

	const headerCells = columns
		.map((col) => {
			// Skip number column as it's handled by placeholder
			if (col === "number") return "";

			// Match the classes used in track rows
			let cellClasses = "";
			switch (col) {
				case "title":
					cellClasses = "min-w-0";
					break;
				case "artist":
					cellClasses = "min-w-0";
					break;
				case "album":
					cellClasses = "min-w-0";
					break;
				case "duration":
					cellClasses = "text-right";
					break;
				case "menu":
					cellClasses = "w-8";
					break;
			}

			return `<div class="${cellClasses}">
			${headers[col]}
		</div>`;
		})
		.filter(Boolean)
		.join("\n");

	return `
		<div
			class="track-list-header hidden sm:grid gap-4 px-4 bg-palette-200/50 dark:bg-palette-700/50 border-b border-palette-700 dark:border-palette-100 text-xs font-bold text-black dark:text-white uppercase ${padding} mb-2"
			style="grid-template-columns: auto auto ${gridTemplate}">
			${placeholderCells}
			${headerCells}
		</div>
	`;
}

/**
 * Generate a single track row HTML
 */
export function generateTrackRow(
	track: Track,
	index: number,
	columns: string[],
	compact = false,
	albumId?: string
): string {
	// Exclude 'number' from grid template since it's handled separately
	const gridColumns = columns.filter((col) => col !== "number");
	const gridTemplate = generateGridTemplate(gridColumns);
	const padding = compact ? "py-2" : "py-3";
	const showArtistAlbumOnMobile = columns.includes("artist") || columns.includes("album");

	// Build the row HTML
	let rowHTML = `
		<div
			class="track-row group flex items-center gap-3 px-4 bg-light-100/50 dark:bg-palette-700/50 transition-all cursor-pointer ${padding} sm:grid sm:gap-4"
			style="grid-template-columns: auto auto ${gridTemplate}"
			data-track-index="${index}"
			data-track-id="${track.track_id}"
			${albumId ? `data-album-id="${albumId}"` : ""}
			role="button"
			tabindex="0"
			aria-label="Play ${track.track_name}${track.artist ? ` by ${track.artist}` : ""}">
	`;

	// Track Number
	if (columns.includes("number")) {
		rowHTML += `
			<div class="w-6 text-right text-black dark:text-white text-sm font-mono flex-shrink-0 sm:flex-shrink">
				${track.track_position || index + 1}
			</div>
		`;
	}

	// Play/Pause Icon - Always show
	rowHTML += `
		<div class="w-5 flex-shrink-0 flex items-center justify-center">
			<i class="track-play-icon hidden icon-play-fill text-black dark:text-white text-sm" data-track-id="${track.track_id}"></i>
			<i class="track-pause-icon hidden icon-pause text-black dark:text-white text-sm" data-track-id="${track.track_id}"></i>
		</div>
	`;

	// Title
	if (columns.includes("title")) {
		rowHTML += `
			<div class="min-w-0 flex-1 sm:flex-none">
				<p class="text-black dark:text-white font-medium truncate text-sm mt-2 mb-2">${track.track_name}</p>
				${
					showArtistAlbumOnMobile
						? `
					<ul class="text-palette-50 dark:text-palette-200 text-xs sm:hidden">
						${track.artist ? `<li>${track.artist}</li>` : ""}
						${track.album ? `<li>${track.album}</li>` : ""}
					</ul>
				`
						: ""
				}
			</div>
		`;
	}

	// Artist
	if (columns.includes("artist")) {
		rowHTML += `
			<div class="hidden sm:block min-w-0">
				<p class="text-black dark:text-white text-sm truncate">${track.artist || ""}</p>
			</div>
		`;
	}

	// Album
	if (columns.includes("album")) {
		rowHTML += `
			<div class="hidden sm:block min-w-0">
				<p class="text-black dark:text-white text-sm truncate">${track.album || ""}</p>
			</div>
		`;
	}

	// Duration
	if (columns.includes("duration")) {
		const duration = track.duration || formatDuration(track.duration_seconds || 0);
		rowHTML += `
			<div class="text-right text-black dark:text-white text-sm font-mono flex items-center justify-end flex-shrink-0">
				${duration}
			</div>
		`;
	}

	// More Options Menu
	if (columns.includes("menu")) {
		rowHTML += `
			<div class="w-8 flex items-center justify-center flex-shrink-0">
				<a
					class="track-menu-btn p-1.5 no-underline icon transition-all"
					data-track-index="${index}"
					data-track-id="${track.track_id}"
					aria-label="Track options"
					title="More options">
					<i class="icon-three-dots-vertical text-sm"></i>
				</a>
			</div>
		`;
	}

	rowHTML += `
		</div>
	`;

	return rowHTML;
}

/**
 * Generate complete track list HTML
 */
export function generateTrackList(
	tracks: Track[],
	columns: string[],
	options: {
		showHeader?: boolean;
		compact?: boolean;
		containerId?: string;
		albumId?: string;
	} = {}
): string {
	const { showHeader = true, compact = false, containerId = "track-list", albumId } = options;

	let html = `<div id="${containerId}" class="track-list-container ${compact ? "compact" : ""}">`;

	// Add header if requested
	if (showHeader) {
		html += generateTrackListHeader(columns, compact);
	}

	// Add tracks
	html += `<div class="track-list-rows divide-y divide-palette-700/50 dark:divide-palette-100/50">`;

	if (tracks.length === 0) {
		html += `
			<div class="text-center py-8 text-black dark:text-white">
				<i class="icon-music-note-list text-4xl mb-2 block"></i>
				<p>No tracks found</p>
			</div>
		`;
	} else {
		tracks.forEach((track, index) => {
			html += generateTrackRow(track, index, columns, compact, albumId || track.album_id);
		});
	}

	html += `</div></div>`;

	return html;
}
