/**
 * Playback Controller
 * Handles play/pause functionality and UI updates
 */

import { musicStore } from "@/scripts/music/MusicStore";
import type { PlayerController } from "@/scripts/music/PlayerController";
import type { Track, MusicState } from "@/types/music";

export class PlaybackController {
	private player: PlayerController | null = null;

	/**
	 * Set PlayerController instance
	 */
	setPlayerController(player: PlayerController): void {
		this.player = player;
	}

	/**
	 * Toggle album play/pause
	 */
	async toggleAlbumPlayPause(albumId: string, button: HTMLButtonElement): Promise<void> {
		if (!this.player) return;

		const isPlaying = button.getAttribute("data-playing") === "true";
		const state = musicStore.getState();

		try {
			if (isPlaying) {
				// Pause playback
				this.player.pause();
				this.updateAlbumPlayButton(albumId, false);
			} else {
				// Check if this album is already in queue
				const currentAlbumId = state.currentTrack?.album_id;

				if (currentAlbumId === albumId && state.isPaused) {
					// Resume playback
					this.player.togglePlay();
				} else {
					// Load and play new album
					const tracks = await window.musicSDK?.getAlbumTracks(albumId);
					if (tracks && tracks.length > 0) {
						// Use PlayerController to set queue with validation
						await this.player.setQueue(tracks, 0, true);
					}
				}
				this.updateAlbumPlayButton(albumId, true);
			}
		} catch (error) {
			console.error("Failed to toggle album playback:", error);
		}
	}

	/**
	 * Update album play button state
	 */
	updateAlbumPlayButton(albumId: string, isPlaying: boolean): void {
		// Update all play buttons for this album (both grid and list view)
		const buttons = document.querySelectorAll(`[data-album-id="${albumId}"][data-playing]`);

		buttons.forEach((btn) => {
			const icon = btn.querySelector("i");
			const text = btn.querySelector("span");

			btn.setAttribute("data-playing", isPlaying.toString());

			if (isPlaying) {
				if (icon) icon.className = "icon-pause text-black dark:text-black";
				if (text) text.textContent = "Pause";
				btn.setAttribute("title", "Pause album");
			} else {
				if (icon) icon.className = "icon-play-fill text-black dark:text-black";
				if (text) text.textContent = "Play";
				btn.setAttribute("title", "Play album");
			}
		});
	}

	/**
	 * Update all play/pause buttons based on state
	 */
	updatePlayPauseButtons(state: MusicState): void {
		// Reset all play buttons first
		const allPlayButtons = document.querySelectorAll('[data-playing="true"]');
		allPlayButtons.forEach((btn) => {
			const icon = btn.querySelector("i");
			const text = btn.querySelector("span");
			btn.setAttribute("data-playing", "false");
			if (icon) icon.className = "icon-play-fill text-black dark:text-black";
			if (text) text.textContent = "Play";
		});

		// Update the currently playing album's button
		if (state.currentTrack && state.isPlaying) {
			const albumId = state.currentTrack.album_id;
			if (albumId) {
				this.updateAlbumPlayButton(albumId, true);
			}
		}
	}

	/**
	 * Update now playing indicator badge
	 */
	updateNowPlayingIndicator(currentTrack: Track): void {
		// Remove all existing badges and active borders
		document.querySelectorAll(".now-playing-badge").forEach((badge) => {
			badge.classList.add("hidden");
		});
		document.querySelectorAll(".album-card, .album-list-item").forEach((album) => {
			album.classList.remove("border-palette-500", "dark:border-palette-600");
			album.classList.add("border-palette-700/50", "dark:border-palette-100/50");
		});

		// Add badge and active border to currently playing album (both grid and list view)
		if (currentTrack && currentTrack.album_id) {
			const albumElements = document.querySelectorAll(`[data-album-id="${currentTrack.album_id}"]`);
			albumElements.forEach((albumElement) => {
				const badge = albumElement.querySelector(".now-playing-badge");
				if (badge) {
					badge.classList.remove("hidden");
				}
				// Add active border color (same as hover)
				albumElement.classList.remove("border-palette-700/50", "dark:border-palette-100/50");
				albumElement.classList.add("border-palette-500", "dark:border-palette-600");
			});
		}
	}

	/**
	 * Update track indicators in list view
	 */
	updateListViewTrackIndicators(): void {
		const state = musicStore.getState();
		const currentTrack = state.currentTrack;
		const isPlaying = state.isPlaying;

		// Hide all play/pause icons first
		document.querySelectorAll(".track-play-icon, .track-pause-icon").forEach((icon) => {
			icon.classList.add("hidden");
		});

		// Show icon for currently playing track
		if (currentTrack && currentTrack.track_id) {
			const playIcons = document.querySelectorAll(`.track-play-icon[data-track-id="${currentTrack.track_id}"]`);
			const pauseIcons = document.querySelectorAll(`.track-pause-icon[data-track-id="${currentTrack.track_id}"]`);

			if (isPlaying) {
				pauseIcons.forEach((icon) => icon.classList.remove("hidden"));
			} else {
				playIcons.forEach((icon) => icon.classList.remove("hidden"));
			}
		}
	}
}
