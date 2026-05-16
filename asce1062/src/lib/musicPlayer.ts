/**
 * Pure music-player state helpers.
 *
 * The floating UI owns DOM/audio side effects; this module owns deterministic
 * queue behavior so shuffle, repeat, manual previous/next, and end-of-track
 * advancement can be tested without a browser or audio element.
 */

export const MUSIC_PLAYER_FLAVORS = ["DEFAULT", "CRT", "AMBER", "SYNTHWAVE", "DOS", "VOID", "ICE", "REDLINE"] as const;

export type MusicPlayerFlavor = (typeof MUSIC_PLAYER_FLAVORS)[number];
export type MusicRepeatMode = "none" | "all" | "one";

export interface MusicPlaybackTrack {
	id?: string;
}

export interface MusicPlaybackState<TTrack extends MusicPlaybackTrack = MusicPlaybackTrack> {
	/** Tracks in the original playlist order returned by the API. */
	playlistTracks: TTrack[];
	/** Active playback order. Matches playlistTracks unless shuffle is enabled. */
	queue: TTrack[];
	currentQueueIndex: number;
	currentTrackId: string | null;
	isPlaying: boolean;
	shuffleEnabled: boolean;
	repeatMode: MusicRepeatMode;
	shuffleHistory: TTrack[];
}

export type MusicQueueAction = "none" | "play" | "replay" | "restart" | "stop";

export interface MusicQueueResult<TTrack extends MusicPlaybackTrack = MusicPlaybackTrack> {
	action: MusicQueueAction;
	state: MusicPlaybackState<TTrack>;
	track: TTrack | null;
}

export function getMusicPlayerFlavorFromSiteFlavor(siteFlavor: string | null | undefined): MusicPlayerFlavor {
	switch (siteFlavor) {
		case "crt-green":
			return "CRT";
		case "amber":
			return "AMBER";
		case "synthwave":
			return "SYNTHWAVE";
		case "dos":
			return "DOS";
		case "void":
			return "VOID";
		case "ice":
			return "ICE";
		case "redline":
			return "REDLINE";
		default:
			return "DEFAULT";
	}
}

export function getSiteFlavorFromMusicPlayerFlavor(playerFlavor: MusicPlayerFlavor): string {
	switch (playerFlavor) {
		case "CRT":
			return "crt-green";
		case "AMBER":
			return "amber";
		case "SYNTHWAVE":
			return "synthwave";
		case "DOS":
			return "dos";
		case "VOID":
			return "void";
		case "ICE":
			return "ice";
		case "REDLINE":
			return "redline";
		default:
			return "";
	}
}

export function getNextMusicPlayerFlavor(current: string): MusicPlayerFlavor {
	const currentIndex = MUSIC_PLAYER_FLAVORS.indexOf(current as MusicPlayerFlavor);

	if (currentIndex === -1) {
		return MUSIC_PLAYER_FLAVORS[0];
	}

	return MUSIC_PLAYER_FLAVORS[(currentIndex + 1) % MUSIC_PLAYER_FLAVORS.length];
}

export function formatMusicDuration(seconds?: number): string {
	if (!Number.isFinite(seconds) || !seconds || seconds < 0) {
		return "00:00";
	}

	const rounded = Math.floor(seconds);
	const minutes = Math.floor(rounded / 60);
	const remainingSeconds = rounded % 60;

	return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

export function createMusicPlaybackState<TTrack extends MusicPlaybackTrack>(
	playlistTracks: TTrack[] = []
): MusicPlaybackState<TTrack> {
	return {
		playlistTracks: [...playlistTracks],
		queue: [...playlistTracks],
		currentQueueIndex: -1,
		currentTrackId: null,
		isPlaying: false,
		shuffleEnabled: false,
		repeatMode: "none",
		shuffleHistory: [],
	};
}

function findTrackIndex<TTrack extends MusicPlaybackTrack>(
	tracks: TTrack[],
	trackId: string | null | undefined
): number {
	if (!trackId) return -1;
	return tracks.findIndex((track) => track.id === trackId);
}

function getTrackAt<TTrack extends MusicPlaybackTrack>(tracks: TTrack[], index: number): TTrack | null {
	return index >= 0 && index < tracks.length ? tracks[index]! : null;
}

function makeQueueResult<TTrack extends MusicPlaybackTrack>(
	action: MusicQueueAction,
	state: MusicPlaybackState<TTrack>,
	track: TTrack | null = state.currentQueueIndex >= 0 ? getTrackAt(state.queue, state.currentQueueIndex) : null
): MusicQueueResult<TTrack> {
	return { action, state, track };
}

function shuffleTracks<TTrack>(tracks: TTrack[], random: () => number): TTrack[] {
	const shuffled = [...tracks];
	for (let index = shuffled.length - 1; index > 0; index -= 1) {
		const swapIndex = Math.floor(random() * (index + 1));
		[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex]!, shuffled[index]!];
	}
	return shuffled;
}

export function selectMusicTrack<TTrack extends MusicPlaybackTrack>(
	state: MusicPlaybackState<TTrack>,
	trackId: string | null | undefined,
	options: { isPlaying?: boolean } = {}
): MusicPlaybackState<TTrack> {
	const queueIndex = findTrackIndex(state.queue, trackId);
	const playlistIndex = findTrackIndex(state.playlistTracks, trackId);
	const resolvedTrack = getTrackAt(state.queue, queueIndex) ?? getTrackAt(state.playlistTracks, playlistIndex);

	if (!resolvedTrack?.id) {
		return {
			...state,
			currentQueueIndex: -1,
			currentTrackId: null,
			isPlaying: options.isPlaying ?? state.isPlaying,
		};
	}

	return {
		...state,
		currentQueueIndex: queueIndex >= 0 ? queueIndex : playlistIndex,
		currentTrackId: resolvedTrack.id,
		isPlaying: options.isPlaying ?? state.isPlaying,
	};
}

