/**
 * Album View Controller
 * Handles album grid/list rendering and interactions
 */

import { musicStore } from "@/scripts/music/MusicStore";
import { generateTrackList } from "@/lib/music/trackListUtils";
import { sortAlbums, type AlbumSortBy, type SortOrder } from "@/lib/music/utils/sortingUtils";
import type { PlayerController } from "@/scripts/music/PlayerController";
import type { Album, Track, MusicState } from "@/types/music";

export class AlbumViewController {
	private player: PlayerController | null = null;
	private currentSortOrder: SortOrder = "desc";
	private currentSortBy: AlbumSortBy = "release";
	private currentSearchQuery: string = "";
	private onScrollToAlbum?: () => void;
	private onScrollToTrack?: (container: HTMLElement, tracks: Track[]) => void;
	private onTogglePlayPause?: (albumId: string, button: HTMLButtonElement) => Promise<void>;
	private onUpdateNowPlaying?: (track: Track) => void;
	private onUpdatePlayButtons?: (state: MusicState) => void;
	private onUpdateTrackIndicators?: () => void;
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
	 * Set PlayerController instance
	 */
	setPlayerController(player: PlayerController): void {
		this.player = player;
	}

	/**
	 * Set callback for scrolling to playing album
	 */
	setScrollToAlbumCallback(callback: () => void): void {
		this.onScrollToAlbum = callback;
	}

	/**
	 * Set callback for scrolling to active track
	 */
	setScrollToActiveTrackCallback(callback: (container: HTMLElement, tracks: Track[]) => void): void {
		this.onScrollToTrack = callback;
	}

	/**
	 * Set callback for toggling album play/pause
	 */
	setTogglePlayPauseCallback(callback: (albumId: string, button: HTMLButtonElement) => Promise<void>): void {
		this.onTogglePlayPause = callback;
	}

	/**
	 * Set callback for updating now playing indicator
	 */
	setUpdateNowPlayingCallback(callback: (track: Track) => void): void {
		this.onUpdateNowPlaying = callback;
	}

	/**
	 * Set callback for updating play buttons
	 */
	setUpdatePlayButtonsCallback(callback: (state: MusicState) => void): void {
		this.onUpdatePlayButtons = callback;
	}

	/**
	 * Set callback for updating track indicators
	 */
	setUpdateTrackIndicatorsCallback(callback: () => void): void {
		this.onUpdateTrackIndicators = callback;
	}

	/**
	 * Render albums view (both grid and list)
	 */
	renderAlbumsView(albums: Album[]): void {
		const albumsViewEl = document.getElementById("view-albums");
		if (!albumsViewEl) return;

		if (albums.length === 0) {
			albumsViewEl.innerHTML = `
				<div class="text-center py-12">
					<i class="icon-music text-6xl text-palette-100 mb-4 block"></i>
					<p class="text-palette-200 text-lg">No albums found</p>
					<p class="text-palette-100 text-sm mt-2">Check back later for new music!</p>
				</div>
			`;
			return;
		}

		// Read current sort values from UI (in case they were persisted by view transitions)
		const sortSelect = document.getElementById("album-sort-select") as HTMLSelectElement;
		const sortOrderBtn = document.getElementById("album-sort-order");
		if (sortSelect && sortSelect.value) {
			this.currentSortBy = sortSelect.value as AlbumSortBy;
		}
		if (sortOrderBtn) {
			const order = sortOrderBtn.getAttribute("data-order");
			if (order === "asc" || order === "desc") {
				this.currentSortOrder = order;
			}
		}

		// Sort albums
		const sortedAlbums = sortAlbums(albums, this.currentSortBy, this.currentSortOrder);

		// Album grid view
		const gridHTML = `
			<div id="albums-grid" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
				${sortedAlbums.map((album) => this.createAlbumCard(album)).join("")}
			</div>
		`;

		// Album list view (hidden by default)
		const listHTML = `
			<div id="albums-list" class="hidden space-y-4">
				${sortedAlbums.map((album) => this.createAlbumListItem(album)).join("")}
			</div>
		`;

		albumsViewEl.innerHTML = gridHTML + listHTML;
		this.initializeAlbumGrid();

		// Scroll to playing album after rendering
		this.onScrollToAlbum?.();
	}

