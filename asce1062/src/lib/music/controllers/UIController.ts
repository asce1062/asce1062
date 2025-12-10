/**
 * UI Controller
 * Handles view switching, keyboard shortcuts, and UI updates
 */

import { musicStore } from "@/scripts/music/MusicStore";
import type { PlayerController } from "@/scripts/music/PlayerController";
import type { Album, Track, TrackerModule } from "@/types/music";

export class UIController {
	private onFilterAlbums?: (query: string) => void;
	private onFilterTracks?: (query: string) => void;
	private onScrollToPlayingAlbum?: () => void;
	private onScrollToPlayingTrack?: () => void;
	private player: PlayerController | null = null;
	private keyboardHandler: ((e: KeyboardEvent) => void) | null = null;

	/**
	 * Set player instance for keyboard shortcuts
	 */
	setPlayer(player: PlayerController): void {
		this.player = player;
	}

	/**
	 * Set callback for filtering albums
	 */
	setFilterAlbumsCallback(callback: (query: string) => void): void {
		this.onFilterAlbums = callback;
	}

	/**
	 * Set callback for filtering tracks
	 */
	setFilterTracksCallback(callback: (query: string) => void): void {
		this.onFilterTracks = callback;
	}

	/**
	 * Set callback for scrolling to playing album
	 */
	setScrollToPlayingAlbumCallback(callback: () => void): void {
		this.onScrollToPlayingAlbum = callback;
	}

	/**
	 * Set callback for scrolling to playing track
	 */
	setScrollToPlayingTrackCallback(callback: () => void): void {
		this.onScrollToPlayingTrack = callback;
	}

	/**
	 * Update tab counts
	 */
	updateTabCounts(albums: Album[], tracks: Track[], trackerModules: TrackerModule[]): void {
		const albumsCountEl = document.getElementById("albums-count");
		const tracksCountEl = document.getElementById("tracks-count");
		const trackersCountEl = document.getElementById("trackers-count");

		if (albumsCountEl) albumsCountEl.textContent = `(${albums.length})`;
		if (tracksCountEl) tracksCountEl.textContent = `(${tracks.length})`;
		if (trackersCountEl) trackersCountEl.textContent = `(${trackerModules.length})`;
	}

	/**
	 * Show load error message
	 */
	showLoadError(): void {
		const albumsViewEl = document.getElementById("view-albums");
		if (albumsViewEl) {
			albumsViewEl.innerHTML = `
				<div class="text-center py-12">
					<i class="icon-music text-6xl text-palette-100 mb-4 block"></i>
					<p class="text-palette-200 text-lg">Failed to load music library</p>
					<p class="text-palette-100 text-sm mt-2">Please refresh the page to try again</p>
				</div>
			`;
		}
	}

	/**
	 * Setup view switching (tabs)
	 */
	setupViewSwitching(): void {
		const tabButtons = document.querySelectorAll(".tab-button");

		tabButtons.forEach((button) => {
			button.addEventListener("click", () => {
				const view = (button as HTMLElement).dataset.view;
				if (view) this.switchView(view);
			});
		});
	}

	/**
	 * Switch between views (albums/tracks/trackers/favourites/playlists)
	 */
	switchView(view: string): void {
		// Update tabs
		const tabButtons = document.querySelectorAll(".tab-button");
		let activeTab: Element | null = null;

		tabButtons.forEach((btn) => {
			const isActive = (btn as HTMLElement).dataset.view === view;
			const countSpan = btn.querySelector("span:last-child");

			if (isActive) {
				activeTab = btn;
				// Active tab styling
				btn.classList.add("active", "text-black");
				btn.classList.remove("text-light-300", "dark:text-palette-300");
				// Update counter styling for active tab
				if (countSpan) {
					countSpan.classList.add("font-semibold");
				}
			} else {
				// Inactive tab styling
				btn.classList.remove("active", "text-black");
				btn.classList.add("text-light-300", "dark:text-palette-300");
				// Update counter styling for inactive tab
				if (countSpan) {
					countSpan.classList.remove("font-semibold");
				}
			}

			btn.setAttribute("aria-selected", isActive.toString());
		});

		// Update tab scales immediately (resets previously active tab size)
		const updateTabScales = (window as typeof window & { updateTabScales?: () => void }).updateTabScales;
		if (typeof updateTabScales === "function") {
			updateTabScales();
		}

		// Scroll active tab to center on mobile
		if (activeTab && window.innerWidth < 640) {
			setTimeout(() => {
				activeTab?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
			}, 100);
		}

		// Update panels
		const viewPanels = document.querySelectorAll(".view-panel");
		viewPanels.forEach((panel) => {
			const panelId = `view-${view}`;
			const isActive = panel.id === panelId;
			panel.classList.toggle("hidden", !isActive);
			(panel as HTMLElement).dataset.active = isActive.toString();
		});

		// Show/hide view controls based on active view
		const allControls = document.querySelectorAll("[data-view-controls]");
		allControls.forEach((control) => {
			const controlView = (control as HTMLElement).dataset.viewControls;
			if (controlView === view) {
				control.classList.remove("hidden");
			} else {
				control.classList.add("hidden");
			}
		});

		musicStore.setView(view as "albums" | "tracks" | "trackers");

		// Apply current search query to new view (including empty string to reset filters)
		const searchInput = document.getElementById("music-search") as HTMLInputElement;
		if (searchInput) {
			const query = searchInput.value || "";
			if (view === "albums") {
				this.onFilterAlbums?.(query);
			} else if (view === "tracks") {
				this.onFilterTracks?.(query);
			}
		}

		// Scroll to playing item when switching views
		if (view === "albums") {
			this.onScrollToPlayingAlbum?.();
		} else if (view === "tracks") {
			this.onScrollToPlayingTrack?.();
		}
	}

	/**
	 * Cleanup keyboard shortcuts
	 */
	cleanup(): void {
		if (this.keyboardHandler) {
			document.removeEventListener("keydown", this.keyboardHandler);
			this.keyboardHandler = null;
		}
	}

	/**
	 * Setup keyboard shortcuts
	 */
	setupKeyboardShortcuts(): void {
		// Remove existing listener if present
		if (this.keyboardHandler) {
			document.removeEventListener("keydown", this.keyboardHandler);
		}

		// Create named handler so we can remove it later
		this.keyboardHandler = (e: KeyboardEvent) => {
			if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
				return;
			}

			switch (e.key.toLowerCase()) {
				case " ":
					e.preventDefault();
					this.player?.togglePlay();
					break;
				case "n":
					e.preventDefault();
					this.player?.next();
					break;
				case "p":
					e.preventDefault();
					this.player?.previous();
					break;
				case "m":
					e.preventDefault();
					this.player?.toggleMute();
					break;
				case "s":
					e.preventDefault();
					this.player?.toggleShuffle();
					break;
				case "r":
					e.preventDefault();
					this.player?.cycleRepeat();
					break;
				case "q":
					// Queue drawer toggle - handled by QueueDrawer component globally
					// Don't preventDefault here to allow QueueDrawer to handle it
					break;
				case "/":
					e.preventDefault();
					document.getElementById("music-search")?.focus();
					break;
			}
		};

		document.addEventListener("keydown", this.keyboardHandler);
	}
}
