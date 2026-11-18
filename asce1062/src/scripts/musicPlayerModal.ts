/**
 * Music Player Modal
 *
 * Binds the shared Navidrome floating player rendered by MusicPlayerModal.astro.
 *
 * Responsibilities:
 * - Fetch public playlists/tracks from local /api/music endpoints.
 * - Proxy playback through the local stream endpoint so credentials stay server-side.
 * - Keep expanded, collapsed/miniplayer, and minimized dock states distinct.
 * - Preserve playback across minimize/collapse while close fully resets the player.
 * - Clamp drag/resize geometry to the viewport, with the same margins as the terminal.
 *
 * Astro ClientRouter notes:
 * - The component root uses transition:persist, so this module rebinds after
 *   astro:page-load without destroying active playback.
 * - Browser view-transition snapshots can paint above fixed DOM. When the
 *   dialog itself is open, we skip that page transition so content cannot
 *   momentarily cover the player. The dock chip does not need this.
 */

import {
	advanceMusicQueue,
	createMusicPlaybackState,
	formatMusicDuration,
	getMusicPlayerFlavorFromSiteFlavor,
	getNextMusicPlayerFlavor,
	getNextMusicRepeatMode,
	getSiteFlavorFromMusicPlayerFlavor,
	moveMusicQueueNext,
	moveMusicQueuePrevious,
	selectMusicTrack,
	setMusicRepeatMode,
	setMusicShuffleEnabled,
	type MusicPlaybackState,
	type MusicQueueResult,
	type MusicPlayerFlavor,
} from "@/lib/musicPlayer";
import { resetTextEffect, writeTextEffectText } from "@/lib/textEffects/textEffect";
import {
	resizeTerminalWindowRectFromEdge,
	shouldTreatTerminalHandleTapAsDoubleTap,
	type TerminalWindowRect,
} from "@/lib/navBrand/terminalWindow";
import { AsciiVisualizerController } from "@/lib/asciiVisualizer";
import { getWindowKeyResizeEdge, resolveWindowKeyNudge } from "@/scripts/floatingWindowKeys";
import "@/scripts/textEffectRegistry";

interface MusicPlaylist {
	id?: string;
	name?: string;
	songCount?: number;
	coverArt?: string;
}

interface MusicTrack {
	id?: string;
	title?: string;
	artist?: string;
	album?: string;
	coverArt?: string;
	duration?: number;
}

interface MusicPageRefs {
	terminal: HTMLElement;
	announcer: HTMLElement | null;
	dockChip: HTMLElement | null;
	dragHandle: HTMLElement | null;
	windowTitle: HTMLElement | null;
	windowPlaylist: HTMLElement | null;
	flavorButton: HTMLElement | null;
	minimizeButton: HTMLElement | null;
	collapseButton: HTMLElement | null;
	closeButton: HTMLElement | null;
	nowFile: HTMLElement | null;
	cover: HTMLElement | null;
	signalLabel: HTMLElement | null;
	signalStack: HTMLElement | null;
	terminalBody: HTMLElement | null;
	controlPanel: HTMLElement | null;
	secondaryControls: HTMLElement | null;
	timeRow: HTMLElement | null;
	player: HTMLElement | null;
	playButton: HTMLElement | null;
	stopButton: HTMLElement | null;
	previousButton: HTMLElement | null;
	nextButton: HTMLElement | null;
	shuffleButton: HTMLElement | null;
	repeatButton: HTMLElement | null;
	progressInput: HTMLElement | null;
	elapsedTimeNode: HTMLElement | null;
	durationTimeNode: HTMLElement | null;
	playlistsRoot: HTMLElement | null;
	playlistsState: HTMLElement | null;
	playlistsCount: HTMLElement | null;
	resizeHandles: HTMLElement[];
}

let refs: MusicPageRefs | null = null;
let visualizer: AsciiVisualizerController | null = null;
let controlsAbortController: AbortController | null = null;
let rootObserver: MutationObserver | null = null;
let dockObserver: MutationObserver | null = null;
let stickyMetricsObserver: ResizeObserver | null = null;
let playlistsLoadPromise: Promise<void> | null = null;
let activeFlavor: MusicPlayerFlavor = "DEFAULT";
let playbackState: MusicPlaybackState<MusicTrack> = createMusicPlaybackState<MusicTrack>();
let isMusicOpen = false;
let isMusicMinimized = false;
let playlistsLoaded = false;
let currentPlaylist: MusicPlaylist | null = null;
let currentTrack: MusicTrack | null = null;
let browsingPlaylist: MusicPlaylist | null = null;
let browsingTracks: MusicTrack[] = [];
let expandedPlaylistId: string | null = null;
let musicWindowRect: TerminalWindowRect | null = null;
let expandedMusicRect: TerminalWindowRect | null = null;
let collapsedMusicRect: TerminalWindowRect | null = null;
let musicWindowMode: "expanded" | "collapsed" = "expanded";
// Expanded only: the window fills the movement box. expandedMusicRect keeps the
// windowed size to come back to.
let isMusicMaximized = false;
const EXPANDED_MIN_WIDTH = 560;
let lastDragHandleTapTs: number | null = null;
let interactionState:
	| {
			kind: "drag";
			pointerId: number;
			captureTarget: HTMLElement;
			startX: number;
			startY: number;
			startRect: TerminalWindowRect;
	  }
	| {
			kind: "resize";
			pointerId: number;
			captureTarget: HTMLElement;
			edge: string;
			startX: number;
			startY: number;
			startRect: TerminalWindowRect;
	  }
	| null = null;

interface AstroBeforeSwapEvent extends Event {
	viewTransition?: {
		skipTransition?: () => void;
	};
}

function getRefs(): MusicPageRefs | null {
	const terminal = document.getElementById("music-terminal");
	if (!(terminal instanceof HTMLElement)) return null;

	return {
		terminal,
		announcer: document.getElementById("music-announcer"),
		dockChip: document.getElementById("music-dock-chip"),
		dragHandle: document.getElementById("music-terminal-drag-handle"),
		windowTitle: document.getElementById("music-window-title"),
		windowPlaylist: document.getElementById("music-window-playlist"),
		flavorButton: document.getElementById("music-flavor-button"),
		minimizeButton: document.getElementById("music-minimize-button"),
		collapseButton: document.getElementById("music-collapse-button"),
		closeButton: document.getElementById("music-close-button"),
		nowFile: document.getElementById("music-now-file"),
		cover: document.getElementById("music-cover"),
		signalLabel: document.getElementById("music-signal-label"),
		signalStack: document.querySelector<HTMLElement>(".music-signal-stack"),
		terminalBody: document.querySelector<HTMLElement>(".music-terminal-body"),
		controlPanel: document.querySelector<HTMLElement>(".music-control-panel"),
		secondaryControls: document.querySelector<HTMLElement>(".music-secondary-controls"),
		timeRow: document.querySelector<HTMLElement>(".music-time-row"),
		player: document.getElementById("music-player"),
		playButton: document.getElementById("music-play-button"),
		stopButton: document.getElementById("music-stop-button"),
		previousButton: document.getElementById("music-previous-button"),
		nextButton: document.getElementById("music-next-button"),
		shuffleButton: document.getElementById("music-shuffle-button"),
		repeatButton: document.getElementById("music-repeat-button"),
		progressInput: document.getElementById("music-progress"),
		elapsedTimeNode: document.getElementById("music-time-elapsed"),
		durationTimeNode: document.getElementById("music-time-duration"),
		playlistsRoot: document.getElementById("music-playlists"),
		playlistsState: document.getElementById("music-playlists-state"),
		playlistsCount: document.getElementById("music-playlists-count"),
		resizeHandles: Array.from(document.querySelectorAll<HTMLElement>("[data-music-resize]")),
	};
}