	/**
	 * Create album card HTML (grid view)
	 */
	private createAlbumCard(album: Album): string {
		const coverArtUrl = album.cdn_cover_url;
		return `
			<div
				class="album-card relative bg-light-100/30 dark:bg-palette-700/30 overflow-hidden border border-palette-700/50 dark:border-palette-100/50 hover:border-palette-500 dark:hover:border-palette-600 transition-all"
				data-album-id="${album.album_id}"
				tabindex="0">
				<!-- Album Cover (transparent background) -->
				<div class="aspect-square relative cursor-pointer album-card-artwork group" data-album-id="${album.album_id}">
					<img
						src="${coverArtUrl}"
						alt="${album.album} cover"
						class="w-full h-full object-cover"
						loading="lazy"
					/>
					<!-- Overlay on hover -->
					<div class="absolute inset-0 bg-light-100/80 dark:bg-palette-700/80 transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
						<a class="no-underline"><i class="icon-info-circle icon text-5xl"></i></a>
					</div>
					<!-- Now Playing Badge -->
					<div class="now-playing-badge font-retro hidden absolute top-2 left-2 bg-light-100/30 dark:bg-palette-700/30 backdrop-blur-sm text-black dark:text-white text-xs font-bold px-2 py-1 border border-palette-700/50 dark:border-palette-100/50 hover:border-palette-500 dark:hover:border-palette-600">
						<i class="icon-volume-up"></i> PLAYING
					</div>
				</div>

				<!-- Album Info -->
				<div class="p-3 bg-light-100/30 dark:bg-palette-700/30 backdrop-blur-sm">
					<h3 class="font-bold font-retro truncate text-sm" title="${album.album}">
						${album.album}
					</h3>
					<p class="font-retro text-xs text-palette-50 dark:text-palette-200 truncate mb-2" title="${album.artist}">
						${album.artist}
					</p>
					<div class="flex items-center gap-2 text-xs mb-2">
						<ul class="text-palette-50 dark:text-palette-200">
							<li><i class="icon-calendar-event"></i> ${album.year}</li>
							<li><i class="icon-disc"></i> ${album.total_tracks} tracks</li>
							<li><i class="icon-clock"></i> ${album.duration || "N/A"}</li>
						</ul>
					</div>

					<!-- Action Buttons -->
					<div class="flex items-center gap-1">
						<button class="album-card-play-btn flex-1 px-2 py-1.5 bg-palette-300 dark:bg-palette-600 hover:bg-palette-400 dark:hover:bg-palette-500 font-bold transition-all flex items-center justify-center gap-1"
							data-album-id="${album.album_id}"
							data-playing="false"
							title="Play album">
							<i class="icon-play-fill text-black dark:text-black"></i>
							<span class="font-retro text-black dark:text-black">Play</span>
						</button>
						<button class="album-card-tracks-btn px-2 py-1.5 text-sm font-medium hover:bg-palette-200 dark:hover:bg-palette-300 transition-all flex items-center gap-2 group"
							data-album-id="${album.album_id}"
							title="Show tracks">
							<i class="icon-chevron-down text-xl text-light-300 dark:text-palette-300 group-hover:text-black transition-colors"></i>
						</button>
					</div>
				</div>
			</div>
		`;
	}

