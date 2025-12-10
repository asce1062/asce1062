/**
 * Player Controller
 * Manages music playback and synchronizes SDK events with MusicStore
 */

import { musicStore } from "./MusicStore";
import { showError } from "@/lib/music/toast";
import type { Track, RepeatMode, MusicState } from "@/types/music";

/**
 * PlayerController - Handles all playback operations
 * Integrates @asce1062/music-service-sdk with MusicStore
 */
export class PlayerController {
	private sdk: typeof window.musicSDK;
	private initialized: boolean = false;
	private volumeBeforeMute: number = 0.8;

	constructor() {
		this.sdk = window.musicSDK;
	}

	/**
	 * Initialize the player and set up event listeners
	 */
	public async init(): Promise<void> {
		if (this.initialized) {
			console.warn("PlayerController already initialized");
			return;
		}

		if (!this.sdk) {
			throw new Error("Music SDK not found on window object");
		}

		// Set up SDK event listeners
		this.setupEventListeners();

		// Sync user preferences FROM musicStore TO SDK
		// This restores user's repeat/shuffle preferences from localStorage
		const userPreferences = musicStore.getState();
		if (userPreferences.repeat && userPreferences.repeat !== "off") {
			this.sdk.playback.setRepeat(userPreferences.repeat);
		}
		if (userPreferences.shuffle) {
			this.sdk.playback.setShuffle(userPreferences.shuffle);
		}
		if (userPreferences.volume !== 0.8) {
			this.sdk.playback.setVolume(userPreferences.volume);
		}

		// Then sync SDK state back to musicStore to ensure consistency
		// This ensures UI reflects SDK's actual state after applying user preferences
		const sdkState = this.sdk.playback.getState();
		const currentStore = musicStore.getState();
		if (sdkState) {
			// Only update queue if SDK has a valid queue, otherwise preserve existing queue
			const updateState: Partial<MusicState> = {
				repeat: sdkState.repeat ?? "off",
				shuffle: sdkState.shuffle ?? false,
				volume: sdkState.volume ?? 0.8,
			};

			// Only overwrite queue if SDK has tracks, otherwise keep current queue
			if (sdkState.queue && sdkState.queue.length > 0) {
				updateState.queue = sdkState.queue;
				updateState.queueIndex = sdkState.queuePosition ?? 0;
			} else if (!currentStore.queue || currentStore.queue.length === 0) {
				// Only set empty queue if store also has no queue
				updateState.queue = [];
				updateState.queueIndex = 0;
			}

			musicStore.setState(updateState);
		}

		this.initialized = true;
	}

