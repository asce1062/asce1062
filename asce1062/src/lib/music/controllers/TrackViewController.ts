/**
 * Track View Controller
 * Handles track list rendering and interactions
 */

import { musicStore } from "@/scripts/music/MusicStore";
import { generateTrackList, generateTrackListHeader } from "@/lib/music/trackListUtils";
import { sortTracks, type TrackSortBy } from "@/lib/music/utils/sortingUtils";
import { generateControlsHTML } from "@/lib/music/controlsUtils";
import type { Track } from "@/types/music";

export class TrackViewController {
	private onScrollToTrack?: () => void;
	private currentSortBy: TrackSortBy = "album";
	private currentSortOrder: "asc" | "desc" = "desc";
	private storeUnsubscribe: (() => void) | null = null;

	/**
	 * Cleanup method to unsubscribe from store
	 */
	cleanup(): void {
		if (this.storeUnsubscribe) {
			this.storeUnsubscribe();
			this.storeUnsubscribe = null;
		}
	}

	/**
	 * Set callback for scrolling to playing track
	 */
	setScrollToTrackCallback(callback: () => void): void {
		this.onScrollToTrack = callback;
	}

	/**
	 * Render tracks view
	 */
	renderTracksView(tracks: Track[]): void {
		const tracksViewEl = document.getElementById("view-tracks");
		if (!tracksViewEl) return;

		if (tracks.length === 0) {
			tracksViewEl.innerHTML = `
				<div class="text-center py-12">
					<i class="icon-music-note-list text-6xl text-palette-100 mb-4 block"></i>
					<p class="text-palette-200 text-lg">No tracks found</p>
					<p class="text-palette-100 text-sm mt-2">Check back later for new music!</p>
				</div>
			`;
			return;
		}

		// Apply default sorting
		const sortedTracks = sortTracks(tracks, this.currentSortBy, this.currentSortOrder);

		// Sort controls
		const sortHTML = this.generateSortControls(sortedTracks.length);

		// Generate table header
		const headerHTML = generateTrackListHeader(["number", "title", "artist", "album", "duration", "menu"], false);

		// Generate grouped track list (only group by album when sorting by album)
		const groupByAlbum = this.currentSortBy === "album";
		const tableHTML = `<div id="tracks-table">${headerHTML}${this.generateGroupedTrackList(sortedTracks, groupByAlbum)}</div>`;

		tracksViewEl.innerHTML = sortHTML + tableHTML;
		this.initializeTracksTable();

		// Scroll to playing track after rendering
		this.onScrollToTrack?.();
	}

	/**
	 * Generate sort controls HTML
	 */
	private generateSortControls(_trackCount: number): string {
		return generateControlsHTML({
			id: "track-sort",
			viewName: "tracks",
			sortOptions: [
				{ value: "title", label: "Title", selected: this.currentSortBy === "title" },
				{ value: "album", label: "Album", selected: this.currentSortBy === "album" },
				{ value: "duration", label: "Duration", selected: this.currentSortBy === "duration" },
			],
			currentSortOrder: this.currentSortOrder,
			customRightContent: `
				<div class="flex items-center">
					<a
						id="track-shuffle"
						class="icon no-underline group hover:text-accent scale-90 p-2 sm:p-1 cursor-pointer"
						aria-label="Shuffle all tracks"
						title="Shuffle">
						<i class="icon-shuffle text-2xl"></i>
					</a>
					<a
						id="track-play-all"
						class="icon no-underline group hover:text-accent scale-90 p-2 sm:p-1 cursor-pointer"
						aria-label="Play all tracks"
						title="Play All">
						<i class="icon-play-fill text-2xl"></i>
					</a>
				</div>
			`,
		});
	}