	/**
	 * Create album list item HTML (list view)
	 */
	private createAlbumListItem(album: Album): string {
		const coverArtUrl = album.cdn_cover_url;
		return `
			<div class="album-list-item bg-light-100/30 dark:bg-palette-700/30 overflow-hidden border border-palette-700/50 dark:border-palette-100/50 hover:border-palette-500 dark:hover:border-palette-600 transition-all"
				data-album-id="${album.album_id}">
				<!-- Album Header -->
				<div class="flex items-start gap-4 p-4 album-list-header" data-album-id="${album.album_id}">
					<!-- Album Artwork with Overlay -->
					<div class="flex-shrink-0 w-24 h-24 sm:w-32 sm:h-32 relative cursor-pointer album-card-artwork group overflow-hidden" data-album-id="${album.album_id}">
						<img
							src="${coverArtUrl}"
							alt="${album.album} cover"
							class="w-full h-full object-cover"
							loading="lazy"
						/>
						<!-- Overlay on hover -->
						<div class="absolute inset-0 bg-light-100/80 dark:bg-palette-700/80 transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
							<a class="no-underline"><i class="icon-info-circle icon text-3xl sm:text-4xl"></i></a>
						</div>
						<!-- Now Playing Badge -->
						<div class="now-playing-badge hidden font-retro absolute top-1 left-1 bg-light-100/30 dark:bg-palette-700/30 backdrop-blur-sm text-black dark:text-white text-xs font-bold px-1.5 py-0.5 border border-palette-700/50 dark:border-palette-100/50">
							<i class="icon-volume-up"></i> PLAYING
						</div>
					</div>

					<!-- Album Info -->
					<div class="flex-1 min-w-0">
						<h3 class="font-retro font-bold text-xl mb-1">${album.album}</h3>
						<p class="font-retro text-sm text-palette-50 dark:text-palette-200 mb-2">${album.artist}</p>
						<div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs mb-3">
						<ul class="text-palette-50 dark:text-palette-200">
							<li><i class="icon-calendar-event"></i> ${album.year}</li>
							<li><i class="icon-disc"></i> ${album.total_tracks} tracks</li>
							<li><i class="icon-clock"></i> ${album.duration || "N/A"}</li>
						</ul>
						</div>

						<!-- Action Buttons -->
						<div class="flex items-center gap-2">
							<button class="album-play-btn px-4 py-2 bg-palette-300 dark:bg-palette-600 hover:bg-palette-400 dark:hover:bg-palette-500 font-bold transition-all flex items-center gap-2"
								data-album-id="${album.album_id}"
								data-playing="false">
								<i class="icon-play-fill text-black dark:black"></i>
								<span class="font-retro text-black dark:text-black">Play</span>
							</button>
							<button class="album-expand-btn px-4 py-2 text-sm font-medium hover:bg-palette-200 dark:hover:bg-palette-300 transition-all flex items-center gap-2 group"
								data-album-id="${album.album_id}">
								<i class="icon-chevron-down text-light-300 dark:text-palette-300 group-hover:text-black transition-colors"></i>
								<span class="font-retro text-light-300 dark:text-palette-300 group-hover:text-black transition-colors">Show Tracks</span>
							</button>
						</div>
					</div>
				</div>

				<!-- Track List (Hidden by default, loaded on demand) -->
				<div class="album-tracks hidden border-t border-palette-700/50 dark:border-palette-100/50" data-album-id="${album.album_id}">
					<div class="p-4">
						<div class="flex items-center justify-center py-8 text-palette-100">
							<i class="icon-music-note-list text-4xl animate-pulse"></i>
							<span class="ml-3">Loading tracks...</span>
						</div>
					</div>
				</div>
			</div>
		`;
	}