	/**
	 * Set up SDK event listeners to sync with state
	 */
	private setupEventListeners(): void {
		if (!this.sdk?.playback) {
			console.error("SDK playback manager not available");
			return;
		}

		// Track change event - fires for ALL track changes (manual + gapless)
		// This is the KEY event for detecting when the SDK switches tracks
		this.sdk.playback.on("trackchange", (current, _previous) => {
			if (current) {
				musicStore.setCurrentTrack(current as Track);
				musicStore.setPlaying(true);

				// Update queue index to match SDK's internal state
				const sdkState = this.sdk?.playback.getState();
				if (sdkState && typeof sdkState.queuePosition === "number") {
					musicStore.setState({ queueIndex: sdkState.queuePosition });
				}
			}
		});

		// Play event - receives Track
		this.sdk.playback.on("play", (track) => {
			// Only update currentTrack if it actually changed (not just unpause)
			const state = musicStore.getState();
			if (track && track.track_id !== state.currentTrack?.track_id) {
				musicStore.setCurrentTrack(track as Track);
			}
			musicStore.setPlaying(true);
		});

		// Pause event - no parameters
		this.sdk.playback.on("pause", () => {
			musicStore.setPlaying(false);
		});

		// Time update event - receives position and duration
		// SDK now filters transient glitches internally before emitting events
		this.sdk.playback.on("timeupdate", (position, duration) => {
			const currentTime = position as number;
			const state = musicStore.getState();

			// Debug logging to track glitches
			if (currentTime < 0.5 && state.currentTime > 1) {
				console.warn("⚠️ CLIENT: Received suspicious time jump:", {
					from: state.currentTime.toFixed(2),
					to: currentTime.toFixed(2),
					isSeeking: state.isSeeking,
					isPlaying: state.isPlaying,
				});
			}

			// Only clear isSeeking if we're past the initial timeupdate after seek
			// This prevents premature clearing that might interfere with SDK's internal filtering
			const shouldClearSeeking = state.isSeeking && Math.abs(currentTime - state.currentTime) < 1;

			musicStore.setState({
				currentTime: currentTime,
				duration: duration as number,
				...(shouldClearSeeking && { isSeeking: false }),
			});
		});

		// Volume change event - receives volume number
		this.sdk.playback.on("volumechange", (volume) => {
			musicStore.setVolume(volume as number);
		});

		// Queue change event - sync queue state
		this.sdk.playback.on("queuechange", (queue, position) => {
			if (queue && Array.isArray(queue)) {
				const currentState = musicStore.getState();

				// Check if queue changed (length, position, OR track order)
				const lengthChanged = queue.length !== currentState.queue.length;
				const positionChanged = position !== currentState.queueIndex;
				const trackAtPositionChanged =
					queue[position as number]?.track_id !== currentState.queue[currentState.queueIndex]?.track_id;

				const queueChanged = lengthChanged || positionChanged || trackAtPositionChanged;

				if (queueChanged) {
					musicStore.setState({
						queue: queue as Track[],
						queueIndex: position as number,
					});
				}
			}
		});

		// Shuffle change event
		this.sdk.playback.on("shufflechange", (enabled) => {
			musicStore.setState({ shuffle: enabled as boolean });
		});

		// Repeat change event
		this.sdk.playback.on("repeatchange", (mode) => {
			musicStore.setState({ repeat: mode as "off" | "one" | "all" });
		});

		// Error event - receives Error
		this.sdk.playback.on("error", (error) => {
			const errorMessage = (error as Error).message || String(error);
			const errorString = String(error); // Full error string including name

			// Don't treat gapless transition errors and SDK internal errors as fatal
			const isNonFatalError =
				errorMessage.includes("aborted by the user agent") ||
				errorMessage.includes("gapless") ||
				errorMessage.includes("Audio error: undefined") ||
				errorMessage.includes("Invalid URI") ||
				errorMessage.includes("Load of media resource") ||
				errorMessage.includes("Invalid position") ||
				errorString.includes("MediaSession");

			if (!isNonFatalError) {
				// Only log and handle actual fatal errors
				console.error("❌ Playback error:", error);
				musicStore.setError(errorMessage);
				musicStore.setPlaying(false);
			}
		});

		// Loaded event - receives Track
		this.sdk.playback.on("loaded", (_track) => {
			musicStore.setState({ buffering: false });
		});
	}

	// ========================================================================
	// Playback Control Methods
	// ========================================================================

	/**
	 * Play a track
	 */
	public async play(track: Track): Promise<void> {
		if (!this.sdk?.playback) {
			const errorMsg = "Music player not initialized";
			showError(errorMsg);
			throw new Error(errorMsg);
		}

		// Validate track has required fields
		if (!track || !track.cdn_url) {
			const errorMsg = `Invalid track: ${!track ? "track is null/undefined" : "missing cdn_url"}`;
			console.error(errorMsg, track);
			showError("Cannot play this track");
			musicStore.setError(errorMsg);
			return;
		}

		try {
			musicStore.setState({ buffering: true, error: null });
			await this.sdk.playback.play(track);
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : "Failed to play track";
			console.error("Failed to play track:", error);
			showError(errorMsg);
			musicStore.setError(errorMsg);
			musicStore.setState({ buffering: false });
			throw error;
		}
	}

	/**
	 * Pause playback
	 */
	public pause(): void {
		if (!this.sdk?.playback) return;
		this.sdk.playback.pause();
	}

	/**
	 * Toggle play/pause
	 */
	public togglePlay(): void {
		if (!this.sdk?.playback) return;

		const state = musicStore.getState();

		if (state.isPlaying) {
			this.pause();
		} else if (state.currentTrack) {
			// Call SDK play() without arguments to resume from current position
			this.sdk.playback.play();
		}
	}

	/**
	 * Play next track in queue
	 * SDK handles shuffle, repeat, queue position, and preload cache automatically
	 */
	public async next(): Promise<void> {
		if (!this.sdk?.playback) return;
		// SDK now handles all queue verification and preload cache management
		await this.sdk.playback.next();
	}

	/**
	 * Play previous track in queue
	 * SDK handles the 3-second rule and queue position automatically
	 */
	public async previous(): Promise<void> {
		if (!this.sdk?.playback) return;
		await this.sdk.playback.previous();
	}