	/**
	 * Initialize tracks table event listeners
	 */
	private initializeTracksTable(): void {
		const tableElement = document.getElementById("tracks-table");
		if (!tableElement) return;

		// Track row clicks
		tableElement.querySelectorAll(".track-row").forEach((row) => {
			row.addEventListener("click", async (e) => {
				// Don't trigger if clicking the menu button
				if ((e.target as HTMLElement).closest(".track-menu-btn")) return;

				const trackId = row.getAttribute("data-track-id");
				if (trackId) {
					await this.playTrackFromList(trackId);
				}
			});

			// Keyboard support
			row.addEventListener("keydown", async (e: Event) => {
				const keyboardEvent = e as KeyboardEvent;
				if (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") {
					keyboardEvent.preventDefault();
					const trackId = row.getAttribute("data-track-id");
					if (trackId) {
						await this.playTrackFromList(trackId);
					}
				}
			});
		});

		// Sort change
		const sortSelect = document.getElementById("track-sort-select") as HTMLSelectElement;
		if (sortSelect) {
			sortSelect.addEventListener("change", () => {
				this.currentSortBy = sortSelect.value as TrackSortBy;
				this.handleTrackSort();
			});
		}

		// Sort order toggle
		const sortOrderBtn = document.getElementById("track-sort-order");
		if (sortOrderBtn) {
			sortOrderBtn.addEventListener("click", () => this.toggleSortOrder());
		}

		// Shuffle button
		const shuffleBtn = document.getElementById("track-shuffle");
		if (shuffleBtn) {
			shuffleBtn.addEventListener("click", () => this.shuffleAllTracks());
		}

		// Play all button
		const playAllBtn = document.getElementById("track-play-all");
		if (playAllBtn) {
			playAllBtn.addEventListener("click", () => this.playAllTracks());
		}

		// Unsubscribe from previous subscription if exists
		if (this.storeUnsubscribe) {
			this.storeUnsubscribe();
		}

		// Subscribe to state changes to update NOW PLAYING indicator
		this.storeUnsubscribe = musicStore.subscribe((state) => {
			if (state.currentTrack) {
				this.updateTrackPlayingIndicator(state.currentTrack);
			}
		});
	}

	/**
	 * Play track from list
	 */
	private async playTrackFromList(trackId: string): Promise<void> {
		if (!window.musicPlayer) return;

		const state = musicStore.getState();
		const tracks = state.tracks;
		const clickedTrack = tracks.find((t) => t.track_id === trackId);

		if (!clickedTrack) {
			console.warn("Track not found:", trackId);
			return;
		}

		// Find the index of the clicked track in the full tracks array
		const trackIndex = tracks.findIndex((t) => t.track_id === trackId);

		try {
			// Check if this is the current track
			if (state.currentTrack && state.currentTrack.track_id === clickedTrack.track_id) {
				// Toggle play/pause
				window.musicPlayer.togglePlay();
			} else {
				// Set queue with all tracks and play the clicked track
				await window.musicPlayer.setQueue(tracks, trackIndex, true);
			}
		} catch (error) {
			console.error("Failed to play track:", error);
		}
	}

	/**
	 * Update track playing indicator
	 */
	private updateTrackPlayingIndicator(currentTrack: Track): void {
		const state = musicStore.getState();
		const isPlaying = state.isPlaying;

		// Remove all existing indicators
		document.querySelectorAll(".track-row").forEach((row) => {
			row.classList.remove("bg-light-200/30", "dark:bg-palette-900/30");
		});

		// Hide all play/pause icons in tracks view
		document.querySelectorAll("#view-tracks .track-play-icon, #view-tracks .track-pause-icon").forEach((icon) => {
			icon.classList.add("hidden");
		});

		// Add indicator to currently playing track
		if (currentTrack && currentTrack.track_id) {
			const trackRow = document.querySelector(`#view-tracks [data-track-id="${currentTrack.track_id}"]`);
			if (trackRow) {
				trackRow.classList.add("bg-light-200/30", "dark:bg-palette-900/30");

				// Show appropriate play/pause icon
				const playIcon = trackRow.querySelector(`.track-play-icon[data-track-id="${currentTrack.track_id}"]`);
				const pauseIcon = trackRow.querySelector(`.track-pause-icon[data-track-id="${currentTrack.track_id}"]`);

				if (isPlaying && pauseIcon) {
					pauseIcon.classList.remove("hidden");
				} else if (!isPlaying && playIcon) {
					playIcon.classList.remove("hidden");
				}
			}
		}
	}