function text(value: unknown, fallback = "") {
	return typeof value === "string" && value.trim() ? value : fallback;
}

async function fetchJson(path: string) {
	const response = await fetch(path, { headers: { Accept: "application/json" } });
	const payload = await response.json().catch(() => ({}));

	if (!response.ok) {
		// Non-string errors come from proxies/platform pages, not our API: never show "[object Object]".
		throw new Error(text(payload.error, `Request failed: ${response.status}`));
	}

	return payload;
}

function coverUrl(id: string) {
	return `/api/music/cover/${encodeURIComponent(id)}`;
}

function setState(stateNode: HTMLElement | null, countNode: HTMLElement | null, message: string, countLabel: string) {
	if (stateNode) {
		stateNode.hidden = false;
		stateNode.textContent = message;
	}
	if (countNode) countNode.textContent = countLabel;
}

function setText(root: ParentNode, selector: string, value: string) {
	const node = root.querySelector(selector);
	if (node) node.textContent = value;
}

function setHidden(element: HTMLElement | null, hidden: boolean) {
	if (!element) return;
	element.hidden = hidden;
	element.setAttribute("aria-hidden", hidden ? "true" : "false");
}

// Same margins as the terminal window, so both windows share one movement box.
function getWindowMargin() {
	return window.matchMedia("(max-width: 768px)").matches ? 12 : 24;
}

function isMobileMusicViewport() {
	return window.matchMedia("(width < 640px)").matches;
}

function getMusicElementBottom(element: HTMLElement | null) {
	if (!refs?.terminal || !element) return null;
	const terminalRect = refs.terminal.getBoundingClientRect();
	const elementRect = element.getBoundingClientRect();
	const scrollOffset = refs.terminalBody?.contains(element) ? refs.terminalBody.scrollTop : 0;
	return Math.ceil(elementRect.bottom - terminalRect.top + scrollOffset);
}

function getMusicBodyPaddingEnd() {
	if (!refs?.terminalBody) return 0;
	const style = window.getComputedStyle(refs.terminalBody);
	return Number.parseFloat(style.paddingBlockEnd || style.paddingBottom || "0") || 0;
}

function updateStickyMetrics() {
	if (!refs?.terminal || !refs.controlPanel) return;
	const controlPanelHeight = Math.ceil(refs.controlPanel.getBoundingClientRect().height);
	refs.terminal.style.setProperty("--music-control-panel-block-size", `${controlPanelHeight}px`);
}

function getMusicBounds() {
	// Match the terminal: the viewport inset by the window margin. The window may
	// sit over the sidebar and the page rails, exactly as the terminal does.
	const margin = getWindowMargin();
	const left = margin;
	const top = margin;
	const right = window.innerWidth - margin;
	const bottom = window.innerHeight - margin;

	return {
		left,
		top,
		right: Math.max(left + 1, right),
		bottom: Math.max(top + 1, bottom),
		width: Math.max(1, right - left),
		height: Math.max(1, bottom - top),
	};
}

function getCurrentSidebarWidth() {
	if (!window.matchMedia("(min-width: 1024px)").matches) return 0;
	const sidebar = document.querySelector<HTMLElement>(".nav-menu");
	const rect = sidebar?.getBoundingClientRect();
	return rect && rect.right > 0 ? rect.right : 0;
}

/**
 * The box the window opens in: the page area between the sidebar and the
 * header/footer rails. It only sets the initial centred size and position.
 * Dragging and resizing use the wider getMusicBounds().
 */
function getMusicHomeBounds() {
	const bounds = getMusicBounds();
	if (isMobileMusicViewport()) return bounds;

	const margin = 20;
	const railMargin = 4;
	const headerRailRect = document.querySelector<HTMLElement>("header hr")?.getBoundingClientRect();
	const footerRailRect = document.querySelector<HTMLElement>("footer hr")?.getBoundingClientRect();
	const left = getCurrentSidebarWidth() + margin;
	const top = Math.max(
		margin,
		headerRailRect && headerRailRect.bottom > 0 ? headerRailRect.bottom + railMargin : margin
	);
	const right = window.innerWidth - margin;
	const bottom = Math.min(
		window.innerHeight - margin,
		footerRailRect && footerRailRect.top > top && footerRailRect.top < window.innerHeight
			? footerRailRect.top - railMargin
			: window.innerHeight - margin
	);

	return {
		left,
		top,
		right: Math.max(left + 1, right),
		bottom: Math.max(top + 1, bottom),
		width: Math.max(1, right - left),
		height: Math.max(1, bottom - top),
	};
}

function getMinimumMusicSize() {
	const mobile = isMobileMusicViewport();
	const collapsed = musicWindowMode === "collapsed";
	const mobileExpandedFloor = getMusicElementBottom(refs?.signalStack ?? null) ?? 260;
	// Collapsed minimum keeps playback/progress/timers visible and lets lower controls scroll out.
	const collapsedProgressFloor = getMusicElementBottom(refs?.timeRow ?? null) ?? 170;
	return {
		width: getMinimumMusicWidth(),
		height: mobile
			? collapsed
				? collapsedProgressFloor
				: mobileExpandedFloor
			: collapsed
				? collapsedProgressFloor
				: 520,
	};
}

function getMinimumMusicWidth() {
	const mobile = isMobileMusicViewport();
	const collapsed = musicWindowMode === "collapsed";
	return mobile ? Math.min(320, window.innerWidth - getWindowMargin() * 2) : collapsed ? 420 : EXPANDED_MIN_WIDTH;
}

function getMaximumMusicSize() {
	const bounds = getMusicBounds();
	const collapsed = musicWindowMode === "collapsed";
	// Collapsed maximum is exactly the full miniplayer content, not the whole viewport.
	const collapsedCeiling = (getMusicElementBottom(refs?.controlPanel ?? null) ?? 190) + getMusicBodyPaddingEnd();
	return {
		width: bounds.width,
		height: collapsed ? Math.min(collapsedCeiling, bounds.height) : bounds.height,
	};
}

function getPreferredMusicRect() {
	const bounds = getMusicHomeBounds();
	const mobile = isMobileMusicViewport();
	// Open at the narrowest allowed width; the visitor can widen or maximize it.
	const width = mobile ? bounds.width : Math.min(EXPANDED_MIN_WIDTH, bounds.width);
	const height = bounds.height;
	return clampMusicRect({
		x: bounds.left + (bounds.width - width) / 2,
		y: bounds.top + (bounds.height - height) / 2,
		width,
		height,
	});
}

function getPreferredCollapsedMusicRect() {
	const bounds = getMusicHomeBounds();
	const base = musicWindowRect ?? expandedMusicRect ?? getPreferredMusicRect();
	const width = Math.min(Math.max(base.width, 520), 640, bounds.width);
	const height = getMaximumMusicSize().height;
	return clampMusicRect({
		x: bounds.left + (bounds.width - width) / 2,
		y: bounds.top + (bounds.height - height) / 2,
		width,
		height,
	});
}

function clampMusicRect(rect: TerminalWindowRect) {
	const bounds = getMusicBounds();
	const min = getMinimumMusicSize();
	const max = getMaximumMusicSize();
	const maxWidth = Math.min(max.width, bounds.width);
	const maxHeight = Math.min(max.height, bounds.height);
	const minWidth = Math.min(min.width, maxWidth);
	const minHeight = Math.min(min.height, maxHeight);
	const width = Math.min(Math.max(rect.width, minWidth), maxWidth);
	const height = Math.min(Math.max(rect.height, minHeight), maxHeight);
	const x = Math.min(Math.max(rect.x, bounds.left), Math.max(bounds.left, bounds.right - width));
	const y = Math.min(Math.max(rect.y, bounds.top), Math.max(bounds.top, bounds.bottom - height));
	return { x, y, width, height };
}