	/**
	 * Seek to position in current track
	 * @param position - Position in seconds
	 */
	public seek(position: number): void {
		if (!this.sdk?.playback) return;

		const state = musicStore.getState();
		const clampedPosition = Math.max(0, Math.min(state.duration, position));

		// Set seeking flag before seeking
		musicStore.setState({ isSeeking: true });
		// Let SDK's timeupdate event update the store (single source of truth)
		this.sdk.playback.seek(clampedPosition);
	}

	/**
	 * Seek forward/backward by specified seconds
	 */
	public seekRelative(seconds: number): void {
		const state = musicStore.getState();
		this.seek(state.currentTime + seconds);
	}

	// ========================================================================
	// Queue Management
	// ========================================================================

	/**
	 * Set playback queue and optionally start playing
	 * @param tracks - Array of tracks
	 * @param startIndex - Index to start playing (default: 0)
	 * @param autoPlay - Whether to start playing immediately (default: true)
	 */
	public async setQueue(tracks: Track[], startIndex: number = 0, autoPlay: boolean = true): Promise<void> {
		if (!this.sdk?.playback) {
			throw new Error("SDK playback not available");
		}

		// Validate and filter out invalid tracks
		const validTracks = tracks.filter((track) => {
			if (!track || !track.cdn_url) {
				console.warn("❌ Filtering out invalid track:", track);
				return false;
			}
			return true;
		});

		if (validTracks.length === 0) {
			throw new Error("No valid tracks in queue");
		}

		const adjustedStartIndex = Math.min(startIndex, validTracks.length - 1);

		try {
			// SDK now handles shuffle internally with clicked track preservation
			// Just pass the tracks and start index - SDK will shuffle if needed
			this.sdk.playback.setQueue(validTracks, adjustedStartIndex);

			// Verify SDK actually has the tracks
			const sdkState = this.sdk.playback.getState();

			if (!sdkState.queue || sdkState.queue.length === 0) {
				console.error(`❌ SDK QUEUE IS EMPTY after setQueue! This is a critical bug!`);
				showError("Failed to set queue - SDK error");
				return;
			}

			// The queuechange event will update the store with the actual queue
			// (which may be shuffled by the SDK)

			// Auto-play if requested
			if (autoPlay && validTracks.length > 0) {
				// Get the actual track that will play (SDK may have shuffled)
				const trackToPlay = sdkState.queue?.[sdkState.queuePosition] || validTracks[adjustedStartIndex];
				await this.play(trackToPlay as Track);
			}
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : "Failed to set queue";
			console.error("Failed to set queue:", error);
			showError(errorMsg);
			throw error;
		}
	}

	/**
	 * Play album (set as queue and start playing)
	 */
	public async playAlbum(tracks: Track[]): Promise<void> {
		await this.setQueue(tracks, 0, true);
	}

	/**
	 * Jump to a specific track index in the current queue
	 * @param index - Index of the track to jump to
	 */
	public async jumpTo(index: number): Promise<void> {
		if (!this.sdk?.playback) {
			throw new Error("SDK playback not available");
		}

		const state = musicStore.getState();

		// Validate index
		if (index < 0 || index >= state.queue.length) {
			console.error("Invalid queue index:", index, "queue length:", state.queue.length);
			throw new Error(`Invalid queue index: ${index}`);
		}

		const trackToPlay = state.queue[index];
		if (!trackToPlay) {
			console.error("No track at index:", index);
			throw new Error(`No track at index ${index}`);
		}

		try {
			// If repeat all is active, rotate the queue to maintain circular behavior
			let queueToSet = state.queue;
			let newIndex = index;

			if (state.repeat === "all" && index !== 0) {
				// Rotate queue: move tracks from 0 to index-1 to the end
				const tracksBeforeTarget = state.queue.slice(0, index);
				const targetAndAfter = state.queue.slice(index);
				queueToSet = [...targetAndAfter, ...tracksBeforeTarget];
				newIndex = 0;

				// Update store with rotated queue
				musicStore.setState({ queueIndex: newIndex, queue: queueToSet as Track[] });
			} else {
				// Update the queue position in the store
				musicStore.setState({ queueIndex: index });
			}

			// Update SDK's queue position and play
			this.sdk.playback.setQueue(queueToSet, newIndex);
			await this.play(trackToPlay);
		} catch (error) {
			console.error("Failed to jump to track:", error);
			throw error;
		}
	}

