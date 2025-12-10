/**
 * Search Controller
 * Handles search input and filtering
 */

import { musicStore } from "@/scripts/music/MusicStore";
import type { Album } from "@/types/music";

export class SearchController {
	private debounceTimer: number | null = null;
	private onFilterAlbums?: (query: string) => void;
	private onFilterTracks?: (query: string) => void;

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
	 * Setup search input listener
	 * With transition:persist, only attach listener once per element
	 */
	setupSearch(): void {
		const searchInput = document.getElementById("music-search") as HTMLInputElement;
		if (!searchInput) {
			console.warn("🔍 Search input not found");
			return;
		}

		// Check if listener is already attached using data attribute (for persisted elements)
		if (searchInput.dataset.listenerAttached === "true") {
			return;
		}

		searchInput.addEventListener("input", (e) => {
			if (this.debounceTimer) {
				clearTimeout(this.debounceTimer);
			}

			const query = (e.target as HTMLInputElement).value;

			this.debounceTimer = window.setTimeout(() => {
				this.handleSearch(query);
			}, 300);
		});

		// Mark element as having listener attached
		searchInput.dataset.listenerAttached = "true";

		// Note: URL parameter handling is done by handleURLParameters() in the music page
		// to avoid conflicts with view switching. We just set up the input listener here.
	}

	/**
	 * Handle search query
	 */
	private handleSearch(query: string): void {
		// Update URL with search query and current view
		const url = new URL(window.location.href);
		const state = musicStore.getState();

		if (query) {
			url.searchParams.set("search", query);
			// Add view parameter to make search results shareable
			if (state.currentView) {
				url.searchParams.set("view", state.currentView);
			}
		} else {
			url.searchParams.delete("search");
			// Keep view parameter even when search is cleared
			if (state.currentView && state.currentView !== "albums") {
				url.searchParams.set("view", state.currentView);
			} else {
				url.searchParams.delete("view");
			}
		}
		window.history.replaceState({}, "", url);

		// Filter current view
		if (state.currentView === "albums") {
			this.onFilterAlbums?.(query);
		} else if (state.currentView === "tracks") {
			this.onFilterTracks?.(query);
		}
	}

	/**
	 * Filter albums by search query
	 */
	filterAlbums(query: string, createAlbumCard: (album: Album) => string): void {
		const state = musicStore.getState();
		const filtered = query
			? state.albums.filter(
					(album: Album) =>
						album.album.toLowerCase().includes(query.toLowerCase()) ||
						album.artist.toLowerCase().includes(query.toLowerCase())
				)
			: state.albums;

		const gridElement = document.getElementById("albums-grid");
		if (!gridElement) return;

		if (filtered.length === 0) {
			gridElement.innerHTML = `
				<div class="col-span-full text-center py-12">
					<i class="icon-search-heart text-6xl text-palette-100 mb-4 block"></i>
					<p class="text-palette-200 text-lg">No results for "${query}"</p>
					<p class="text-palette-100 text-sm mt-2">Try a different search term</p>
				</div>
			`;
		} else {
			gridElement.innerHTML = filtered.map((album: Album) => createAlbumCard(album)).join("");
		}
	}

	/**
	 * Clear search
	 */
	clearSearch(): void {
		const searchInput = document.getElementById("music-search") as HTMLInputElement;
		if (searchInput) {
			searchInput.value = "";
			this.handleSearch("");
		}
	}
}