	/**
	 * Handle track sorting
	 */
	handleTrackSort(): void {
		const state = musicStore.getState();
		const tracks = sortTracks(state.tracks, this.currentSortBy, this.currentSortOrder);

		const tableElement = document.getElementById("tracks-table");
		if (!tableElement) return;

		// Generate table header
		const headerHTML = generateTrackListHeader(["number", "title", "artist", "album", "duration", "menu"], false);

		// Generate grouped track list (only group by album when sorting by album)
		const groupByAlbum = this.currentSortBy === "album";
		const tableHTML = `<div id="tracks-table">${headerHTML}${this.generateGroupedTrackList(tracks, groupByAlbum)}</div>`;

		// Replace the table element
		const tracksViewEl = document.getElementById("view-tracks");
		if (tracksViewEl) {
			// Keep the sort controls, regenerate them with updated state
			const sortControls = this.generateSortControls(tracks.length);
			tracksViewEl.innerHTML = sortControls + tableHTML;
		}

		// Reinitialize event listeners
		this.initializeTracksTable();
	}

	/**
	 * Toggle sort order between ascending and descending
	 */
	toggleSortOrder(): void {
		this.currentSortOrder = this.currentSortOrder === "asc" ? "desc" : "asc";
		this.handleTrackSort();

		// Update button icon, title, and aria-label (show next action, not current state)
		const sortOrderBtn = document.getElementById("track-sort-order");
		if (sortOrderBtn) {
			const icon = sortOrderBtn.querySelector("i");
			const nextAction = this.currentSortOrder === "asc" ? "descending" : "ascending";
			sortOrderBtn.setAttribute("data-order", this.currentSortOrder);
			sortOrderBtn.setAttribute("title", `Sort ${nextAction}`);
			sortOrderBtn.setAttribute("aria-label", `Sort ${nextAction}`);
			if (icon) {
				icon.className = `icon-sort-${this.currentSortOrder === "asc" ? "up" : "down"} text-2xl`;
			}
		}
	}

	/**
	 * Shuffle all tracks
	 */
	async shuffleAllTracks(): Promise<void> {
		if (!window.musicPlayer) return;

		const state = musicStore.getState();
		const tracks = [...state.tracks];

		// Shuffle array
		for (let i = tracks.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[tracks[i], tracks[j]] = [tracks[j], tracks[i]];
		}

		try {
			// Set shuffled queue and play first track
			await window.musicPlayer.setQueue(tracks, 0, true);
		} catch (error) {
			console.error("Failed to shuffle tracks:", error);
		}
	}

	/**
	 * Play all tracks in order
	 */
	async playAllTracks(): Promise<void> {
		if (!window.musicPlayer) return;

		const state = musicStore.getState();
		const tracks = sortTracks(state.tracks, this.currentSortBy, this.currentSortOrder);

		try {
			// Set queue with current sort order and play first track
			await window.musicPlayer.setQueue(tracks, 0, true);
		} catch (error) {
			console.error("Failed to play all tracks:", error);
		}
	}

	/**
	 * Filter tracks by search query
	 */
	filterTracks(query: string): void {
		const state = musicStore.getState();
		const filtered = query
			? state.tracks.filter(
					(track: Track) =>
						track.track_name.toLowerCase().includes(query.toLowerCase()) ||
						track.artist.toLowerCase().includes(query.toLowerCase()) ||
						track.album.toLowerCase().includes(query.toLowerCase())
				)
			: state.tracks;

		const tracks = sortTracks(filtered, this.currentSortBy, this.currentSortOrder);

		const tableElement = document.getElementById("tracks-table");
		if (!tableElement) return;

		// Generate table header
		const headerHTML = generateTrackListHeader(["number", "title", "artist", "album", "duration", "menu"], false);

		// Generate grouped track list (only group by album when sorting by album)
		const groupByAlbum = this.currentSortBy === "album";
		const tableHTML = `<div id="tracks-table">${headerHTML}${this.generateGroupedTrackList(tracks, groupByAlbum)}</div>`;

		// Replace the table element
		const tracksViewEl = document.getElementById("view-tracks");
		if (tracksViewEl) {
			// Regenerate sort controls with updated track count
			const sortControls = this.generateSortControls(tracks.length);
			tracksViewEl.innerHTML = sortControls + tableHTML;
		}

		// Reinitialize event listeners after filtering
		this.initializeTracksTable();
	}