	/**
	 * Add track to end of queue
	 */
	public addToQueue(track: Track): void {
		if (!this.sdk?.playback) return;

		// Validate track
		if (!track || !track.cdn_url) {
			console.error("Invalid track for addToQueue:", track);
			showError("Cannot add invalid track to queue");
			return;
		}

		// Use SDK's addToQueue method which handles:
		// 1. Queue management
		// 2. originalQueue for shuffle
		// 3. Event emission
		this.sdk.playback.addToQueue(track);
	}

	/**
	 * Play track next (insert after current track)
	 */
	public playNext(track: Track): void {
		if (!this.sdk?.playback) return;

		// Validate track
		if (!track || !track.cdn_url) {
			console.error("Invalid track for playNext:", track);
			showError("Cannot add invalid track to queue");
			return;
		}

		const state = musicStore.getState();
		const insertPosition = state.queueIndex + 1;

		// Use SDK's addToQueue with position parameter
		// This inserts the track right after the current track
		this.sdk.playback.addToQueue(track, insertPosition);
	}

	// ========================================================================
	// Volume Control
	// ========================================================================

	/**
	 * Set volume (0-1)
	 */
	public setVolume(volume: number): void {
		if (!this.sdk?.playback) return;

		const clampedVolume = Math.max(0, Math.min(1, volume));
		this.sdk.playback.setVolume(clampedVolume);
		musicStore.setVolume(clampedVolume);
	}

	/**
	 * Increase volume by 10%
	 */
	public volumeUp(): void {
		const state = musicStore.getState();
		this.setVolume(Math.min(1, state.volume + 0.1));
	}

	/**
	 * Decrease volume by 10%
	 */
	public volumeDown(): void {
		const state = musicStore.getState();
		this.setVolume(Math.max(0, state.volume - 0.1));
	}

	/**
	 * Toggle mute
	 */
	public toggleMute(): void {
		const state = musicStore.getState();

		if (state.isMuted) {
			// Unmute - restore previous volume
			this.setVolume(this.volumeBeforeMute);
			musicStore.setState({ isMuted: false });
		} else {
			// Mute - save current volume and set to 0
			this.volumeBeforeMute = state.volume > 0 ? state.volume : 0.8;
			this.setVolume(0);
			musicStore.setState({ isMuted: true });
		}
	}

	// ========================================================================
	// Playback Settings
	// ========================================================================

	/**
	 * Toggle shuffle mode
	 * SDK handles shuffle logic and fires 'shufflechange' event
	 */
	public toggleShuffle(): void {
		if (!this.sdk?.playback) return;
		this.sdk.playback.toggleShuffle();
		// musicStore will be updated by 'shufflechange' event listener
	}

	/**
	 * Set shuffle mode
	 * SDK handles shuffle logic and fires 'shufflechange' event
	 */
	public setShuffle(enabled: boolean): void {
		if (!this.sdk?.playback) return;
		this.sdk.playback.setShuffle(enabled);
		// musicStore will be updated by 'shufflechange' event listener
	}

	/**
	 * Cycle repeat mode (off -> all -> one -> off)
	 * SDK handles repeat logic and fires 'repeatchange' event
	 */
	public cycleRepeat(): void {
		if (!this.sdk?.playback) return;
		this.sdk.playback.cycleRepeat();
		// musicStore will be updated by 'repeatchange' event listener
	}

	/**
	 * Set repeat mode
	 * SDK handles repeat logic and fires 'repeatchange' event
	 */
	public setRepeat(mode: RepeatMode): void {
		if (!this.sdk?.playback) return;
		this.sdk.playback.setRepeat(mode);
		// musicStore will be updated by 'repeatchange' event listener
	}

	// ========================================================================
	// Utility Methods
	// ========================================================================

	/**
	 * Get current playback state
	 */
	public getState() {
		return musicStore.getState();
	}

	/**
	 * Check if controller is initialized
	 */
	public isInitialized(): boolean {
		return this.initialized;
	}

	/**
	 * Cleanup and destroy controller
	 */
	public destroy(): void {
		// Remove all SDK event listeners
		if (this.sdk?.playback) {
			// SDK handles cleanup internally when destroyed
			// Individual event listener removal would require storing references
		}

		this.initialized = false;
	}
}
