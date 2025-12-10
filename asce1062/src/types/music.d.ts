/**
 * Music Service TypeScript Definitions
 * Re-exports types from @asce1062/music-service-sdk and adds custom UI types
 */

// ============================================================================
// Re-export SDK Types
// ============================================================================

export type {
	Album as SDKAlbum,
	Track as SDKTrack,
	TrackerModule,
	Manifest,
	PlaybackState,
	RepeatMode,
	PlaybackEvents,
	MusicServiceClient,
} from "@asce1062/music-service-sdk";

// Extended Track type with additional metadata fields
import type { Track as SDKTrack, Album as SDKAlbum } from "@asce1062/music-service-sdk";

export interface Track extends SDKTrack {
	disc_number?: number;
	disc?: number;
	part?: string;
	part_position?: number;
}

// Use SDK Album type directly (no extensions needed)
export type Album = SDKAlbum;

// ============================================================================
// Custom Application State Types
// ============================================================================

import type { TrackerModule, Manifest, RepeatMode } from "@asce1062/music-service-sdk";

/**
 * Music library state
 */
export interface MusicLibraryState {
	albums: Album[];
	tracks: Track[];
	trackerModules: TrackerModule[];
	manifest: Manifest | null;
	isLoading: boolean;
	error: string | null;
}

/**
 * Combined music application state
 */
export interface MusicState {
	// Playback state
	currentTrack: Track | null;
	isPlaying: boolean;
	isPaused: boolean;
	currentTime: number;
	duration: number;
	volume: number;
	isMuted: boolean;
	shuffle: boolean;
	repeat: RepeatMode;
	queue: Track[];
	queueIndex: number;
	buffering: boolean;
	isSeeking: boolean;

	// Library state
	albums: Album[];
	tracks: Track[];
	trackerModules: TrackerModule[];
	manifest: Manifest | null;
	isLoading: boolean;
	error: string | null;

	// View state
	currentView: "albums" | "tracks" | "trackers";
	sortBy: "release" | "name" | "artist" | "year";
	filterGenre: string | null;
	searchQuery: string;

	// UI state
	showQueue: boolean;
	showPlayer: boolean;
	showLyrics: boolean;
}

/**
 * State change listener
 */
export type StateChangeListener = (state: MusicState) => void;

// ============================================================================
// Helper Functions Type Definitions
// ============================================================================

/**
 * Format duration from seconds to MM:SS or HH:MM:SS
 */
export type FormatDuration = (seconds: number) => string;

/**
 * Get full CDN URL from relative path
 */
export type GetCDNUrl = (relativePath: string) => string;

/**
 * Download quality options
 */
export type DownloadQuality = "high" | "medium" | "low";

/**
 * Context menu action
 */
export type ContextMenuAction =
	| "play-next"
	| "add-to-queue"
	| "add-to-playlist"
	| "track-details"
	| "go-to-album"
	| "go-to-artist"
	| "download"
	| "share";

/**
 * Context menu item
 */
export interface ContextMenuItem {
	action: ContextMenuAction;
	label: string;
	icon?: string;
	divider?: boolean;
	disabled?: boolean;
}

// ============================================================================
// UI Component Props
// ============================================================================

/**
 * Album card component props
 */
export interface AlbumCardProps {
	album: Album;
	isPlaying?: boolean;
	onClick?: (album: Album) => void;
}

/**
 * Track row component props
 */
export interface TrackRowProps {
	track: Track;
	index?: number;
	isPlaying?: boolean;
	showAlbum?: boolean;
	showArtwork?: boolean;
	onClick?: (track: Track) => void;
	onMenuClick?: (track: Track) => void;
}

// ============================================================================
// Global Window Extensions
// ============================================================================

import type { MusicServiceClient as SDKClient } from "@asce1062/music-service-sdk";
import type { PlayerController } from "@/scripts/music/PlayerController";

declare global {
	interface Window {
		/**
		 * Global music SDK instance (client-side)
		 */
		musicSDK?: SDKClient;

		/**
		 * Global PlayerController instance (centralized playback control)
		 */
		musicPlayer?: PlayerController;

		/**
		 * Global queue drawer instance (UI control)
		 */
		queueDrawer?: {
			toggle: () => void;
			open: () => void;
			close: () => void;
		};

		/**
		 * Global now playing modal instance (UI control)
		 */
		nowPlayingModal?: {
			open: () => void;
			close: () => void;
		};

		/**
		 * Global album detail modal instance (UI control)
		 */
		albumModal?: {
			open: (albumId: string) => Promise<void>;
			close: () => void;
		};

		/**
		 * Global track context menu instance (UI control)
		 */
		trackContextMenu?: {
			openWithTrack: (track: Track, x: number, y: number, hideActions?: string[]) => void;
		};

		/**
		 * Global music store instance
		 */
		musicStore?: {
			getState: () => MusicState;
			setState: (updates: Partial<MusicState>) => void;
			subscribe: (listener: StateChangeListener) => () => void;
		};
	}
}