	/**
	 * Initialize album grid event listeners
	 */
	initializeAlbumGrid(): void {
		const gridElement = document.getElementById("albums-grid");
		const listElement = document.getElementById("albums-list");

		// View toggle button
		const viewToggleBtn = document.getElementById("album-view-toggle");
		if (viewToggleBtn) {
			// Remove any existing listeners by cloning and replacing
			const newToggleBtn = viewToggleBtn.cloneNode(true) as HTMLElement;
			viewToggleBtn.parentNode?.replaceChild(newToggleBtn, viewToggleBtn);

			newToggleBtn.addEventListener("click", () => {
				this.toggleAlbumView();
			});
		} else {
			console.warn("⚠️  View toggle button not found!");
		}

		// Grid view interactions
		if (gridElement) {
			gridElement.addEventListener("click", async (e) => {
				// Check if click is on album info section (title, artist, metadata) - allow text selection
				const albumInfo = (e.target as HTMLElement).closest(".album-card > div:not(.album-card-artwork)");
				if (albumInfo) {
					// Don't open modal when clicking on album info section
					// Check if we clicked a button though
					const isButton = (e.target as HTMLElement).closest("button");
					if (!isButton) {
						e.stopPropagation();
						return;
					}
				}

				// Play/Pause button
				const playBtn = (e.target as HTMLElement).closest(".album-card-play-btn");
				if (playBtn) {
					e.stopPropagation();
					const albumId = playBtn.getAttribute("data-album-id");
					if (albumId && this.onTogglePlayPause) {
						await this.onTogglePlayPause(albumId, playBtn as HTMLButtonElement);
					}
					return;
				}

				// Show tracks button - open album detail modal
				const tracksBtn = (e.target as HTMLElement).closest(".album-card-tracks-btn");
				if (tracksBtn) {
					e.stopPropagation();
					const albumId = tracksBtn.getAttribute("data-album-id");
					if (albumId) {
						const albumCard = document.querySelector(`[data-album-id="${albumId}"].album-card`);
						if (albumCard) {
							albumCard.dispatchEvent(new MouseEvent("click", { bubbles: true }));
						}
					}
					return;
				}

				// Album artwork - open modal (existing behavior)
				const artwork = (e.target as HTMLElement).closest(".album-card-artwork");
				if (artwork) {
					const albumId = artwork.getAttribute("data-album-id");
					if (albumId) {
						const albumCard = document.querySelector(`[data-album-id="${albumId}"].album-card`);
						if (albumCard) {
							albumCard.dispatchEvent(new MouseEvent("click", { bubbles: true }));
						}
					}
				}
			});

			// Keyboard navigation
			gridElement.addEventListener("keydown", (event) => {
				const albumCard = (event.target as HTMLElement).closest(".album-card");
				if (albumCard && (event.key === "Enter" || event.key === "i")) {
					event.preventDefault();
					albumCard.dispatchEvent(new MouseEvent("click", { bubbles: true }));
				}
			});
		}

		// List view interactions
		if (listElement) {
			listElement.addEventListener("click", async (e) => {
				// Check if clicking menu button - let it bubble to document handler
				const menuBtn = (e.target as HTMLElement).closest(".track-menu-btn");
				if (menuBtn) {
					// Don't stop propagation for menu buttons
					return;
				}

				// Check if click is in expanded track area - prevent modal opening
				const trackArea = (e.target as HTMLElement).closest(".album-tracks");
				if (trackArea && !trackArea.classList.contains("hidden")) {
					// Don't open modal when clicking in the expanded track list
					e.stopPropagation();
					// Let track row clicks be handled by their specific handlers below
				}

				// Check if click is on album info section - prevent modal opening for text selection
				const albumInfo = (e.target as HTMLElement).closest(".album-list-header > div:not(.album-card-artwork)");
				if (albumInfo) {
					// Don't open modal when clicking on album info section
					// Check if we clicked a button though
					const isButton = (e.target as HTMLElement).closest("button");
					if (!isButton) {
						e.stopPropagation();
						return;
					}
				}

				// Album expand/collapse buttons
				const expandBtn = (e.target as HTMLElement).closest(".album-expand-btn");
				if (expandBtn) {
					e.stopPropagation();
					const albumId = expandBtn.getAttribute("data-album-id");
					if (albumId) {
						await this.toggleAlbumTracks(albumId);
					}
					return;
				}

				// Album play buttons
				const playBtn = (e.target as HTMLElement).closest(".album-play-btn");
				if (playBtn) {
					e.stopPropagation();
					const albumId = playBtn.getAttribute("data-album-id");
					if (albumId && this.onTogglePlayPause) {
						await this.onTogglePlayPause(albumId, playBtn as HTMLButtonElement);
					}
					return;
				}

				// Album artwork clicks will bubble up to modal handler
				// No need to handle here - just let it propagate
			});
		}

		// Sort change
		const sortSelect = document.getElementById("album-sort-select") as HTMLSelectElement;
		if (sortSelect) {
			sortSelect.addEventListener("change", () => this.handleAlbumSort(sortSelect.value as AlbumSortBy));
		}

		// Sort order toggle
		const sortOrderBtn = document.getElementById("album-sort-order");
		if (sortOrderBtn) {
			sortOrderBtn.addEventListener("click", () => this.toggleSortOrder());
		}

		// Unsubscribe from previous subscription if exists
		if (this.storeUnsubscribe) {
			this.storeUnsubscribe();
		}

		// Subscribe to state changes
		this.storeUnsubscribe = musicStore.subscribe((state) => {
			if (state.currentTrack) {
				this.onUpdateNowPlaying?.(state.currentTrack);
			}
			this.onUpdatePlayButtons?.(state);
			this.onUpdateTrackIndicators?.();
		});
	}