	/**
	 * Generate grouped track list HTML with album and disc separators
	 * Matches the implementation from AlbumViewController.renderAlbumTracksGrouped
	 * @param tracks - Array of tracks to display
	 * @param groupByAlbum - Whether to group tracks by album (only for album sort)
	 */
	private generateGroupedTrackList(tracks: Track[], groupByAlbum: boolean = false): string {
		// For non-album sorts, show flat list without grouping
		if (!groupByAlbum) {
			const tracksHTML = generateTrackList(tracks, ["number", "title", "artist", "album", "duration", "menu"], {
				showHeader: false,
				compact: false,
				containerId: "tracks-flat",
			});
			return tracksHTML;
		}

		// Group tracks by album (only for album sort)
		const albumGroups: Record<string, Track[]> = {};
		tracks.forEach((track) => {
			const albumKey = track.album || "Unknown Album";
			if (!albumGroups[albumKey]) {
				albumGroups[albumKey] = [];
			}
			albumGroups[albumKey].push(track);
		});

		// Generate HTML for each album
		const albumsHTML = Object.keys(albumGroups)
			.map((albumName) => {
				const albumTracks = albumGroups[albumName];

				// Group tracks by disc within this album (same logic as album view)
				const discGroups: Record<string, Track[]> = {};

				albumTracks.forEach((track, _index) => {
					// Try multiple fields for disc number
					let discNum = track.disc_number || track.disc || track.part || track.part_position || 1;

					// Convert to number if it's a string number
					if (typeof discNum === "string" && !isNaN(parseInt(discNum))) {
						discNum = parseInt(discNum);
					}

					// Check if this is an extras/bonus track - multiple detection methods
					const trackName = (track.track_name || "").toLowerCase();
					const albumNameLower = (track.album || "").toLowerCase();
					const cdnUrl = (track.cdn_url || "").toLowerCase();
					const s3Url = (track.s3_url || "").toLowerCase();
					const discNumStr = String(discNum).toLowerCase();

					const isExtras =
						discNumStr.includes("extra") ||
						trackName.includes("extra") ||
						trackName.includes("bonus") ||
						albumNameLower.includes("extra") ||
						cdnUrl.includes("/extras/") ||
						s3Url.includes("/extras/");

					if (isExtras) {
						discNum = 2;
					}

					const discKey = `Disc ${discNum}`;
					if (!discGroups[discKey]) {
						discGroups[discKey] = [];
					}
					discGroups[discKey].push(track);
				});

				// Sort discs numerically
				const sortedDiscs = Object.keys(discGroups).sort((a, b) => {
					const numA = parseInt(a.replace("Disc ", ""));
					const numB = parseInt(b.replace("Disc ", ""));
					return numA - numB;
				});

				// Render grouped tracks for this album
				const contentHTML = sortedDiscs
					.map((discName, discIndex) => {
						const discTracks = discGroups[discName].sort((a, b) => {
							const posA = parseInt(a.track_position || "0", 10);
							const posB = parseInt(b.track_position || "0", 10);
							return posA - posB;
						});

						// Use the shared track list utility
						const tracksHTML = generateTrackList(
							discTracks,
							["number", "title", "artist", "album", "duration", "menu"],
							{
								showHeader: false,
								compact: false,
								containerId: `tracks-${albumName.replace(/\s+/g, "-")}-${discName.replace(" ", "-")}`,
							}
						);

						// Show disc header when there are multiple discs
						const showDiscHeader = sortedDiscs.length > 1;
						const isLastDisc = discIndex === sortedDiscs.length - 1;

						return `
							<div class="disc-group p-4 border-t border-palette-700/50 dark:border-palette-100/50 first:border-t-0 ${isLastDisc ? "last:border-b-0" : ""}">
								${
									showDiscHeader
										? `<h4 class="font-retro text-sm font-bold text-light-300 dark:text-palette-300 mt-4 mb-2 uppercase tracking-wide flex items-center gap-2">
									<i class="icon-disc"></i>
									${discName}
								</h4>`
										: ""
								}
								${tracksHTML}
							</div>
						`;
					})
					.join("");

				// Album header with content
				return `
					<div class="album-group border border-palette-900/30 dark:border-palette-50/30 mb-2">
						<h3 class="font-retro text-sm font-bold text-black dark:text-white px-4 py-2 bg-palette-200/50 dark:bg-palette-700/50 uppercase tracking-wide flex items-center gap-2">
							<i class="icon-disc-fill"></i>
							${albumName}
						</h3>
						${contentHTML}
					</div>
				`;
			})
			.join("");

		return albumsHTML;
	}

	/**
	 * Format track duration from seconds
	 */
	formatTrackDuration(seconds: number): string {
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return `${mins}:${secs.toString().padStart(2, "0")}`;
	}
}
