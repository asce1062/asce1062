/**
 * Client-side Music State Manager
 * Centralized reactive state management for the music player
 * Pattern: Singleton with observer pattern (similar to AvatarStateManager)
 */

import type { MusicState, StateChangeListener, Track, Album, TrackerModule, Manifest, RepeatMode } from "@/types/music";

/**
 * MusicStore - Singleton state manager for music playback and library
 */
class MusicStore {
	private state: MusicState;
	private listeners: Set<StateChangeListener>;

	constructor() {
		// Initialize default state
		this.state = this.getDefaultState();
		this.listeners = new Set();

		// Restore state from localStorage if available
		this.restoreState();
	}

	/**
	 * Get default/initial state
	 */
	private getDefaultState(): MusicState {
		return {
			// Playback state
			currentTrack: null,
			isPlaying: false,
			isPaused: false,
			currentTime: 0,
			duration: 0,
			volume: 0.8, // 80% default volume
			isMuted: false,
			shuffle: false,
			repeat: "off",
			queue: [],
			queueIndex: -1,
			buffering: false,
			isSeeking: false,

			// Library state
			albums: [],
			tracks: [],
			trackerModules: [],
			manifest: null,
			isLoading: false,
			error: null,

			// View state
			currentView: "albums",
			sortBy: "release",
			filterGenre: null,
			searchQuery: "",

			// UI state
			showQueue: false,
			showPlayer: false,
			showLyrics: false,
		};
	}

	/**
	 * Get current state (read-only)
	 */
	public getState(): MusicState {
		return { ...this.state };
	}

	/**
	 * Update state and notify listeners
	 */
	public setState(updates: Partial<MusicState>): void {
		this.state = { ...this.state, ...updates };
		this.notifyListeners();
		this.persistState();
	}

	/**
	 * Subscribe to state changes
	 * @returns Unsubscribe function
	 */
	public subscribe(listener: StateChangeListener): () => void {
		this.listeners.add(listener);

		// Return unsubscribe function
		return () => {
			this.listeners.delete(listener);
		};
	}

	/**
	 * Notify all listeners of state change
	 */
	private notifyListeners(): void {
		this.listeners.forEach((listener) => {
			try {
				listener(this.getState());
			} catch (error) {
				console.error("Error in state listener:", error);
			}
		});
	}

	/**
	 * Persist state to localStorage (excluding large data)
	 */
	private persistState(): void {
		try {
			const persistableState = {
				volume: this.state.volume,
				isMuted: this.state.isMuted,
				shuffle: this.state.shuffle,
				repeat: this.state.repeat,
				currentView: this.state.currentView,
				sortBy: this.state.sortBy,
			};

			localStorage.setItem("music-state", JSON.stringify(persistableState));
		} catch (error) {
			console.warn("Failed to persist music state:", error);
		}
	}

	/**
	 * Restore state from localStorage
	 */
	private restoreState(): void {
		try {
			const stored = localStorage.getItem("music-state");
			if (stored) {
				const persistedState = JSON.parse(stored);
				this.state = { ...this.state, ...persistedState };
			}
		} catch (error) {
			console.warn("Failed to restore music state:", error);
		}
	}

	// ========================================================================
	// Convenience methods for common state updates
	// ========================================================================

	/**
	 * Set current playing track
	 */
	public setCurrentTrack(track: Track | null): void {
		this.setState({
			currentTrack: track,
			duration: track?.duration_seconds || 0,
			currentTime: 0,
		});
	}

	/**
	 * Update playback state
	 */
	public setPlaying(isPlaying: boolean): void {
		this.setState({
			isPlaying,
			isPaused: !isPlaying,
		});
	}

	/**
	 * Update current playback time
	 */
	public setCurrentTime(time: number): void {
		this.setState({ currentTime: time });
	}

	/**
	 * Set volume (0-1)
	 */
	public setVolume(volume: number): void {
		const clampedVolume = Math.max(0, Math.min(1, volume));
		this.setState({
			volume: clampedVolume,
			isMuted: clampedVolume === 0,
		});
	}

	/**
	 * Toggle mute
	 */
	public toggleMute(): void {
		this.setState({ isMuted: !this.state.isMuted });
	}

	/**
	 * Set shuffle mode
	 */
	public setShuffle(shuffle: boolean): void {
		this.setState({ shuffle });
	}

	/**
	 * Set repeat mode
	 */
	public setRepeat(repeat: RepeatMode): void {
		this.setState({ repeat });
	}

	/**
	 * Cycle through repeat modes: off -> all -> one -> off
	 */
	public cycleRepeat(): void {
		const modes: RepeatMode[] = ["off", "all", "one"];
		const currentIndex = modes.indexOf(this.state.repeat);
		const nextIndex = (currentIndex + 1) % modes.length;
		this.setState({ repeat: modes[nextIndex] });
	}

	/**
	 * Set playback queue
	 */
	public setQueue(queue: Track[], startIndex: number = 0): void {
		this.setState({
			queue,
			queueIndex: startIndex,
		});
	}

	/**
	 * Add track to queue
	 */
	public addToQueue(track: Track): void {
		this.setState({
			queue: [...this.state.queue, track],
		});
	}

	/**
	 * Remove track from queue
	 */
	public removeFromQueue(index: number): void {
		const newQueue = this.state.queue.filter((_, i) => i !== index);
		this.setState({
			queue: newQueue,
			queueIndex: this.state.queueIndex >= index ? this.state.queueIndex - 1 : this.state.queueIndex,
		});
	}

	/**
	 * Set library data (albums, tracks, etc.)
	 */
	public setLibraryData(data: {
		albums?: Album[];
		tracks?: Track[];
		trackerModules?: TrackerModule[];
		manifest?: Manifest;
	}): void {
		this.setState({
			...data,
			isLoading: false,
		});
	}

	/**
	 * Set loading state
	 */
	public setLoading(isLoading: boolean): void {
		this.setState({ isLoading });
	}

	/**
	 * Set error state
	 */
	public setError(error: string | null): void {
		this.setState({ error });
	}

	/**
	 * Set current view
	 */
	public setView(view: "albums" | "tracks" | "trackers"): void {
		this.setState({ currentView: view });
	}

	/**
	 * Set sort order
	 */
	public setSortBy(sortBy: "release" | "name" | "artist" | "year"): void {
		this.setState({ sortBy });
	}

	/**
	 * Set genre filter
	 */
	public setGenreFilter(genre: string | null): void {
		this.setState({ filterGenre: genre });
	}

	/**
	 * Set search query
	 */
	public setSearchQuery(query: string): void {
		this.setState({ searchQuery: query });
	}

	/**
	 * Toggle queue visibility
	 */
	public toggleQueue(): void {
		this.setState({ showQueue: !this.state.showQueue });
	}

	/**
	 * Toggle player visibility
	 */
	public togglePlayer(): void {
		this.setState({ showPlayer: !this.state.showPlayer });
	}

	/**
	 * Toggle lyrics visibility
	 */
	public toggleLyrics(): void {
		this.setState({ showLyrics: !this.state.showLyrics });
	}

	/**
	 * Reset state to defaults
	 */
	public reset(): void {
		this.state = this.getDefaultState();
		this.notifyListeners();
		localStorage.removeItem("music-state");
	}
}

/**
 * Singleton instance of MusicStore
 * Export as singleton to ensure single source of truth
 */
export const musicStore = new MusicStore();

// Expose on window for global access (development debugging)
if (import.meta.env.DEV) {
	window.musicStore = musicStore;
}