	/**
	 * Toggle between grid and list view
	 */
	toggleAlbumView(): void {
		const gridElement = document.getElementById("albums-grid");
		const listElement = document.getElementById("albums-list");
		const toggleBtn = document.getElementById("album-view-toggle");

		if (!gridElement || !listElement || !toggleBtn) {
			console.warn("⚠️  Missing elements, cannot toggle view");
			return;
		}

		const currentView = toggleBtn.getAttribute("data-view");
		const icon = toggleBtn.querySelector("i");

		if (currentView === "grid") {
			// Switch to list view
			gridElement.classList.add("hidden");
			listElement.classList.remove("hidden");
			toggleBtn.setAttribute("data-view", "list");
			toggleBtn.setAttribute("title", "Switch to grid view");
			if (icon) {
				icon.className = "icon-columns text-2xl";
			}
		} else {
			// Switch to grid view
			listElement.classList.add("hidden");
			gridElement.classList.remove("hidden");
			toggleBtn.setAttribute("data-view", "grid");
			toggleBtn.setAttribute("title", "Switch to list view");
			if (icon) {
				icon.className = "icon-grid text-2xl";
			}
		}

		// Scroll to playing album after view change
		this.onScrollToAlbum?.();
	}

	/**
	 * Toggle album tracks expansion in list view
	 */
	async toggleAlbumTracks(albumId: string): Promise<void> {
		const albumItem = document.querySelector(`.album-list-item[data-album-id="${albumId}"]`);
		if (!albumItem) return;

		const tracksContainer = albumItem.querySelector(".album-tracks") as HTMLElement;
		const expandBtn = albumItem.querySelector(".album-expand-btn");
		const expandIcon = expandBtn?.querySelector("i");
		const expandText = expandBtn?.querySelector("span");

		if (!tracksContainer) return;

		const isExpanded = !tracksContainer.classList.contains("hidden");

		if (isExpanded) {
			// Collapse
			tracksContainer.classList.add("hidden");
			if (expandIcon)
				expandIcon.className =
					"icon-chevron-down text-light-300 dark:text-palette-300 group-hover:text-black transition-colors";
			if (expandText) expandText.textContent = "Show Tracks";
		} else {
			// Expand and load tracks if not already loaded
			const hasContent = tracksContainer.querySelector(".disc-group");

			if (!hasContent && window.musicSDK) {
				try {
					// Fetch tracks for this album
					const tracks = await window.musicSDK.getAlbumTracks(albumId);
					this.renderAlbumTracksGrouped(tracksContainer, tracks, albumId);
				} catch (error) {
					console.error("Failed to load album tracks:", error);
					tracksContainer.innerHTML = `
						<div class="p-4 text-center text-palette-200">
							<i class="icon-alert-circle text-4xl mb-2 block"></i>
							<p>Failed to load tracks</p>
						</div>
					`;
				}
			}

			tracksContainer.classList.remove("hidden");
			if (expandIcon)
				expandIcon.className =
					"icon-chevron-up icon-chevron-down text-light-300 dark:text-palette-300 group-hover:text-black transition-colors";
			if (expandText) expandText.textContent = "Hide Tracks";

			// Always scroll to active track when showing tracks
			const tracks = await window.musicSDK?.getAlbumTracks(albumId);
			if (tracks && this.onScrollToTrack) {
				this.onScrollToTrack(tracksContainer, tracks);
			}
		}
	}

