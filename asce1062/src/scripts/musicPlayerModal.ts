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
 * - Clamp drag/resize geometry to the usable viewport/sidebar bounds.
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
import { resetTextEffect } from "@/lib/textEffects/textEffect";
import {
	resizeTerminalWindowRectFromEdge,
	shouldTreatTerminalHandleTapAsDoubleTap,
	type TerminalWindowRect,
} from "@/lib/navBrand/terminalWindow";
import { setupAsciiWidget } from "@/scripts/asciiWidget";
import type { AsciiRevealTeardown } from "@/scripts/asciiWidget";
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
	overlay: HTMLElement | null;
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
let controlsAbortController: AbortController | null = null;
let rootObserver: MutationObserver | null = null;
let dockObserver: MutationObserver | null = null;
let stickyMetricsObserver: ResizeObserver | null = null;
let playlistsLoadPromise: Promise<void> | null = null;
let activeFlavor: MusicPlayerFlavor = "DEFAULT";
let playbackState: MusicPlaybackState<MusicTrack> = createMusicPlaybackState<MusicTrack>();
let isStreamLoading = false;
let isMusicOpen = false;
let isMusicMinimized = false;
let playlistsLoaded = false;
let currentPlaylist: MusicPlaylist | null = null;
let currentTrack: MusicTrack | null = null;
let expandedPlaylistId: string | null = null;
let musicWindowRect: TerminalWindowRect | null = null;
let expandedMusicRect: TerminalWindowRect | null = null;
let collapsedMusicRect: TerminalWindowRect | null = null;
let musicWindowMode: "expanded" | "collapsed" = "expanded";
let lastDragHandleTapTs: number | null = null;
let interactionState:
	| {
			kind: "drag";
			pointerId: number;
			startX: number;
			startY: number;
			startRect: TerminalWindowRect;
	  }
	| {
			kind: "resize";
			pointerId: number;
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
		overlay: document.getElementById("music-modal-overlay"),
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
		throw new Error(payload.error || `Request failed: ${response.status}`);
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

function getWindowMargin() {
	return window.matchMedia("(width < 640px)").matches ? 12 : 20;
}

function isMobileMusicViewport() {
	return window.matchMedia("(width < 640px)").matches;
}

function getCurrentSidebarWidth() {
	if (!window.matchMedia("(min-width: 1024px)").matches) return 0;
	const sidebar = document.querySelector<HTMLElement>(".nav-menu");
	const rect = sidebar?.getBoundingClientRect();
	return rect && rect.right > 0 ? rect.right : 0;
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
	const margin = getWindowMargin();
	const mobile = isMobileMusicViewport();
	if (mobile) {
		// Mobile has little vertical room; match the terminal's margin-only viewport bounds.
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

	const headerRailRect = document.querySelector<HTMLElement>("header hr")?.getBoundingClientRect();
	const footerRailRect = document.querySelector<HTMLElement>("footer hr")?.getBoundingClientRect();
	const left = getCurrentSidebarWidth() + margin;
	const railMargin = 4;
	// Desktop uses the visible page rails and sidebar width as the movement box.
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
	return mobile ? Math.min(320, window.innerWidth - getWindowMargin() * 2) : collapsed ? 420 : 560;
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
	const bounds = getMusicBounds();
	const mobile = isMobileMusicViewport();
	const width = mobile ? bounds.width : Math.min(Math.max(880, bounds.width * 0.72), bounds.width);
	const height = bounds.height;
	return clampMusicRect({
		x: bounds.left + (bounds.width - width) / 2,
		y: bounds.top + (bounds.height - height) / 2,
		width,
		height,
	});
}

function getPreferredCollapsedMusicRect() {
	const bounds = getMusicBounds();
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

function applyMusicWindowRect(options: { preferCollapsedMaxHeight?: boolean } = {}) {
	if (!refs?.terminal) return;
	const sourceRect = musicWindowRect ?? getPreferredMusicRect();
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
	} else {
		expandedMusicRect = rect;
	}
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
	setHidden(refs?.overlay ?? null, !isMusicOpen);
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
			setSignal("[\u00A0carrier search...\u00A0]", "paused");
			updateNowFile();
			updateCover(null);
		} catch (error) {
			const message = error instanceof Error ? error.message : "Could not reach the music service.";
			setState(refs?.playlistsState ?? null, refs?.playlistsCount ?? null, message, "error");
			setSignal("[\u00A0carrier dropped...\u00A0]", "paused");
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

function minimizeMusicDialog() {
	applyMusicWindowRect();
	isMusicOpen = false;
	isMusicMinimized = true;
	updateMusicVisibility();
}

function closeMusicDialog() {
	const player = refs?.player;
	if (player instanceof HTMLAudioElement) {
		player.pause();
		player.removeAttribute("src");
		player.load();
	}
	isMusicOpen = false;
	isMusicMinimized = false;
	isStreamLoading = false;
	musicWindowRect = null;
	expandedMusicRect = null;
	collapsedMusicRect = null;
	musicWindowMode = "expanded";
	playlistsLoaded = false;
	playlistsLoadPromise = null;
	currentPlaylist = null;
	currentTrack = null;
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
	setSignal("[\u00A0carrier search...\u00A0]", "paused");
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

function setSignal(message: string, _mode?: string) {
	if (refs?.signalLabel) {
		refs.signalLabel.dataset.textEffectStableText = message;
		resetTextEffect(refs.signalLabel);
		refs.signalLabel.textContent = message;
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
	}
	if (refs?.elapsedTimeNode instanceof HTMLTimeElement) {
		refs.elapsedTimeNode.textContent = formatMusicDuration(currentTime);
		refs.elapsedTimeNode.dateTime = `PT${Math.floor(currentTime)}S`;
	}
	if (refs?.durationTimeNode instanceof HTMLTimeElement) {
		refs.durationTimeNode.textContent = formatMusicDuration(duration);
		refs.durationTimeNode.dateTime = `PT${Math.floor(duration)}S`;
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
		if (control instanceof HTMLButtonElement) control.disabled = !hasTracks || isStreamLoading;
	}
	if (refs?.stopButton instanceof HTMLButtonElement) refs.stopButton.disabled = !hasCurrentTrack || isStreamLoading;
	if (refs?.progressInput instanceof HTMLInputElement)
		refs.progressInput.disabled = !hasCurrentTrack || isStreamLoading;
}

function highlightPlayingTrack() {
	document.querySelectorAll(".music-terminal-row[data-track-id]").forEach((row) => {
		row.classList.toggle("is-playing", row.getAttribute("data-track-id") === currentTrack?.id);
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
	setPlaybackState(createMusicPlaybackState(tracks));
	if (!tracks.length) {
		queueState.textContent = "This playlist has no playable tracks.";
		queueState.hidden = false;
		queue.hidden = true;
		setSignal("[\u00A0carrier search...\u00A0]", "paused");
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
		button.addEventListener("click", () => playTrack(track));
		item.append(button);
		queue.append(item);
	});

	queueState.hidden = true;
	queue.hidden = false;
	highlightPlayingTrack();
	setSignal("[\u00A0playlist locked...\u00A0]", "paused");
}

function playTrack(track: MusicTrack) {
	const player = refs?.player;
	if (!(player instanceof HTMLAudioElement) || !track.id) return;

	setPlaybackState(selectMusicTrack(playbackState, track.id, { isPlaying: true }));
	isStreamLoading = true;
	updatePlaybackUi();
	player.src = `/api/music/stream/${encodeURIComponent(track.id)}`;
	const playPromise = player.play();
	playPromise
		.catch(() => {
			setPlaybackState({ ...playbackState, isPlaying: false });
			setSignal("[\u00A0playback blocked...\u00A0]", "paused");
			updatePlaybackUi();
		})
		.finally(() => {
			isStreamLoading = false;
			updatePlaybackUi();
		});
	updateWindowTitle();
	updateNowFile();
	updateCover(track.coverArt ? track : currentPlaylist);
	highlightPlayingTrack();
	updatePlaybackUi();
}

function restartTrack(track: MusicTrack | null = currentTrack) {
	const player = refs?.player;
	if (!(player instanceof HTMLAudioElement) || !track?.id) return;

	if (player.src) {
		player.currentTime = 0;
		setPlaybackState({ ...playbackState, isPlaying: true });
		player.play().catch(() => {
			setPlaybackState({ ...playbackState, isPlaying: false });
			setSignal("[\u00A0playback blocked...\u00A0]", "paused");
			updatePlaybackUi();
		});
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
	setSignal("[\u00A0loading playlist...\u00A0]", "waiting");

	try {
		const payload = await fetchJson(`/api/music/playlist/${encodeURIComponent(id)}`);
		currentPlaylist = payload.playlist || playlist;
		updateWindowTitle();
		updateNowFile();
		updateCover(currentPlaylist);
		renderTracks(entry, Array.isArray(payload.tracks) ? payload.tracks : []);
	} catch (error) {
		queueState.textContent = error instanceof Error ? error.message : "Could not load playlist.";
		queueState.hidden = false;
		queue.hidden = true;
		setSignal("[\u00A0carrier dropped...\u00A0]", "paused");
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
	updateWindowTitle();
	updateNowFile();
	updatePlaybackUi();
	setSignal("[\u00A0carrier search...\u00A0]", "paused");
}

function togglePlayback() {
	const player = refs?.player;
	if (!(player instanceof HTMLAudioElement) || isStreamLoading) return;

	if (!currentTrack && playbackState.queue[0]) {
		playTrack(playbackState.queue[0]);
		return;
	}

	if (!playbackState.isPlaying) {
		setPlaybackState({ ...playbackState, isPlaying: true });
		updatePlaybackUi();
		player.play().catch(() => {
			setPlaybackState({ ...playbackState, isPlaying: false });
			setSignal("[\u00A0playback blocked...\u00A0]", "paused");
			updatePlaybackUi();
		});
	} else {
		setPlaybackState({ ...playbackState, isPlaying: false });
		player.pause();
		updatePlaybackUi();
	}
}

function playNextTrack() {
	if (isStreamLoading) return;
	applyQueueResult(moveMusicQueueNext(playbackState));
}

function playPreviousTrack() {
	const player = refs?.player;
	if (!(player instanceof HTMLAudioElement) || isStreamLoading) return;
	applyQueueResult(moveMusicQueuePrevious(playbackState, player.currentTime));
}

function toggleShuffle() {
	if (isStreamLoading) return;
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
	if (refs?.flavorButton) refs.flavorButton.textContent = `\u00A0${activeFlavor}\u00A0`;
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

function toggleCollapsed() {
	const collapsed = !refs?.terminal.classList.contains("is-collapsed");
	applyMusicWindowRect();
	if (musicWindowMode === "collapsed") {
		collapsedMusicRect = musicWindowRect;
	} else {
		expandedMusicRect = musicWindowRect;
	}
	musicWindowMode = collapsed ? "collapsed" : "expanded";
	refs?.terminal.classList.toggle("is-collapsed", collapsed);
	const hadCollapsedRect = Boolean(collapsedMusicRect);
	musicWindowRect = collapsed
		? (collapsedMusicRect ?? getPreferredCollapsedMusicRect())
		: (expandedMusicRect ?? getPreferredMusicRect());
	applyMusicWindowRect({ preferCollapsedMaxHeight: collapsed && !hadCollapsedRect });
	if (refs?.collapseButton) {
		refs.collapseButton.textContent = collapsed ? "[+]" : "[-]";
		refs.collapseButton.setAttribute("aria-label", collapsed ? "Expand music player" : "Collapse music player");
		refs.collapseButton.setAttribute("title", collapsed ? "Expand music player" : "Collapse music player");
		refs.collapseButton.setAttribute("aria-expanded", String(!collapsed));
	}
}

function handleTopbarDoubleClick(event: MouseEvent) {
	if (event.target instanceof HTMLElement && event.target.closest("button, a, input, select, textarea")) return;
	toggleCollapsed();
}

function beginMusicDrag(event: PointerEvent) {
	if (!refs?.terminal || !refs.dragHandle) return;
	if (!(event.target instanceof HTMLElement)) return;
	if (event.target.closest("button, a, input, select, textarea")) return;

	applyMusicWindowRect();
	interactionState = {
		kind: "drag",
		pointerId: event.pointerId,
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

function beginMusicResize(event: PointerEvent, edge: string) {
	if (!refs?.terminal) return;
	const mobile = isMobileMusicViewport();
	if (mobile && edge !== "n") return;
	applyMusicWindowRect();
	interactionState = {
		kind: "resize",
		pointerId: event.pointerId,
		edge,
		startX: event.clientX,
		startY: event.clientY,
		startRect: musicWindowRect ?? getPreferredMusicRect(),
	};
	(event.currentTarget as HTMLElement | null)?.setPointerCapture(event.pointerId);
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

function endMusicInteraction() {
	interactionState = null;
	refs?.terminal.classList.remove("is-dragging");
}

function keepMusicAbovePageTransition(event: Event) {
	if (!isMusicOpen) return;
	// Only the open dialog needs this; the dock chip is outside the content flow.
	(event as AstroBeforeSwapEvent).viewTransition?.skipTransition?.();
}

function bindControls(signal: AbortSignal) {
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
				toggleCollapsed();
				return;
			}

			lastDragHandleTapTs = now;
		},
		{ signal }
	);
	for (const handle of refs?.resizeHandles ?? []) {
		const edge = handle.dataset.musicResize;
		if (!edge) continue;
		handle.addEventListener("pointerdown", (event) => beginMusicResize(event, edge), { signal });
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
	document.addEventListener("pointerup", endMusicInteraction, { signal });
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
	refs?.collapseButton?.addEventListener("click", toggleCollapsed, { signal });
	if (refs?.progressInput instanceof HTMLInputElement && refs.player instanceof HTMLAudioElement) {
		refs.progressInput.addEventListener(
			"input",
			() => {
				const player = refs?.player;
				if (!(player instanceof HTMLAudioElement)) return;
				const duration = Number.isFinite(player.duration) ? player.duration : 0;
				if (duration > 0 && refs?.progressInput instanceof HTMLInputElement)
					player.currentTime = (Number(refs.progressInput.value) / 100) * duration;
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
				isStreamLoading = false;
				setPlaybackState({ ...playbackState, isPlaying: false });
				setSignal("[\u00A0stream error...\u00A0]", "paused");
				updatePlaybackUi();
			},
			{ signal }
		);
		player.addEventListener(
			"play",
			() => {
				setPlaybackState({ ...playbackState, isPlaying: true });
				isStreamLoading = false;
				setSignal("[\u00A0stream online...\u00A0]", "playing");
				updatePlaybackUi();
			},
			{ signal }
		);
		player.addEventListener(
			"pause",
			() => {
				setPlaybackState({ ...playbackState, isPlaying: false });
				if (!player.ended) setSignal("[\u00A0stream paused...\u00A0]", "paused");
				updatePlaybackUi();
			},
			{ signal }
		);
		player.addEventListener(
			"ended",
			() => {
				applyQueueResult(advanceMusicQueue(playbackState));
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

	controlsAbortController = new AbortController();
	currentPlaylist = null;
	currentTrack = null;
	playbackState = createMusicPlaybackState<MusicTrack>();
	isStreamLoading = false;
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

let musicAsciiTeardown: AsciiRevealTeardown | null = null;

function initMusicAscii(): void {
	musicAsciiTeardown?.();
	const musicAsciiViewport = document.querySelector<HTMLElement>("#music-ascii .ascii-widget-scroll");
	musicAsciiTeardown = setupAsciiWidget("music-ascii", {
		container: musicAsciiViewport,
		replayOnDice: true,
	});
}

document.addEventListener("astro:page-load", initMusicAscii);
if (document.readyState !== "loading") {
	initMusicAscii();
}