function getMaximizedMusicRect() {
	const bounds = getMusicBounds();
	return { x: bounds.left, y: bounds.top, width: bounds.width, height: bounds.height };
}

function isMaximizedMusicRect(rect: TerminalWindowRect | null) {
	if (!rect) return false;
	const full = getMaximizedMusicRect();
	return (
		Math.abs(rect.x - full.x) < 1 &&
		Math.abs(rect.y - full.y) < 1 &&
		Math.abs(rect.width - full.width) < 1 &&
		Math.abs(rect.height - full.height) < 1
	);
}

/**
 * The size button steps through three sizes like the terminal's: windowed,
 * maximized, miniplayer, then back. Where the windowed size already fills the
 * movement box (phones), the maximized step is skipped.
 */
function getNextMusicWindowSize(): "maximized" | "collapsed" | "windowed" {
	if (musicWindowMode === "collapsed") return "windowed";
	if (isMusicMaximized || isMaximizedMusicRect(musicWindowRect)) return "collapsed";
	return "maximized";
}

function updateSizeButton() {
	if (!refs?.collapseButton) return;
	const next = getNextMusicWindowSize();
	const label =
		next === "maximized"
			? "Maximize music player"
			: next === "collapsed"
				? "Collapse music player"
				: "Expand music player";
	refs.collapseButton.textContent = next === "collapsed" ? "[-]" : "[+]";
	refs.collapseButton.setAttribute("aria-label", label);
	refs.collapseButton.setAttribute("title", label);
	refs.collapseButton.setAttribute("aria-expanded", String(musicWindowMode !== "collapsed"));
}

function applyMusicWindowRect(options: { preferCollapsedMaxHeight?: boolean } = {}) {
	if (!refs?.terminal) return;
	// A maximized window follows the viewport, except while it is being resized.
	const sourceRect =
		isMusicMaximized && !interactionState ? getMaximizedMusicRect() : (musicWindowRect ?? getPreferredMusicRect());
	let measurementRect = sourceRect;
	if (musicWindowMode === "collapsed") {
		// Apply collapsed width first, then measure height after container queries reflow.
		const bounds = getMusicBounds();
		const width = Math.min(Math.max(sourceRect.width, Math.min(getMinimumMusicWidth(), bounds.width)), bounds.width);
		const x = Math.min(Math.max(sourceRect.x, bounds.left), Math.max(bounds.left, bounds.right - width));
		refs.terminal.dataset.musicWindowMode = musicWindowMode;
		refs.terminal.style.left = `${x}px`;
		refs.terminal.style.width = `${width}px`;
		void refs.terminal.offsetHeight;
		measurementRect = { ...sourceRect, x, width };
		if (options.preferCollapsedMaxHeight) {
			measurementRect.height = getMaximumMusicSize().height;
		}
	}
	const rect = clampMusicRect(measurementRect);
	musicWindowRect = rect;
	if (musicWindowMode === "collapsed") {
		collapsedMusicRect = rect;
	} else if (!isMusicMaximized) {
		expandedMusicRect = rect;
	}
	updateSizeButton();
	refs.terminal.dataset.musicWindowMode = musicWindowMode;
	refs.terminal.style.left = `${rect.x}px`;
	refs.terminal.style.top = `${rect.y}px`;
	refs.terminal.style.width = `${rect.width}px`;
	refs.terminal.style.height = `${rect.height}px`;
	updateStickyMetrics();
}

function updateDockStack() {
	const chips = [document.getElementById("terminal-dock-chip"), document.getElementById("music-dock-chip")].filter(
		(chip): chip is HTMLElement => chip instanceof HTMLElement && !chip.hidden
	);

	chips.forEach((chip, index) => {
		chip.style.setProperty("--dock-stack-index", String(index + 1));
		chip.style.setProperty("--dock-mobile-stack-index", String(index));
	});
}

function updateMusicVisibility() {
	setHidden(refs?.terminal ?? null, !isMusicOpen);
	setHidden(refs?.dockChip ?? null, !isMusicMinimized);
	if (refs?.dockChip) refs.dockChip.dataset.musicDocked = isMusicMinimized ? "true" : "false";
	if (isMusicOpen) applyMusicWindowRect();
	updateDockStack();
}

async function loadPlaylistsOnce() {
	if (playlistsLoaded) return;
	if (playlistsLoadPromise) return playlistsLoadPromise;

	playlistsLoadPromise = (async () => {
		try {
			const playlistsPayload = await fetchJson("/api/music/playlists");
			renderPlaylists(Array.isArray(playlistsPayload.playlists) ? playlistsPayload.playlists : []);
			playlistsLoaded = true;
			setSignal("[\u00A0carrier search...\u00A0]");
			updateNowFile();
			updateCover(null);
		} catch (error) {
			const message = error instanceof Error ? error.message : "Could not reach the music service.";
			setState(refs?.playlistsState ?? null, refs?.playlistsCount ?? null, message, "error");
			setSignal("[\u00A0carrier dropped...\u00A0]");
		} finally {
			playlistsLoadPromise = null;
		}
	})();

	return playlistsLoadPromise;
}

function openMusicDialog() {
	if (!musicWindowRect) {
		musicWindowRect = getPreferredMusicRect();
	}
	isMusicOpen = true;
	isMusicMinimized = false;
	refs?.terminal.classList.toggle("is-collapsed", musicWindowMode === "collapsed");
	updateMusicVisibility();
	visualizer?.setVisible(true);
	void loadPlaylistsOnce();
	refs?.terminal.focus();
}

function closeMobileNavigation() {
	const toggle = document.getElementById("nav-toggle");
	if (toggle instanceof HTMLInputElement) toggle.checked = false;
}

function handleMusicTrigger(event: Event) {
	const target = event.target;
	if (!(target instanceof Element)) return;
	const trigger = target.closest("[data-music-player-trigger]");
	if (!trigger) return;

	event.preventDefault();
	openMusicDialog();
	closeMobileNavigation();
}

function handleMusicTriggerKeydown(event: KeyboardEvent) {
	if (event.key !== "Enter" && event.key !== " ") return;
	handleMusicTrigger(event);
}

/** True while keyboard focus is somewhere inside the player window. */
function musicHasFocus(): boolean {
	return Boolean(refs?.terminal.contains(document.activeElement));
}

function minimizeMusicDialog() {
	endMusicInteraction();
	applyMusicWindowRect();
	const hadFocus = musicHasFocus();
	isMusicOpen = false;
	isMusicMinimized = true;
	// Hiding the window would drop focus to <body>. Show the dock chip that
	// restores it and move focus there first, so the window is never hidden
	// while it still holds focus. Focus elsewhere on the page is left alone.
	if (hadFocus && refs?.dockChip) {
		setHidden(refs.dockChip, false);
		refs.dockChip.focus();
	}
	updateMusicVisibility();
	// Nothing is on screen: stop the 60fps analyser loop and the idle animation.
	visualizer?.setVisible(false);
}

function closeMusicDialog() {
	endMusicInteraction();
	const player = refs?.player;
	if (player instanceof HTMLAudioElement) {
		player.pause();
		player.removeAttribute("src");
		player.load();
	}
	visualizer?.setPlaying(false);
	visualizer?.setVisible(false);
	isMusicOpen = false;
	isMusicMinimized = false;
	musicWindowRect = null;
	expandedMusicRect = null;
	collapsedMusicRect = null;
	musicWindowMode = "expanded";
	isMusicMaximized = false;
	playlistsLoaded = false;
	playlistsLoadPromise = null;
	currentPlaylist = null;
	currentTrack = null;
	browsingPlaylist = null;
	browsingTracks = [];
	expandedPlaylistId = null;
	setPlaybackState(createMusicPlaybackState<MusicTrack>());
	refs?.terminal.classList.remove("is-collapsed");
	collapseExpandedPlaylist();
	if (refs?.playlistsRoot) {
		refs.playlistsRoot.textContent = "";
		refs.playlistsRoot.hidden = true;
	}
	setState(refs?.playlistsState ?? null, refs?.playlistsCount ?? null, "Loading public playlists...", "loading");
	updateWindowTitle();
	updateNowFile();
	updateCover(null);
	updatePlaybackUi();
	setSignal("[\u00A0carrier search...\u00A0]");
	// Return focus to the trigger before hiding the window so aria-hidden is
	// never set while a descendant element still holds focus. Focus elsewhere
	// on the page is left alone.
	if (musicHasFocus()) {
		const triggerEl = document.querySelector<HTMLElement>("[data-music-player-trigger]");
		(triggerEl ?? document.body).focus();
	}
	announce("");
	updateMediaSession(null);
	updateMusicVisibility();
}