	/**
	 * Render album tracks grouped by disc
	 */
	private renderAlbumTracksGrouped(container: HTMLElement, tracks: Track[], albumId: string): void {
		// Group tracks by disc number
		const discGroups: Record<string, Track[]> = {};

		tracks.forEach((track, _index) => {
			// Try multiple fields for disc number
			let discNum = track.disc_number || track.disc || track.part || track.part_position || 1;

			// Convert to number if it's a string number
			if (typeof discNum === "string" && !isNaN(parseInt(discNum))) {
				discNum = parseInt(discNum);
			}

			// Check if this is an extras/bonus track - multiple detection methods
			const trackName = (track.track_name || "").toLowerCase();
			const albumName = (track.album || "").toLowerCase();
			const cdnUrl = (track.cdn_url || "").toLowerCase();
			const s3Url = (track.s3_url || "").toLowerCase();
			const discNumStr = String(discNum).toLowerCase();

			const isExtras =
				discNumStr.includes("extra") ||
				trackName.includes("extra") ||
				trackName.includes("bonus") ||
				albumName.includes("extra") ||
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

		// Sort discs and tracks
		const sortedDiscs = Object.keys(discGroups).sort((a, b) => {
			const numA = parseInt(a.replace("Disc ", ""));
			const numB = parseInt(b.replace("Disc ", ""));
			return numA - numB;
		});

		// Render grouped tracks
		const html = sortedDiscs
			.map((discName) => {
				const discTracks = discGroups[discName].sort((a, b) => {
					const posA = parseInt(a.track_position || "0", 10);
					const posB = parseInt(b.track_position || "0", 10);
					return posA - posB;
				});

				// Use the shared track list utility
				const tracksHTML = generateTrackList(discTracks, ["number", "title", "duration", "menu"], {
					showHeader: false,
					compact: false,
					containerId: `album-tracks-${albumId}-${discName.replace(" ", "-")}`,
					albumId: albumId,
				});

				// Show disc header when there are multiple discs
				const showDiscHeader = sortedDiscs.length > 1;

				return `
					<div class="disc-group p-4 border-t border-palette-700/50 dark:border-palette-100/50 first:border-t-0">
						${
							showDiscHeader
								? `<h4 class="font-retro text-sm font-bold mt-4 mb-2 uppercase tracking-wide flex items-center gap-2">
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

		container.innerHTML = html;

		// Add click handlers for tracks
		container.querySelectorAll(".track-row").forEach((row) => {
			row.addEventListener("click", async (e) => {
				// Check if clicking menu button - let it bubble to global TrackContextMenu handler
				const menuBtn = (e.target as HTMLElement).closest(".track-menu-btn");
				if (menuBtn) {
					// Don't handle the row click, let event bubble to document handler
					return;
				}

				const trackId = row.getAttribute("data-track-id");
				if (trackId && this.player) {
					const track = tracks.find((t) => t.track_id === trackId);
					if (track) {
						const state = musicStore.getState();
						try {
							// Check if this is the current track
							if (state.currentTrack && state.currentTrack.track_id === track.track_id) {
								// Toggle play/pause
								this.player.togglePlay();
							} else {
								// Set queue and play new track
								// Find the index of the track in the album
								const trackIndex = tracks.findIndex((t) => t.track_id === trackId);
								await this.player.setQueue(tracks, trackIndex, true);
							}
						} catch (error) {
							console.error("Failed to play track:", error);
						}
					}
				}
			});
		});

		// Update track indicators
		this.onUpdateTrackIndicators?.();

		// Scroll to active track if present
		if (this.onScrollToTrack) {
			this.onScrollToTrack(container, tracks);
		}
	}

	/**
	 * Handle album sorting
	 */
	handleAlbumSort(sortBy: AlbumSortBy): void {
		this.currentSortBy = sortBy;
		const state = musicStore.getState();

		// Get albums to sort (filtered if search is active, all otherwise)
		let albumsToSort = state.albums;
		if (this.currentSearchQuery) {
			albumsToSort = state.albums.filter(
				(album: Album) =>
					album.album.toLowerCase().includes(this.currentSearchQuery.toLowerCase()) ||
					album.artist.toLowerCase().includes(this.currentSearchQuery.toLowerCase())
			);
		}

		const albums = sortAlbums(albumsToSort, this.currentSortBy, this.currentSortOrder);

		// Update grid view
		const gridElement = document.getElementById("albums-grid");
		if (gridElement) {
			gridElement.innerHTML = albums.map((album) => this.createAlbumCard(album)).join("");
		}

		// Update list view
		const listElement = document.getElementById("albums-list");
		if (listElement) {
			listElement.innerHTML = albums.map((album) => this.createAlbumListItem(album)).join("");
		}

		// Update button icon, title, and aria-label to match current state
		const sortOrderBtn = document.getElementById("album-sort-order");
		if (sortOrderBtn) {
			const icon = sortOrderBtn.querySelector("i");
			sortOrderBtn.setAttribute("data-order", this.currentSortOrder);
			if (this.currentSortOrder === "asc") {
				if (icon) icon.className = "icon-sort-up text-2xl";
				sortOrderBtn.setAttribute("title", "Sort descending");
				sortOrderBtn.setAttribute("aria-label", "Sort descending");
			} else {
				if (icon) icon.className = "icon-sort-down text-2xl";
				sortOrderBtn.setAttribute("title", "Sort ascending");
				sortOrderBtn.setAttribute("aria-label", "Sort ascending");
			}
		}

		// Scroll to playing album after sorting
		this.onScrollToAlbum?.();
	}

	/**
	 * Toggle sort order between ascending and descending
	 */
	toggleSortOrder(): void {
		this.currentSortOrder = this.currentSortOrder === "asc" ? "desc" : "asc";
		const state = musicStore.getState();

		// Get albums to sort (filtered if search is active, all otherwise)
		let albumsToSort = state.albums;
		if (this.currentSearchQuery) {
			albumsToSort = state.albums.filter(
				(album: Album) =>
					album.album.toLowerCase().includes(this.currentSearchQuery.toLowerCase()) ||
					album.artist.toLowerCase().includes(this.currentSearchQuery.toLowerCase())
			);
		}

		const albums = sortAlbums(albumsToSort, this.currentSortBy, this.currentSortOrder);

		// Update grid view
		const gridElement = document.getElementById("albums-grid");
		if (gridElement) {
			gridElement.innerHTML = albums.map((album) => this.createAlbumCard(album)).join("");
		}

		// Update list view
		const listElement = document.getElementById("albums-list");
		if (listElement) {
			listElement.innerHTML = albums.map((album) => this.createAlbumListItem(album)).join("");
		}

		// Update button icon, title, and aria-label (show next action, not current state)
		const sortOrderBtn = document.getElementById("album-sort-order");
		if (sortOrderBtn) {
			const icon = sortOrderBtn.querySelector("i");
			sortOrderBtn.setAttribute("data-order", this.currentSortOrder);
			if (this.currentSortOrder === "asc") {
				if (icon) icon.className = "icon-sort-up text-2xl";
				sortOrderBtn.setAttribute("title", "Sort descending");
				sortOrderBtn.setAttribute("aria-label", "Sort descending");
			} else {
				if (icon) icon.className = "icon-sort-down text-2xl";
				sortOrderBtn.setAttribute("title", "Sort ascending");
				sortOrderBtn.setAttribute("aria-label", "Sort ascending");
			}
		}

		// Scroll to playing album after sorting
		this.onScrollToAlbum?.();
	}

	/**
	 * Filter albums by search query
	 */
	filterAlbums(query: string): void {
		this.currentSearchQuery = query;
		const state = musicStore.getState();

		// Filter albums
		const filtered = query
			? state.albums.filter(
					(album: Album) =>
						album.album.toLowerCase().includes(query.toLowerCase()) ||
						album.artist.toLowerCase().includes(query.toLowerCase())
				)
			: state.albums;

		// Apply current sorting to filtered results
		const sorted = sortAlbums(filtered, this.currentSortBy, this.currentSortOrder);

		const gridElement = document.getElementById("albums-grid");
		const listElement = document.getElementById("albums-list");

		if (sorted.length === 0) {
			const emptyState = `
				<div class="col-span-full text-center py-12">
					<i class="icon-search-heart text-6xl text-palette-100 mb-4 block"></i>
					<p class="text-palette-200 text-lg">No results for "${query}"</p>
					<p class="text-palette-100 text-sm mt-2">Try a different search term</p>
				</div>
			`;
			if (gridElement) gridElement.innerHTML = emptyState;
			if (listElement) listElement.innerHTML = emptyState;
		} else {
			// Update grid view
			if (gridElement) {
				gridElement.innerHTML = sorted.map((album: Album) => this.createAlbumCard(album)).join("");
			}

			// Update list view
			if (listElement) {
				listElement.innerHTML = sorted.map((album: Album) => this.createAlbumListItem(album)).join("");
			}
		}
	}
}