export function setMusicShuffleEnabled<TTrack extends MusicPlaybackTrack>(
	state: MusicPlaybackState<TTrack>,
	enabled: boolean,
	random: () => number = Math.random
): MusicPlaybackState<TTrack> {
	if (!enabled) {
		const currentQueueIndex = findTrackIndex(state.playlistTracks, state.currentTrackId);
		return {
			...state,
			shuffleEnabled: false,
			queue: [...state.playlistTracks],
			currentQueueIndex,
			shuffleHistory: [],
		};
	}

	// Preserve the current track as the first shuffled item so enabling shuffle
	// never causes the visible now-playing row to jump.
	const currentTrack =
		getTrackAt(state.queue, state.currentQueueIndex) ??
		getTrackAt(state.playlistTracks, findTrackIndex(state.playlistTracks, state.currentTrackId));
	const remainingTracks = currentTrack?.id
		? state.playlistTracks.filter((track) => track.id !== currentTrack.id)
		: state.playlistTracks;
	const queue = currentTrack
		? [currentTrack, ...shuffleTracks(remainingTracks, random)]
		: shuffleTracks(remainingTracks, random);

	return {
		...state,
		shuffleEnabled: true,
		queue,
		currentQueueIndex: currentTrack ? 0 : -1,
		currentTrackId: currentTrack?.id ?? null,
		shuffleHistory: [...queue],
	};
}

export function setMusicRepeatMode<TTrack extends MusicPlaybackTrack>(
	state: MusicPlaybackState<TTrack>,
	repeatMode: MusicRepeatMode
): MusicPlaybackState<TTrack> {
	return { ...state, repeatMode };
}

export function getNextMusicRepeatMode(repeatMode: MusicRepeatMode): MusicRepeatMode {
	switch (repeatMode) {
		case "none":
			return "all";
		case "all":
			return "one";
		default:
			return "none";
	}
}

export function moveMusicQueueNext<TTrack extends MusicPlaybackTrack>(
	state: MusicPlaybackState<TTrack>
): MusicQueueResult<TTrack> {
	if (!state.queue.length) return makeQueueResult("none", { ...state, isPlaying: false }, null);

	const currentIndex = state.currentQueueIndex >= 0 ? state.currentQueueIndex : 0;
	const nextIndex = currentIndex + 1;

	if (nextIndex < state.queue.length) {
		const track = state.queue[nextIndex]!;
		return makeQueueResult(
			"play",
			{
				...state,
				currentQueueIndex: nextIndex,
				currentTrackId: track.id ?? null,
				isPlaying: true,
			},
			track
		);
	}

	if (state.repeatMode === "all") {
		const track = state.queue[0]!;
		return makeQueueResult(
			state.queue.length === 1 ? "restart" : "play",
			{
				...state,
				currentQueueIndex: 0,
				currentTrackId: track.id ?? null,
				isPlaying: true,
			},
			track
		);
	}

	return makeQueueResult("stop", {
		...state,
		currentQueueIndex: currentIndex,
		currentTrackId: getTrackAt(state.queue, currentIndex)?.id ?? state.currentTrackId,
		isPlaying: false,
	});
}

export function moveMusicQueuePrevious<TTrack extends MusicPlaybackTrack>(
	state: MusicPlaybackState<TTrack>,
	currentTimeSeconds: number
): MusicQueueResult<TTrack> {
	if (!state.queue.length) return makeQueueResult("none", { ...state, isPlaying: false }, null);

	const currentIndex = state.currentQueueIndex >= 0 ? state.currentQueueIndex : 0;
	const currentTrack = getTrackAt(state.queue, currentIndex);

	// Match common media-player behavior: after a few seconds, Previous restarts
	// the current track instead of moving to the prior queue item.
	if (currentTimeSeconds > 3 || (currentIndex === 0 && state.repeatMode !== "all")) {
		return makeQueueResult(
			"restart",
			{
				...state,
				currentQueueIndex: currentIndex,
				currentTrackId: currentTrack?.id ?? state.currentTrackId,
				isPlaying: true,
			},
			currentTrack
		);
	}

	const previousIndex = currentIndex - 1;
	if (previousIndex >= 0) {
		const track = state.queue[previousIndex]!;
		return makeQueueResult(
			"play",
			{
				...state,
				currentQueueIndex: previousIndex,
				currentTrackId: track.id ?? null,
				isPlaying: true,
			},
			track
		);
	}

	const wrappedIndex = state.queue.length - 1;
	const track = state.queue[wrappedIndex]!;
	return makeQueueResult(
		state.queue.length === 1 ? "restart" : "play",
		{
			...state,
			currentQueueIndex: wrappedIndex,
			currentTrackId: track.id ?? null,
			isPlaying: true,
		},
		track
	);
}

export function advanceMusicQueue<TTrack extends MusicPlaybackTrack>(
	state: MusicPlaybackState<TTrack>
): MusicQueueResult<TTrack> {
	if (!state.queue.length) return makeQueueResult("none", { ...state, isPlaying: false }, null);
	const currentIndex = state.currentQueueIndex >= 0 ? state.currentQueueIndex : 0;
	const currentTrack = getTrackAt(state.queue, currentIndex);

	if (state.repeatMode === "one") {
		return makeQueueResult(
			"replay",
			{
				...state,
				currentQueueIndex: currentIndex,
				currentTrackId: currentTrack?.id ?? state.currentTrackId,
				isPlaying: true,
			},
			currentTrack
		);
	}

	return moveMusicQueueNext(state);
}
