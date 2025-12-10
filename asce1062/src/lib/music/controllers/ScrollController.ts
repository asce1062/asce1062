/**
 * Scroll Controller
 * Handles all scrolling behavior with singleton pattern
 */

import { musicStore } from "@/scripts/music/MusicStore";
import type { Track } from "@/types/music";

export class ScrollController {
	private scrollToAlbumTimeout: number | null = null;

	/**
	 * Scroll to playing album (singleton approach)
	 */
	scrollToPlayingAlbum(): void {
		// Clear any pending scroll timeout (singleton approach)
		if (this.scrollToAlbumTimeout !== null) {
			clearTimeout(this.scrollToAlbumTimeout);
			this.scrollToAlbumTimeout = null;
		}

		const state = musicStore.getState();
		const currentTrack = state.currentTrack;

		if (!currentTrack || !currentTrack.album_id) {
			return;
		}

		// Use singleton timeout - delay ensures CSS transitions complete
		this.scrollToAlbumTimeout = window.setTimeout(() => {
			// Check which view is currently visible
			const gridContainer = document.getElementById("albums-grid");
			const listContainer = document.getElementById("albums-list");
			const isGridVisible = gridContainer && !gridContainer.classList.contains("hidden");
			const isListVisible = listContainer && !listContainer.classList.contains("hidden");

			let albumElement: Element | null = null;

			// Find album in the currently visible view
			if (isListVisible) {
				albumElement = document.querySelector(`.album-list-item[data-album-id="${currentTrack.album_id}"]`);
			} else if (isGridVisible) {
				albumElement = document.querySelector(`.album-card[data-album-id="${currentTrack.album_id}"]`);
			}

			if (albumElement) {
				albumElement.scrollIntoView({
					behavior: "smooth",
					block: "center",
				});
			}

			// Clear timeout reference
			this.scrollToAlbumTimeout = null;
		}, 450); // Increased delay to ensure DOM and CSS transitions are complete
	}

	/**
	 * Scroll to playing track in tracks view
	 */
	scrollToPlayingTrack(): void {
		const state = musicStore.getState();
		const currentTrack = state.currentTrack;

		if (!currentTrack || !currentTrack.track_id) return;

		// Find the track element in tracks view
		const trackElement = document.querySelector(`#view-tracks [data-track-id="${currentTrack.track_id}"]`);
		if (trackElement) {
			setTimeout(() => {
				trackElement.scrollIntoView({
					behavior: "smooth",
					block: "center",
				});
			}, 100);
		}
	}

	/**
	 * Scroll to active track in a container
	 */
	scrollToActiveTrack(container: HTMLElement, tracks: Track[]): void {
		const state = musicStore.getState();
		const currentTrack = state.currentTrack;

		// Check if current track is in this album's tracks
		if (currentTrack && tracks.some((t) => t.track_id === currentTrack.track_id)) {
			// Find the track row element
			const trackRow = container.querySelector(`[data-track-id="${currentTrack.track_id}"]`);
			if (trackRow) {
				// Use setTimeout to ensure DOM is fully rendered
				setTimeout(() => {
					trackRow.scrollIntoView({
						behavior: "smooth",
						block: "center",
					});
				}, 100);
			}
		}
	}
}