function compactName(value: string) {
	return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function mp3Name(value: string) {
	const name = compactName(value).replace(/\.+$/, "");
	return name.endsWith(".mp3") ? name : `${name}.mp3`;
}

function getTrackById(trackId: string | null) {
	if (!trackId) return null;
	return playbackState.playlistTracks.find((track) => track.id === trackId) ?? null;
}

function setPlaybackState(nextState: MusicPlaybackState<MusicTrack>) {
	playbackState = nextState;
	currentTrack = getTrackById(playbackState.currentTrackId);
}

function updateWindowTitle() {
	const title = currentPlaylist?.name || "loading_playlist";
	const compactTitle = compactName(text(title, "loading_playlist"));
	if (refs?.windowPlaylist) {
		refs.windowPlaylist.textContent = compactTitle;
	} else if (refs?.windowTitle) {
		refs.windowTitle.textContent = `navidrome.exe | ${compactTitle}`;
	}
}

/** Say something to screen readers through the player's polite live region. */
function announce(message: string): void {
	if (refs?.announcer) refs.announcer.textContent = message;
}

/** The raw slider value is a percentage; read the position out as times instead. */
function setSeekValueText(currentTime: number, duration: number): void {
	const valueText = `${formatMusicDuration(currentTime)} of ${formatMusicDuration(duration)}`;
	if (refs?.progressInput?.getAttribute("aria-valuetext") !== valueText) {
		refs?.progressInput?.setAttribute("aria-valuetext", valueText);
	}
}

function describeTrack(track: MusicTrack): string {
	const title = text(track.title, "Untitled track");
	return track.artist ? `${title} by ${track.artist}` : title;
}

/**
 * Tell the operating system what is playing, so lock screen, headset and
 * keyboard media keys show and control it.
 */
function updateMediaSession(track: MusicTrack | null): void {
	if (!("mediaSession" in navigator)) return;
	if (!track) {
		navigator.mediaSession.metadata = null;
		navigator.mediaSession.playbackState = "none";
		return;
	}
	const coverId = track.coverArt || currentPlaylist?.coverArt || currentPlaylist?.id;
	navigator.mediaSession.metadata = new MediaMetadata({
		title: text(track.title, "Untitled track"),
		artist: track.artist ?? "",
		album: track.album ?? "",
		artwork: coverId ? [{ src: new URL(coverUrl(coverId), location.origin).href }] : [],
	});
}

function bindMediaSession(signal: AbortSignal): void {
	if (!("mediaSession" in navigator)) return;
	const handlers: [MediaSessionAction, () => void][] = [
		// Explicit, not a toggle: a headset or OS widget with stale state can send
		// "play" while already playing, and a toggle would then pause.
		["play", () => void (playbackState.isPlaying || togglePlayback())],
		["pause", () => void (playbackState.isPlaying && togglePlayback())],
		["stop", () => stopPlayback()],
		["previoustrack", playPreviousTrack],
		["nexttrack", playNextTrack],
	];
	for (const [action, handler] of handlers) {
		// Some browsers throw for actions they do not support.
		try {
			navigator.mediaSession.setActionHandler(action, handler);
			signal.addEventListener("abort", () => navigator.mediaSession.setActionHandler(action, null), { once: true });
		} catch {
			continue;
		}
	}
}

function setSignal(message: string) {
	if (refs?.signalLabel) {
		// Reset first: cancelling a running effect restores that effect's own target.
		resetTextEffect(refs.signalLabel);
		refs.signalLabel.dataset.textEffectStableText = message;
		writeTextEffectText(refs.signalLabel, message);
	}
}

function updateNowFile() {
	if (!refs?.nowFile) return;

	refs.nowFile.textContent = currentTrack ? mp3Name(text(currentTrack.title, "untitled_track")) : "waiting_signal.mp3";
	const scrollFrame = window.requestAnimationFrame(() => {
		const viewport = refs?.nowFile?.parentElement;
		if (!(viewport instanceof HTMLElement) || !refs?.nowFile) return;

		const distance = Math.max(0, refs.nowFile.scrollWidth - viewport.clientWidth);
		viewport.style.setProperty("--music-now-file-scroll-distance", `${distance}px`);
		viewport.classList.toggle("is-scrolling", distance > 0);
		// Full title on hover/AT when the line is truncated or scrolling
		viewport.title = distance > 0 ? (refs.nowFile.textContent ?? "") : "";
		viewport.classList.toggle("is-playing", Boolean(currentTrack));
	});
	controlsAbortController?.signal.addEventListener("abort", () => window.cancelAnimationFrame(scrollFrame), {
		once: true,
	});
}

function updateCover(source: MusicPlaylist | MusicTrack | null) {
	const cover = refs?.cover;
	if (!(cover instanceof HTMLImageElement)) return;

	const coverId = source?.coverArt || source?.id;
	if (coverId) {
		cover.src = coverUrl(coverId);
	} else {
		cover.src = "/images/album-art.png";
	}
}

function updatePlaybackUi() {
	const player = refs?.player;
	if (!(player instanceof HTMLAudioElement)) return;

	const duration = Number.isFinite(player.duration) ? player.duration : currentTrack?.duration || 0;
	const currentTime = Number.isFinite(player.currentTime) ? player.currentTime : 0;
	const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

	if (refs?.progressInput instanceof HTMLInputElement) {
		refs.progressInput.value = String(progress);
		refs.progressInput.style.setProperty("--progress", `${progress}%`);
		// Left alone while the slider is focused during playback: a screen reader
		// would otherwise read the time out every second. Seeking updates it.
		if (!(playbackState.isPlaying && document.activeElement === refs.progressInput)) {
			setSeekValueText(currentTime, duration);
		}
	}
	if (refs?.elapsedTimeNode instanceof HTMLTimeElement) {
		refs.elapsedTimeNode.textContent = formatMusicDuration(currentTime);
		refs.elapsedTimeNode.dateTime = `PT${Math.floor(currentTime)}S`;
	}
	if (refs?.durationTimeNode instanceof HTMLTimeElement) {
		refs.durationTimeNode.textContent = formatMusicDuration(duration);
		refs.durationTimeNode.dateTime = `PT${Math.floor(duration)}S`;
	}
	if ("mediaSession" in navigator && currentTrack) {
		navigator.mediaSession.playbackState = playbackState.isPlaying ? "playing" : "paused";
	}
	if (refs?.playButton) {
		const playLabel = refs.playButton.querySelector(".music-play-label");
		const playTitle = playbackState.isPlaying ? "Pause music" : "Play music";
		if (playLabel) playLabel.textContent = playbackState.isPlaying ? "PAUSE" : "PLAY";
		refs.playButton.classList.toggle("is-playing", playbackState.isPlaying);
		refs.playButton.setAttribute("aria-label", playTitle);
		refs.playButton.setAttribute("title", playTitle);
	}
	if (refs?.shuffleButton) {
		refs.shuffleButton.setAttribute("aria-pressed", String(playbackState.shuffleEnabled));
	}
	if (refs?.repeatButton) {
		const repeatIcon = refs.repeatButton.querySelector("i");
		if (repeatIcon) repeatIcon.className = playbackState.repeatMode === "one" ? "icon-repeat-1" : "icon-repeat";
		refs.repeatButton.setAttribute("aria-pressed", String(playbackState.repeatMode !== "none"));
		refs.repeatButton.setAttribute(
			"aria-label",
			playbackState.repeatMode === "one"
				? "Repeat one"
				: playbackState.repeatMode === "all"
					? "Repeat all"
					: "Repeat off"
		);
		refs.repeatButton.setAttribute(
			"title",
			playbackState.repeatMode === "one"
				? "Repeat one"
				: playbackState.repeatMode === "all"
					? "Repeat all"
					: "Repeat off"
		);
	}
	updateControlAvailability();
}

function updateControlAvailability() {
	const hasTracks = playbackState.playlistTracks.length > 0;
	const hasCurrentTrack = Boolean(playbackState.currentTrackId);
	for (const control of [
		refs?.playButton,
		refs?.previousButton,
		refs?.nextButton,
		refs?.shuffleButton,
		refs?.repeatButton,
	]) {
		if (control instanceof HTMLButtonElement) control.disabled = !hasTracks;
	}
	// Controls stay usable while a stream loads: a stalled stream must not lock
	// the player, and a newer playTrack supersedes the pending load.
	if (refs?.stopButton instanceof HTMLButtonElement) refs.stopButton.disabled = !hasCurrentTrack;
	if (refs?.progressInput instanceof HTMLInputElement) refs.progressInput.disabled = !hasCurrentTrack;
}

function highlightPlayingTrack() {
	document.querySelectorAll(".music-terminal-row[data-track-id]").forEach((row) => {
		row.classList.toggle("is-playing", row.getAttribute("data-track-id") === currentTrack?.id);
	});
}

function highlightPlayingPlaylist() {
	document.querySelectorAll<HTMLElement>(".music-playlist-entry").forEach((entry) => {
		const button = entry.querySelector<HTMLElement>(".music-terminal-row[data-playlist-id]");
		const isActivePlaylist = Boolean(currentTrack) && entry.dataset.playlistEntryId === currentPlaylist?.id;
		if (button) button.classList.toggle("is-playing", isActivePlaylist);
	});
}

function setPlaylistChevron(button: Element, expanded: boolean) {
	const icon = button.querySelector("i");
	if (!icon) return;

	icon.className = expanded ? "icon-chevron-down" : "icon-chevron-right";
}

function setPlaylistEntryExpanded(entry: HTMLElement, expanded: boolean) {
	const button = entry.querySelector(".music-terminal-row[data-playlist-id]");
	const queue = entry.querySelector(".music-inline-queue");
	const state = entry.querySelector(".music-inline-state");

	entry.classList.toggle("is-expanded", expanded);
	button?.classList.toggle("is-active", expanded);
	button?.setAttribute("aria-expanded", String(expanded));
	if (button) setPlaylistChevron(button, expanded);
	if (queue instanceof HTMLElement) queue.hidden = !expanded;
	if (!expanded && state instanceof HTMLElement) state.hidden = true;
}

function collapseExpandedPlaylist() {
	document
		.querySelectorAll<HTMLElement>(".music-playlist-entry")
		.forEach((entry) => setPlaylistEntryExpanded(entry, false));
	if (refs?.playlistsRoot) {
		refs.playlistsRoot.classList.remove("is-focused");
		refs.playlistsRoot.style.blockSize = "";
	}
	expandedPlaylistId = null;
	highlightPlayingPlaylist();
}

function renderPlaylists(playlists: MusicPlaylist[]) {
	const playlistsRoot = refs?.playlistsRoot;
	const playlistsState = refs?.playlistsState;
	const playlistsCount = refs?.playlistsCount;
	if (!playlistsRoot || !playlistsState || !playlistsCount) return;

	playlistsRoot.textContent = "";
	if (!playlists.length) {
		setState(playlistsState, playlistsCount, "No public playlists are available yet.", "empty");
		playlistsRoot.hidden = true;
		return;
	}

	for (const playlist of playlists) {
		const entry = document.createElement("div");
		const queueId = `music-playlist-queue-${playlist.id || playlistsRoot.children.length}`;
		const button = document.createElement("button");
		const queue = document.createElement("ol");
		const queueState = document.createElement("div");

		entry.className = "music-playlist-entry";
		entry.dataset.playlistEntryId = playlist.id || "";
		button.type = "button";
		button.className = "music-terminal-row";
		button.dataset.playlistId = playlist.id || "";
		button.setAttribute("aria-expanded", "false");
		button.setAttribute("aria-controls", queueId);
		button.innerHTML = `
			<span aria-hidden="true"><i class="icon-chevron-right"></i></span>
			<span class="music-row-name"></span>
			<span class="music-row-meta"></span>
		`;
		queue.id = queueId;
		queue.className = "music-inline-queue";
		queue.hidden = true;
		queueState.className = "music-inline-state";
		queueState.hidden = true;
		setText(button, ".music-row-name", compactName(text(playlist.name, "untitled_playlist")));
		setText(button, ".music-row-meta", `${playlist.songCount || 0} tracks`);
		button.addEventListener("click", () => loadPlaylist(playlist, entry));
		entry.append(button, queueState, queue);
		playlistsRoot.append(entry);
	}

	playlistsState.hidden = true;
	playlistsRoot.hidden = false;
	playlistsCount.textContent = `${playlists.length}`;
}

function renderTracks(entry: HTMLElement, tracks: MusicTrack[]) {
	const queue = entry.querySelector(".music-inline-queue");
	const queueState = entry.querySelector(".music-inline-state");
	if (!(queue instanceof HTMLOListElement) || !(queueState instanceof HTMLElement)) return;

	queue.textContent = "";
	// Store the browsed album's tracks separately. The active playback queue
	// (playbackState.playlistTracks) is only replaced when the user explicitly
	// plays a track from this album via playTrackFromBrowse().
	browsingTracks = tracks;
	if (!tracks.length) {
		queueState.textContent = "This playlist has no playable tracks.";
		queueState.hidden = false;
		queue.hidden = true;
		setSignal("[\u00A0carrier search...\u00A0]");
		updatePlaybackUi();
		return;
	}

	tracks.forEach((track, index) => {
		const item = document.createElement("li");
		const button = document.createElement("button");
		button.type = "button";
		button.className = "music-terminal-row music-track-row";
		button.dataset.trackId = track.id || "";
		button.innerHTML = `
			<span aria-hidden="true">${index + 1}.</span>
			<span class="music-row-name"></span>
			<span class="music-row-meta"></span>
		`;
		setText(button, ".music-row-name", compactName(text(track.title, "untitled_track")));
		setText(button, ".music-row-meta", formatMusicDuration(track.duration));
		button.addEventListener("click", () => playTrackFromBrowse(track));
		item.append(button);
		queue.append(item);
	});

	queueState.hidden = true;
	queue.hidden = false;
	highlightPlayingTrack();
	highlightPlayingPlaylist();
	setSignal("[\u00A0playlist locked...\u00A0]");
}

function playTrackFromBrowse(track: MusicTrack) {
	// Commit the browsed album's queue and playlist as the active playback
	// context before playing. This preserves shuffle/repeat across album switches.
	if (browsingTracks.length > 0) {
		const newBaseState = createMusicPlaybackState(browsingTracks);
		setPlaybackState({
			...newBaseState,
			shuffleEnabled: playbackState.shuffleEnabled,
			repeatMode: playbackState.repeatMode,
		});
		currentPlaylist = browsingPlaylist;
	}
	playTrack(track);
}

/**
 * Why play() rejected. NotAllowedError is the browser's autoplay policy, which
 * pressing play fixes. Anything else means the stream itself failed (missing
 * track, upstream error), which pressing play again will not fix.
 */
function describePlayFailure(error: unknown, track: MusicTrack | null): { signal: string; announcement: string } {
	if (error instanceof DOMException && error.name === "NotAllowedError") {
		return {
			signal: "[\u00A0playback blocked...\u00A0]",
			announcement: "Playback was blocked by the browser. Press play to start.",
		};
	}
	return {
		signal: "[\u00A0stream error...\u00A0]",
		announcement: track ? `Could not play ${describeTrack(track)}.` : "Could not play this track.",
	};
}

/** Increments per playTrack; a settled play() from an older request is ignored. */
let playRequestId = 0;

function playTrack(track: MusicTrack) {
	const player = refs?.player;
	if (!(player instanceof HTMLAudioElement) || !track.id) return;

	const requestId = ++playRequestId;
	setPlaybackState(selectMusicTrack(playbackState, track.id, { isPlaying: true }));
	updatePlaybackUi();
	player.src = `/api/music/stream/${encodeURIComponent(track.id)}`;
	const playPromise = player.play();
	playPromise
		.then(() => {
			// Announced once playback has really started, so a failed stream is not
			// first reported as playing.
			if (requestId === playRequestId) announce(`Now playing: ${describeTrack(track)}`);
		})
		.catch((error: unknown) => {
			// Switching tracks rejects the previous play() with AbortError; that is not
			// a failure of the track now playing.
			if (requestId !== playRequestId) return;
			if (error instanceof DOMException && error.name === "AbortError") return;
			setPlaybackState({ ...playbackState, isPlaying: false });
			const failure = describePlayFailure(error, track);
			setSignal(failure.signal);
			announce(failure.announcement);
			updatePlaybackUi();
		})
		.finally(() => {
			if (requestId !== playRequestId) return;
			updatePlaybackUi();
		});
	updateWindowTitle();
	updateNowFile();
	updateCover(track.coverArt ? track : currentPlaylist);
	updateMediaSession(track);
	highlightPlayingTrack();
	highlightPlayingPlaylist();
	updatePlaybackUi();
}

/**
 * Resume the loaded track. Like playTrack, a rejection from a play() that a
 * newer request superseded, or that pause() aborted, is not a playback failure.
 */
function resumePlayback(player: HTMLAudioElement): void {
	const requestId = ++playRequestId;
	player.play().catch((error: unknown) => {
		if (requestId !== playRequestId) return;
		if (error instanceof DOMException && error.name === "AbortError") return;
		setPlaybackState({ ...playbackState, isPlaying: false });
		const failure = describePlayFailure(error, currentTrack);
		setSignal(failure.signal);
		announce(failure.announcement);
		updatePlaybackUi();
	});
}

function restartTrack(track: MusicTrack | null = currentTrack) {
	const player = refs?.player;
	if (!(player instanceof HTMLAudioElement) || !track?.id) return;

	if (player.src) {
		player.currentTime = 0;
		setPlaybackState({ ...playbackState, isPlaying: true });
		resumePlayback(player);
		updatePlaybackUi();
		return;
	}

	playTrack(track);
}

function applyQueueResult(result: MusicQueueResult<MusicTrack>) {
	setPlaybackState(result.state);
	if (result.action === "play") {
		if (result.track) playTrack(result.track);
		return;
	}
	if (result.action === "restart" || result.action === "replay") {
		restartTrack(result.track);
		return;
	}
	if (result.action === "stop") {
		stopPlayback({ clearSelection: false });
	} else {
		updatePlaybackUi();
	}
}

/**
 * A playlist load nobody is waiting for any more must not leave the signal on
 * "loading playlist...". If another playlist is loading, that load owns the
 * signal; otherwise show what the player is actually doing.
 */
function settleSignalAfterAbandonedLoad() {
	if (expandedPlaylistId !== null) return;
	const player = refs?.player;
	const playing = player instanceof HTMLAudioElement && !player.paused;
	setSignal(playing ? "[\u00A0stream online...\u00A0]" : "[\u00A0carrier search...\u00A0]");
}

async function loadPlaylist(playlist: MusicPlaylist, entry: HTMLElement) {
	const id = playlist.id;
	const queue = entry.querySelector(".music-inline-queue");
	const queueState = entry.querySelector(".music-inline-state");
	if (!id || !(queue instanceof HTMLOListElement) || !(queueState instanceof HTMLElement)) return;

	if (expandedPlaylistId === id && !queue.hidden) {
		setPlaylistEntryExpanded(entry, false);
		if (refs?.playlistsRoot) {
			refs.playlistsRoot.classList.remove("is-focused");
			refs.playlistsRoot.style.blockSize = "";
		}
		expandedPlaylistId = null;
		highlightPlayingPlaylist();
		return;
	}

	collapseExpandedPlaylist();
	expandedPlaylistId = id;
	if (refs?.playlistsRoot) {
		refs.playlistsRoot.classList.add("is-focused");
	}
	setPlaylistEntryExpanded(entry, true);
	queue.hidden = true;
	queueState.hidden = false;
	queueState.textContent = "Loading playlist tracks...";
	setSignal("[\u00A0loading playlist...\u00A0]");

	try {
		const payload = await fetchJson(`/api/music/playlist/${encodeURIComponent(id)}`);
		// Another playlist was opened (or this one closed) while this loaded.
		if (expandedPlaylistId !== id) {
			settleSignalAfterAbandonedLoad();
			return;
		}
		browsingPlaylist = payload.playlist || playlist;
		if (!currentTrack) {
			// Nothing is playing yet - show this album's info as a preview.
			currentPlaylist = browsingPlaylist;
			updateWindowTitle();
			updateNowFile();
			updateCover(currentPlaylist);
		}
		renderTracks(entry, Array.isArray(payload.tracks) ? payload.tracks : []);
	} catch (error) {
		if (expandedPlaylistId !== id) {
			settleSignalAfterAbandonedLoad();
			return;
		}
		queueState.textContent = error instanceof Error ? error.message : "Could not load playlist.";
		queueState.hidden = false;
		queue.hidden = true;
		setSignal("[\u00A0carrier dropped...\u00A0]");
	}
}

function stopPlayback(options: { clearSelection?: boolean } = {}) {
	const player = refs?.player;
	if (!(player instanceof HTMLAudioElement)) return;

	player.pause();
	player.currentTime = 0;
	setPlaybackState({
		...playbackState,
		currentTrackId: options.clearSelection ? null : playbackState.currentTrackId,
		currentQueueIndex: options.clearSelection ? -1 : playbackState.currentQueueIndex,
		isPlaying: false,
	});
	highlightPlayingTrack();
	highlightPlayingPlaylist();
	updateWindowTitle();
	updateNowFile();
	updatePlaybackUi();
	setSignal("[\u00A0carrier search...\u00A0]");
}

function togglePlayback() {
	const player = refs?.player;
	if (!(player instanceof HTMLAudioElement)) return;

	if (!currentTrack && playbackState.queue[0]) {
		playTrack(playbackState.queue[0]);
		return;
	}

	if (!playbackState.isPlaying) {
		setPlaybackState({ ...playbackState, isPlaying: true });
		updatePlaybackUi();
		resumePlayback(player);
	} else {
		setPlaybackState({ ...playbackState, isPlaying: false });
		player.pause();
		updatePlaybackUi();
	}
}

function playNextTrack() {
	applyQueueResult(moveMusicQueueNext(playbackState));
}

function playPreviousTrack() {
	const player = refs?.player;
	if (!(player instanceof HTMLAudioElement)) return;
	applyQueueResult(moveMusicQueuePrevious(playbackState, player.currentTime));
}

function toggleShuffle() {
	setPlaybackState(setMusicShuffleEnabled(playbackState, !playbackState.shuffleEnabled));
	updatePlaybackUi();
}

function cycleRepeatMode() {
	setPlaybackState(setMusicRepeatMode(playbackState, getNextMusicRepeatMode(playbackState.repeatMode)));
	updatePlaybackUi();
}

function setPlayerFlavor(flavor: MusicPlayerFlavor) {
	activeFlavor = flavor;
	const siteFlavor = getSiteFlavorFromMusicPlayerFlavor(activeFlavor);

	refs?.terminal.setAttribute("data-player-flavor", activeFlavor.toLowerCase());
	refs?.terminal.setAttribute("data-theme", document.documentElement.getAttribute("data-theme") || "dark");
	if (siteFlavor) {
		refs?.terminal.setAttribute("data-flavor", siteFlavor);
	} else {
		refs?.terminal.removeAttribute("data-flavor");
	}
	if (refs?.flavorButton) {
		refs.flavorButton.textContent = `\u00A0${activeFlavor}\u00A0`;
		// The accessible name starts with the visible flavor (WCAG 2.5.3 label in name).
		refs.flavorButton.setAttribute("aria-label", `${activeFlavor}: change music player theme flavor`);
	}
	visualizer?.setFlavor(activeFlavor);
}

function syncPlayerThemeModeFromSite() {
	refs?.terminal.setAttribute("data-theme", document.documentElement.getAttribute("data-theme") || "dark");
}

function syncPlayerFlavorFromSite() {
	syncPlayerThemeModeFromSite();
	setPlayerFlavor(getMusicPlayerFlavorFromSiteFlavor(document.documentElement.getAttribute("data-flavor")));
}

function cycleFlavor() {
	setPlayerFlavor(getNextMusicPlayerFlavor(activeFlavor));
}

function cycleMusicWindowSize() {
	if (!refs?.terminal) return;
	applyMusicWindowRect();
	const next = getNextMusicWindowSize();
	const hadCollapsedRect = Boolean(collapsedMusicRect);
	if (next === "maximized") isMusicMaximized = true;
	if (next === "collapsed") {
		isMusicMaximized = false;
		// Size the miniplayer from the windowed rect, not the maximized one.
		musicWindowRect = expandedMusicRect ?? musicWindowRect;
	}
	musicWindowMode = next === "collapsed" ? "collapsed" : "expanded";
	const collapsed = musicWindowMode === "collapsed";
	refs.terminal.classList.toggle("is-collapsed", collapsed);
	musicWindowRect =
		next === "maximized"
			? getMaximizedMusicRect()
			: next === "collapsed"
				? (collapsedMusicRect ?? getPreferredCollapsedMusicRect())
				: (expandedMusicRect ?? getPreferredMusicRect());
	applyMusicWindowRect({ preferCollapsedMaxHeight: collapsed && !hadCollapsedRect });
}

function handleTopbarDoubleClick(event: MouseEvent) {
	if (event.target instanceof HTMLElement && event.target.closest("button, a, input, select, textarea")) return;
	cycleMusicWindowSize();
}

function beginMusicDrag(event: PointerEvent) {
	if (!refs?.terminal || !refs.dragHandle) return;
	if (!(event.target instanceof HTMLElement)) return;
	if (event.target.closest("button, a, input, select, textarea")) return;

	applyMusicWindowRect();
	interactionState = {
		kind: "drag",
		pointerId: event.pointerId,
		captureTarget: refs.dragHandle,
		startX: event.clientX,
		startY: event.clientY,
		startRect: musicWindowRect ?? getPreferredMusicRect(),
	};
	refs.terminal.classList.add("is-dragging");
	refs.dragHandle.setPointerCapture(event.pointerId);
}

function updateMusicDrag(event: PointerEvent) {
	if (!interactionState || interactionState.kind !== "drag") return;
	musicWindowRect = clampMusicRect({
		...interactionState.startRect,
		x: interactionState.startRect.x + event.clientX - interactionState.startX,
		y: interactionState.startRect.y + event.clientY - interactionState.startY,
	});
	applyMusicWindowRect();
}

function beginMusicResize(event: PointerEvent, handle: HTMLElement, edge: string) {
	if (!refs?.terminal) return;
	const mobile = isMobileMusicViewport();
	if (mobile && edge !== "n") return;
	applyMusicWindowRect();
	interactionState = {
		kind: "resize",
		pointerId: event.pointerId,
		captureTarget: handle,
		edge,
		startX: event.clientX,
		startY: event.clientY,
		startRect: musicWindowRect ?? getPreferredMusicRect(),
	};
	handle.setPointerCapture(event.pointerId);
}

function updateMusicResize(event: PointerEvent) {
	if (!interactionState || interactionState.kind !== "resize") return;
	const deltaX = event.clientX - interactionState.startX;
	const deltaY = event.clientY - interactionState.startY;
	musicWindowRect = clampMusicRect(
		resizeTerminalWindowRectFromEdge(interactionState.edge, interactionState.startRect, deltaX, deltaY)
	);
	applyMusicWindowRect();
}

/** Applies musicWindowRect. Resizing a maximized window makes it an ordinary window again. */
function commitMusicWindowRect() {
	if (isMusicMaximized && !isMaximizedMusicRect(musicWindowRect)) isMusicMaximized = false;
	applyMusicWindowRect();
}

/**
 * Ends a drag or resize however it stopped: pointer released or cancelled, or
 * the window minimized or closed. Idempotent.
 */
function endMusicInteraction() {
	if (!interactionState) return;
	const { captureTarget, pointerId } = interactionState;
	interactionState = null;
	if (captureTarget.hasPointerCapture(pointerId)) captureTarget.releasePointerCapture(pointerId);
	refs?.terminal.classList.remove("is-dragging");
	if (isMusicMaximized) commitMusicWindowRect();
}

/** Arrow keys on the focused title bar move the window, Shift + Arrow keys resize it. */
function handleMusicWindowKeydown(event: KeyboardEvent) {
	const nudge = resolveWindowKeyNudge(event, refs?.dragHandle ?? null);
	if (!nudge) return;
	// The keys are the title bar's: they must not scroll the page behind the window.
	event.preventDefault();
	if (interactionState) return;

	applyMusicWindowRect();
	const rect = musicWindowRect ?? getPreferredMusicRect();
	if (nudge.kind === "move") {
		musicWindowRect = clampMusicRect({ ...rect, x: rect.x + nudge.deltaX, y: rect.y + nudge.deltaY });
		commitMusicWindowRect();
		return;
	}

	const edge = getWindowKeyResizeEdge(nudge, isMobileMusicViewport());
	if (!edge) return;
	const resized = clampMusicRect(resizeTerminalWindowRectFromEdge(edge, rect, nudge.deltaX, nudge.deltaY));
	// At a size limit the clamp would only shift the window: leave it where it is.
	if (resized.width === rect.width && resized.height === rect.height) return;
	musicWindowRect = resized;
	commitMusicWindowRect();
}

function keepMusicAbovePageTransition(event: Event) {
	if (!isMusicOpen) return;
	// Only the open dialog needs this; the dock chip is outside the content flow.
	(event as AstroBeforeSwapEvent).viewTransition?.skipTransition?.();
}

function bindControls(signal: AbortSignal) {
	bindMediaSession(signal);
	// Escape minimizes, but only from inside the window: the page behind it
	// stays usable, and Escape there belongs to the page.
	refs?.terminal.addEventListener(
		"keydown",
		(event) => {
			if (event.key !== "Escape" || event.defaultPrevented) return;
			event.preventDefault();
			minimizeMusicDialog();
		},
		{ signal }
	);
	refs?.playButton?.addEventListener("click", togglePlayback, { signal });
	refs?.stopButton?.addEventListener("click", () => stopPlayback(), { signal });
	refs?.previousButton?.addEventListener("click", playPreviousTrack, { signal });
	refs?.nextButton?.addEventListener("click", playNextTrack, { signal });
	refs?.shuffleButton?.addEventListener("click", toggleShuffle, { signal });
	refs?.repeatButton?.addEventListener("click", cycleRepeatMode, { signal });
	refs?.flavorButton?.addEventListener("click", cycleFlavor, { signal });
	refs?.minimizeButton?.addEventListener("click", minimizeMusicDialog, { signal });
	refs?.closeButton?.addEventListener("click", closeMusicDialog, { signal });
	refs?.dockChip?.addEventListener("click", openMusicDialog, { signal });
	refs?.dragHandle?.addEventListener("pointerdown", beginMusicDrag, { signal });
	refs?.dragHandle?.addEventListener("keydown", handleMusicWindowKeydown, { signal });
	refs?.dragHandle?.addEventListener("dblclick", handleTopbarDoubleClick, { signal });
	refs?.dragHandle?.addEventListener(
		"pointerup",
		(event) => {
			if (!isMobileMusicViewport() || event.pointerType !== "touch") return;
			if (event.target instanceof HTMLElement && event.target.closest("button, a, input, select, textarea")) return;
			const tapCandidate =
				!interactionState ||
				(interactionState.kind === "drag" &&
					Math.abs(event.clientX - interactionState.startX) < 6 &&
					Math.abs(event.clientY - interactionState.startY) < 6);
			if (!tapCandidate) return;

			const now = Date.now();
			if (shouldTreatTerminalHandleTapAsDoubleTap(lastDragHandleTapTs, now)) {
				lastDragHandleTapTs = null;
				cycleMusicWindowSize();
				return;
			}

			lastDragHandleTapTs = now;
		},
		{ signal }
	);
	for (const handle of refs?.resizeHandles ?? []) {
		const edge = handle.dataset.musicResize;
		if (!edge) continue;
		handle.addEventListener("pointerdown", (event) => beginMusicResize(event, handle, edge), { signal });
	}
	document.addEventListener(
		"pointermove",
		(event) => {
			if (!interactionState) return;
			if (interactionState.kind === "drag") {
				updateMusicDrag(event);
				return;
			}
			updateMusicResize(event);
		},
		{ signal }
	);
	// Only the pointer that started the drag or resize can end it: a second
	// finger lifting elsewhere must not drop the window.
	const endPointerInteraction = (event: PointerEvent) => {
		if (interactionState?.pointerId === event.pointerId) endMusicInteraction();
	};
	document.addEventListener("pointerup", endPointerInteraction, { signal });
	document.addEventListener("pointercancel", endPointerInteraction, { signal });
	window.addEventListener(
		"resize",
		() => {
			if (!musicWindowRect) return;
			applyMusicWindowRect();
			updateDockStack();
			updateStickyMetrics();
		},
		{ signal }
	);
	document.addEventListener("music-player:open", openMusicDialog, { signal });
	document.addEventListener("astro:before-swap", keepMusicAbovePageTransition, { signal });
	document.addEventListener("click", handleMusicTrigger, { signal });
	document.addEventListener("keydown", handleMusicTriggerKeydown, { signal });
	refs?.collapseButton?.addEventListener("click", cycleMusicWindowSize, { signal });
	if (refs?.progressInput instanceof HTMLInputElement && refs.player instanceof HTMLAudioElement) {
		refs.progressInput.addEventListener(
			"input",
			() => {
				const player = refs?.player;
				if (!(player instanceof HTMLAudioElement)) return;
				const duration = Number.isFinite(player.duration) ? player.duration : 0;
				if (duration > 0 && refs?.progressInput instanceof HTMLInputElement) {
					player.currentTime = (Number(refs.progressInput.value) / 100) * duration;
					setSeekValueText(player.currentTime, duration);
				}
			},
			{ signal }
		);
	}
	if (refs?.player instanceof HTMLAudioElement) {
		const player = refs.player;
		player.addEventListener("timeupdate", updatePlaybackUi, { signal });
		player.addEventListener("loadedmetadata", updatePlaybackUi, { signal });
		player.addEventListener(
			"error",
			() => {
				setPlaybackState({ ...playbackState, isPlaying: false });
				setSignal("[\u00A0stream error...\u00A0]");
				updatePlaybackUi();
				visualizer?.setPlaying(false);
			},
			{ signal }
		);
		player.addEventListener(
			"play",
			() => {
				setPlaybackState({ ...playbackState, isPlaying: true });
				setSignal("[\u00A0stream online...\u00A0]");
				updatePlaybackUi();
				visualizer?.connect(player);
				visualizer?.setPlaying(true);
			},
			{ signal }
		);
		player.addEventListener(
			"pause",
			() => {
				setPlaybackState({ ...playbackState, isPlaying: false });
				if (!player.ended) setSignal("[\u00A0stream paused...\u00A0]");
				updatePlaybackUi();
				visualizer?.setPlaying(false);
			},
			{ signal }
		);
		player.addEventListener(
			"ended",
			() => {
				applyQueueResult(advanceMusicQueue(playbackState));
				visualizer?.setPlaying(false);
			},
			{ signal }
		);
	}
	rootObserver = new MutationObserver(() => {
		syncPlayerFlavorFromSite();
		if (musicWindowRect) applyMusicWindowRect();
	});
	rootObserver.observe(document.documentElement, {
		attributes: true,
		attributeFilter: ["data-flavor", "data-theme", "data-sidebar-collapsed"],
	});
	dockObserver = new MutationObserver(updateDockStack);
	for (const chipId of ["terminal-dock-chip", "music-dock-chip"]) {
		const chip = document.getElementById(chipId);
		if (chip)
			dockObserver.observe(chip, {
				attributes: true,
				attributeFilter: ["hidden", "data-terminal-docked", "data-music-docked"],
			});
	}
	if (refs?.controlPanel && "ResizeObserver" in window) {
		stickyMetricsObserver = new ResizeObserver(updateStickyMetrics);
		stickyMetricsObserver.observe(refs.controlPanel);
		updateStickyMetrics();
	}
}

function cleanupMusicPage() {
	// The listeners that would end an in-flight drag or resize go with this page.
	endMusicInteraction();
	updateMediaSession(null);
	visualizer?.teardown();
	visualizer = null;
	controlsAbortController?.abort();
	controlsAbortController = null;
	rootObserver?.disconnect();
	rootObserver = null;
	dockObserver?.disconnect();
	dockObserver = null;
	stickyMetricsObserver?.disconnect();
	stickyMetricsObserver = null;
	if (refs?.player instanceof HTMLAudioElement) {
		refs.player.pause();
		refs.player.removeAttribute("src");
		refs.player.load();
	}
	refs = null;
}

async function bootMusicPage() {
	const terminal = document.getElementById("music-terminal");
	if (refs?.terminal === terminal) return;

	cleanupMusicPage();
	refs = getRefs();
	if (!refs) return;

	const vizContainer = document.getElementById("music-ascii-visualizer");
	if (vizContainer instanceof HTMLElement) {
		visualizer = new AsciiVisualizerController();
		// Only animate once the player is actually shown.
		visualizer.setVisible(isMusicOpen);
		visualizer.mount(vizContainer);
		visualizer.setFlavor(activeFlavor);
	}

	controlsAbortController = new AbortController();
	currentPlaylist = null;
	currentTrack = null;
	browsingPlaylist = null;
	browsingTracks = [];
	playbackState = createMusicPlaybackState<MusicTrack>();
	expandedPlaylistId = null;
	bindControls(controlsAbortController.signal);
	syncPlayerFlavorFromSite();
	updateMusicVisibility();
	updatePlaybackUi();
}

document.addEventListener("astro:page-load", bootMusicPage);
if (document.readyState !== "loading") {
	bootMusicPage();
}
