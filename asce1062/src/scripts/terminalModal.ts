/**
 * Shared terminal window coordinator.
 *
 * Responsibilities:
 * - listen for the shared `navbrand:open-terminal` event
 * - own the terminal shell lifecycle (open, close, minimize, maximize, restore)
 * - keep geometry and command history in memory for the current session only
 * - render curated boot lines plus terminal command output
 *
 * Boundary:
 * - teaser policy and prompt nudges stay in `src/scripts/navBrand.ts`
 * - command parsing stays pure in `src/lib/navBrand/commands.ts`
 * - this file only executes intents and renders terminal-local history
 */
import { PREF_KEYS, getPref } from "@/lib/prefs";
import {
	buildNavBrandCommandIntent,
	resolveNavBrandCommandInput,
	type NavBrandCommandId,
	type NavBrandCommandIntent,
	type ResolvedNavBrandCommand,
} from "@/lib/navBrand/commands";
import {
	getTerminalPresenceSummary,
	selectTerminalAtmosphereMessage,
	type TerminalAtmosphereReason,
} from "@/lib/navBrand/messages";
import { buildTerminalPrelude } from "@/lib/navBrand/terminalPrelude";
import { buildTerminalSystemProfile, type TerminalSystemProfile } from "@/lib/navBrand/terminalSystemProfile";
import {
	centerTerminalWindowRect,
	createTerminalWindowState,
	getNextTerminalWindowMode,
	getNextTerminalWindowModeForViewport,
	getTerminalWindowPresetRect,
	minimizeTerminalWindow,
	resizeTerminalWindowRectFromEdge,
	restoreTerminalWindow,
	setTerminalWindowMode,
	shouldTreatTerminalHandleTapAsDoubleTap,
	updateTerminalWindowRect,
	type RestorableTerminalWindowMode,
	type TerminalWindowRect,
	type TerminalWindowState,
} from "@/lib/navBrand/terminalWindow";
import {
	IDLE_DELAY_MS,
	RARE_MESSAGE_COOLDOWN_MS,
	SYSTEM_MESSAGE_COOLDOWN_MS,
	shouldShowRareMessage,
	shouldShowSystemMessage,
} from "@/lib/navBrand/state";
import { NAVBRAND_OPEN_TERMINAL_EVENT, type NavBrandTerminalOpenDetail } from "@/lib/navBrand/terminalEvents";
import {
	bindTerminalTextEffectTriggers,
	playTerminalTextEffect,
	readTerminalTextEffectConfig,
	resetTerminalTextEffect,
} from "@/lib/textEffects/terminalTextEffect";
import { disableMatchDeviceTheme, handleThemeToggle, setTheme, type Theme } from "@/scripts/themeManager";

type TerminalModalElements = {
	overlay: HTMLElement | null;
	windowEl: HTMLElement | null;
	dockChip: HTMLButtonElement | null;
	log: HTMLElement | null;
	status: HTMLElement | null;
	geometry: HTMLElement | null;
	presenceBadge: HTMLElement | null;
	presenceText: HTMLElement | null;
	presenceVisits: HTMLElement | null;
	atmosphere: HTMLElement | null;
	dragHandle: HTMLElement | null;
	closeButton: HTMLButtonElement | null;
	minimizeButton: HTMLButtonElement | null;
	maximizeButton: HTMLButtonElement | null;
	maximizeIcon: HTMLElement | null;
	form: HTMLFormElement | null;
	input: HTMLInputElement | null;
	mirror: HTMLElement | null;
	mirrorText: HTMLElement | null;
	resizeHandles: HTMLElement[];
};

type WindowAction = "close" | "minimize" | "maximize" | "restore";
type TerminalEntryKind = "prelude" | "system" | "command" | "output";
type TerminalTextEntry = {
	id: string;
	kind: TerminalEntryKind;
	text: string;
	effect?: "typing" | "decrypt";
};
type TerminalSystemArtEntry = {
	id: string;
	kind: "system-art";
	text: string;
	colorRole: TerminalSystemProfile["asciiLines"][number]["colorRole"];
};
type TerminalSystemMetaEntry = {
	id: string;
	kind: "system-meta";
	label: string;
	value: string;
	effect?: "typing" | "decrypt";
};
type TerminalEntry = TerminalTextEntry | TerminalSystemArtEntry | TerminalSystemMetaEntry;
type InteractionSession =
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
	  };

const MOBILE_QUERY = "(max-width: 768px)";
const WINDOW_MARGIN = 24;
const MOBILE_WINDOW_MARGIN = 12;
const MIN_WIDTH = 420;
const MIN_HEIGHT = 320;
const CLOSE_DISPATCH_DELAY_MS = 140;

let _abortController: AbortController | null = null;
let _open = false;
let _windowState: TerminalWindowState = createTerminalWindowState();
let _opener: HTMLElement | null = null;
let _interaction: InteractionSession | null = null;
let _lastOpenSource = "sidebar-expanded";
let _lastDragHandleTapTs: number | null = null;
let _entries: TerminalEntry[] = [];
const _commandHistory: string[] = [];
let _nextEntryId = 0;
let _terminalIdleTimer: number | null = null;
let _terminalIdleCount = 0;
let _terminalLastAtmosphere: string | null = null;
let _terminalLastSystemTs = 0;
let _terminalLastRareTs = 0;
const _sequenceTimers: number[] = [];

function getElements(): TerminalModalElements {
	return {
		overlay: document.getElementById("terminal-modal-overlay"),
		windowEl: document.getElementById("terminal-modal"),
		dockChip: document.getElementById("terminal-dock-chip") as HTMLButtonElement | null,
		log: document.getElementById("terminal-modal-log"),
		status: document.getElementById("terminal-modal-status"),
		geometry: document.getElementById("terminal-modal-geometry"),
		presenceBadge: document.getElementById("terminal-modal-presence-badge"),
		presenceText: document.getElementById("terminal-modal-presence-text"),
		presenceVisits: document.getElementById("terminal-modal-presence-visits"),
		atmosphere: document.getElementById("terminal-modal-atmosphere"),
		dragHandle: document.getElementById("terminal-modal-drag-handle"),
		closeButton: document.getElementById("terminal-close") as HTMLButtonElement | null,
		minimizeButton: document.getElementById("terminal-minimize") as HTMLButtonElement | null,
		maximizeButton: document.getElementById("terminal-maximize") as HTMLButtonElement | null,
		maximizeIcon: document.getElementById("terminal-maximize-icon"),
		form: document.getElementById("terminal-modal-form") as HTMLFormElement | null,
		input: document.getElementById("terminal-modal-input") as HTMLInputElement | null,
		mirror: document.getElementById("terminal-modal-mirror"),
		mirrorText: document.getElementById("terminal-modal-mirror-text"),
		resizeHandles: Array.from(document.querySelectorAll<HTMLElement>("[data-terminal-resize]")),
	};
}

function nextEntryId(): string {
	_nextEntryId += 1;
	return `terminal-entry-${_nextEntryId}`;
}

function isMobile(): boolean {
	return window.matchMedia(MOBILE_QUERY).matches;
}

function isReducedMotion(): boolean {
	return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getWindowMargin(): number {
	return isMobile() ? MOBILE_WINDOW_MARGIN : WINDOW_MARGIN;
}

function getViewportRect(): TerminalWindowRect {
	if (isMobile()) {
		return {
			x: MOBILE_WINDOW_MARGIN,
			y: MOBILE_WINDOW_MARGIN,
			width: Math.max(320, window.innerWidth - MOBILE_WINDOW_MARGIN * 2),
			height: Math.max(420, window.innerHeight - MOBILE_WINDOW_MARGIN * 2),
		};
	}

	const width = Math.min(window.innerWidth - WINDOW_MARGIN * 2, 940);
	const height = Math.min(window.innerHeight - WINDOW_MARGIN * 2, 640);
	return centerTerminalWindowRect(
		{ x: 0, y: 0, width, height },
		{ width: window.innerWidth, height: window.innerHeight },
		WINDOW_MARGIN
	);
}

function getFullscreenRect(): TerminalWindowRect {
	return {
		x: 0,
		y: 0,
		width: window.innerWidth,
		height: window.innerHeight,
	};
}

function clampRect(rect: TerminalWindowRect): TerminalWindowRect {
	const margin = getWindowMargin();
	const minWidth = Math.min(MIN_WIDTH, Math.max(320, window.innerWidth - margin * 2));
	const minHeight = Math.min(MIN_HEIGHT, Math.max(280, window.innerHeight - margin * 2));
	const width = Math.min(Math.max(rect.width, minWidth), window.innerWidth - margin * 2);
	const height = Math.min(Math.max(rect.height, minHeight), window.innerHeight - margin * 2);
	const x = Math.min(Math.max(rect.x, margin), Math.max(margin, window.innerWidth - width - margin));
	const y = Math.min(Math.max(rect.y, margin), Math.max(margin, window.innerHeight - height - margin));

	return { x, y, width, height };
}

function getCenteredPresetRect(
	mode: Extract<RestorableTerminalWindowMode, "windowed" | "expanded">
): TerminalWindowRect {
	return centerTerminalWindowRect(
		clampRect(getTerminalWindowPresetRect(mode)),
		{ width: window.innerWidth, height: window.innerHeight },
		WINDOW_MARGIN
	);
}

function getMaximizeControlMeta(mode: TerminalWindowState["mode"]): {
	label: string;
	title: string;
	iconClass: string;
} {
	if (isMobile()) {
		if (mode === "fullscreen") {
			return {
				label: "Exit fullscreen",
				title: "Exit fullscreen",
				iconClass: "icon-fullscreen-exit",
			};
		}

		return {
			label: "Enter fullscreen",
			title: "Enter fullscreen",
			iconClass: "icon-arrows-fullscreen",
		};
	}

	if (mode === "expanded") {
		return {
			label: "Enter fullscreen",
			title: "Enter fullscreen",
			iconClass: "icon-arrows-fullscreen",
		};
	}

	if (mode === "fullscreen") {
		return {
			label: "Exit fullscreen",
			title: "Exit fullscreen",
			iconClass: "icon-fullscreen-exit",
		};
	}

	return {
		label: "Expand terminal",
		title: "Expand terminal",
		iconClass: "icon-square",
	};
}

function setHidden(el: HTMLElement | null, hidden: boolean): void {
	if (!el) return;
	el.hidden = hidden;
}

function setDocumentScrollLock(locked: boolean): void {
	document.body.style.overflow = locked ? "hidden" : "";
}

function updateWindowFrame(elements: TerminalModalElements): void {
	if (!elements.windowEl) return;

	const rect = _windowState.rect;
	elements.windowEl.dataset.terminalMode = _windowState.mode;
	elements.windowEl.style.left = `${rect.x}px`;
	elements.windowEl.style.top = `${rect.y}px`;
	elements.windowEl.style.width = `${rect.width}px`;
	elements.windowEl.style.height = `${rect.height}px`;

	if (elements.geometry) {
		elements.geometry.textContent = `${Math.round(rect.width)}×${Math.round(rect.height)}`;
	}

	if (elements.maximizeButton) {
		const { label, title } = getMaximizeControlMeta(_windowState.mode);
		elements.maximizeButton.setAttribute("aria-label", label);
		elements.maximizeButton.setAttribute("title", title);
	}

	if (elements.maximizeIcon) {
		elements.maximizeIcon.className = getMaximizeControlMeta(_windowState.mode).iconClass;
	}
}

function setDockState(elements: TerminalModalElements): void {
	if (!elements.dockChip) return;

	const docked = !_open && _windowState.mode === "minimized";
	elements.dockChip.dataset.terminalDocked = docked ? "true" : "false";
	setHidden(elements.dockChip, !docked);
}

function setWindowVisibility(elements: TerminalModalElements): void {
	setHidden(elements.overlay, !_open);
	setHidden(elements.windowEl, !_open);
	setDocumentScrollLock(_open);
	setDockState(elements);
	updateWindowFrame(elements);
}

function syncPromptMirror(elements: TerminalModalElements): void {
	if (!elements.input || !elements.mirror || !elements.mirrorText) return;

	const value = elements.input.value;
	const placeholder = elements.input.getAttribute("placeholder") ?? "";
	elements.mirror.dataset.empty = value.length > 0 ? "false" : "true";
	elements.mirrorText.textContent = value.length > 0 ? value : placeholder;
}

function getVisitCount(): number {
	const visits = Number.parseInt(getPref(PREF_KEYS.navBrandVisits) ?? "0", 10);
	return Number.isFinite(visits) && visits >= 0 ? visits : 0;
}

function getLastVisitTimestamp(): number | null {
	const raw = Number.parseInt(getPref(PREF_KEYS.navBrandLastVisit) ?? "0", 10);
	return Number.isFinite(raw) && raw > 0 ? raw : null;
}

function updateTerminalPresence(elements: TerminalModalElements): void {
	const presence = getTerminalPresenceSummary({
		visits: getVisitCount(),
		lastVisitTs: getLastVisitTimestamp(),
		now: Date.now(),
	});

	if (elements.presenceBadge) {
		elements.presenceBadge.textContent = presence.lastSeenBadge;
	}

	if (elements.presenceText) {
		elements.presenceText.textContent = presence.lastSeenText;
	}

	if (elements.presenceVisits) {
		elements.presenceVisits.textContent = String(presence.visits);
	}
}

function clearTerminalIdleTimer(): void {
	if (_terminalIdleTimer !== null) {
		window.clearTimeout(_terminalIdleTimer);
		_terminalIdleTimer = null;
	}
}

function clearSequenceTimers(): void {
	while (_sequenceTimers.length > 0) {
		const timer = _sequenceTimers.pop();
		if (timer !== undefined) {
			window.clearTimeout(timer);
		}
	}
}

function getCurrentAtmosphereText(el: HTMLElement | null): string {
	if (!el) return "";
	return el.dataset.greetingTarget ?? el.textContent?.trim() ?? "";
}

function resolveTerminalAtmosphere(reason: TerminalAtmosphereReason): string {
	const now = Date.now();
	const visits = Math.max(getVisitCount(), 1);
	const rareEligible =
		reason === "random-time" &&
		shouldShowRareMessage({
			now,
			lastRareTs: _terminalLastRareTs,
			randomValue: Math.random(),
			cooldownMs: RARE_MESSAGE_COOLDOWN_MS,
		});
	const systemEligible =
		reason === "random-time" &&
		!rareEligible &&
		shouldShowSystemMessage({
			now,
			lastSystemTs: _terminalLastSystemTs,
			randomValue: Math.random(),
			cooldownMs: SYSTEM_MESSAGE_COOLDOWN_MS,
		});

	const selection = selectTerminalAtmosphereMessage({
		reason,
		hour: new Date(now).getHours(),
		visits,
		idleCount: _terminalIdleCount,
		lastMessage: _terminalLastAtmosphere,
		systemEligible,
		rareEligible,
		random: Math.random,
	});

	if (selection.category === "system") {
		_terminalLastSystemTs = now;
	}

	if (selection.category === "rare") {
		_terminalLastRareTs = now;
	}

	_terminalLastAtmosphere = selection.message;
	return selection.message;
}

function renderTerminalAtmosphere(reason: TerminalAtmosphereReason): void {
	const elements = getElements();
	if (!elements.atmosphere) return;

	const text = resolveTerminalAtmosphere(reason);
	playTerminalTextEffect({
		el: elements.atmosphere,
		effect: Math.random() < 0.32 ? "decrypt" : "typing",
		text,
	});
}

function scheduleTerminalIdleAtmosphere(): void {
	clearTerminalIdleTimer();
	if (!_open) return;

	_terminalIdleTimer = window.setTimeout(() => {
		if (!_open) return;
		renderTerminalAtmosphere("idle");
		_terminalIdleCount += 1;
	}, IDLE_DELAY_MS);
}

function noteTerminalActivity(): void {
	if (!_open) return;
	scheduleTerminalIdleAtmosphere();
}

function appendEntries(...entries: TerminalEntry[]): void {
	_entries.push(...entries);
}

function clearVisibleHistory(elements: TerminalModalElements, statusText = "history cleared"): void {
	_entries = [];
	if (elements.log) {
		elements.log.innerHTML = "";
	}
	if (elements.status) {
		elements.status.textContent = statusText;
	}
}

function resetTerminalSession(elements: TerminalModalElements): void {
	_entries = [];
	_commandHistory.length = 0;
	_nextEntryId = 0;
	_windowState = createTerminalWindowState();
	_lastDragHandleTapTs = null;
	_interaction = null;
	clearTerminalIdleTimer();
	_terminalIdleCount = 0;
	_terminalLastAtmosphere = null;
	_terminalLastSystemTs = 0;
	_terminalLastRareTs = 0;

	if (elements.log) {
		elements.log.innerHTML = "";
	}

	if (elements.input) {
		elements.input.value = "";
	}

	if (elements.status) {
		elements.status.textContent = "incoming transmission";
	}

	if (elements.atmosphere) {
		resetTerminalTextEffect(elements.atmosphere);
		elements.atmosphere.textContent = "restoring context";
		delete elements.atmosphere.dataset.greetingTarget;
	}

	syncPromptMirror(elements);
	updateTerminalPresence(elements);
}

function getTerminalSystemSnapshot() {
	return {
		platform:
			(navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ??
			(navigator.userAgent.includes("Macintosh")
				? "macOS"
				: navigator.userAgent.includes("Windows NT")
					? "Windows"
					: navigator.userAgent.includes("Android")
						? "Android"
						: navigator.userAgent.includes("iPhone") ||
							  navigator.userAgent.includes("iPad") ||
							  navigator.userAgent.includes("iPod")
							? "iOS"
							: navigator.userAgent.includes("Linux")
								? "Linux"
								: "Unknown"),
		theme: document.documentElement.getAttribute("data-theme") ?? "unknown",
		flavor: document.documentElement.getAttribute("data-flavor") ?? "default warm void",
		language: navigator.language ?? "unknown",
		network: navigator.onLine ? "online" : "offline",
		timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? "unknown",
		viewport: `${window.innerWidth}×${window.innerHeight}`,
		route: window.location.pathname || "/",
		cpuThreads: navigator.hardwareConcurrency ?? null,
		deviceMemoryGiB:
			"deviceMemory" in navigator ? ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? null) : null,
		touchPoints: typeof navigator.maxTouchPoints === "number" ? navigator.maxTouchPoints : null,
		reducedMotion: isReducedMotion(),
	};
}

function createSystemProfileEntries(
	profile: TerminalSystemProfile,
	options: { randomizeMetaEffects?: boolean } = {}
): TerminalEntry[] {
	const { randomizeMetaEffects = false } = options;
	const artEntries: TerminalEntry[] = profile.asciiLines.map((line) => ({
		id: nextEntryId(),
		kind: "system-art",
		text: line.text,
		colorRole: line.colorRole,
	}));
	const metaEntries: TerminalEntry[] = profile.rows.map((row) => ({
		id: nextEntryId(),
		kind: "system-meta",
		label: row.label,
		value: row.value,
		effect: randomizeMetaEffects ? (Math.random() < 0.5 ? "decrypt" : "typing") : undefined,
	}));

	return [...artEntries, ...metaEntries];
}

function createEntryElement(entry: TerminalEntry): HTMLElement {
	if (entry.kind === "system-art") {
		const line = document.createElement("pre");
		line.className = `terminal-window__system-art terminal-window__system-art-line terminal-window__system-art-line--${entry.colorRole}`;
		line.dataset.entryId = entry.id;
		line.textContent = entry.text;
		return line;
	}

	if (entry.kind === "system-meta") {
		const line = document.createElement("p");
		line.className = "terminal-window__system-row";
		line.dataset.entryId = entry.id;

		const label = document.createElement("span");
		label.className = "terminal-window__system-label";
		label.textContent = `${entry.label}:`;

		const value = document.createElement("span");
		value.className = "terminal-window__system-value";
		value.dataset.terminalEntryText = "";
		value.textContent = entry.value;

		line.append(label, value);
		return line;
	}

	const row = document.createElement("p");
	const className =
		entry.kind === "command"
			? "terminal-window__entry terminal-window__entry--command"
			: entry.kind === "system"
				? "terminal-window__entry terminal-window__entry--system"
				: entry.kind === "prelude"
					? "terminal-window__prelude-line"
					: "terminal-window__entry terminal-window__entry--output";
	row.className = className;
	row.dataset.entryId = entry.id;

	const text = document.createElement("span");
	text.className = "terminal-window__entry-text terminal-window__prelude-text";
	text.dataset.terminalEntryText = "";
	text.textContent = entry.text;
	row.append(text);

	return row;
}

function renderLog(elements: TerminalModalElements, animateFromId?: string): void {
	if (!elements.log) return;

	for (const el of elements.log.querySelectorAll<HTMLElement>("[data-terminal-entry-text]")) {
		resetTerminalTextEffect(el);
	}

	elements.log.innerHTML = "";
	for (const entry of _entries) {
		elements.log.append(createEntryElement(entry));
	}

	if (!isReducedMotion()) {
		const startIndex = animateFromId ? _entries.findIndex((entry) => entry.id === animateFromId) : -1;
		if (startIndex > -1) {
			const targets = Array.from(elements.log.querySelectorAll<HTMLElement>("[data-terminal-entry-text]")).slice(
				startIndex
			);
			targets.forEach((target, index) => {
				const entry = _entries[startIndex + index];
				const effect = entry && "effect" in entry ? (entry.effect ?? null) : null;
				if (!effect) return;

				window.setTimeout(() => {
					playTerminalTextEffect({
						el: target,
						effect,
						text: target.textContent ?? "",
					});
				}, index * 85);
			});
		}
	}

	elements.log.scrollTop = elements.log.scrollHeight;
}

function appendRenderedEntry(elements: TerminalModalElements, entry: TerminalEntry): void {
	if (!elements.log) return;

	const node = createEntryElement(entry);
	elements.log.append(node);

	if (!isReducedMotion()) {
		const target = node.querySelector<HTMLElement>("[data-terminal-entry-text]");
		const effect = "effect" in entry ? (entry.effect ?? null) : null;
		if (target && effect) {
			playTerminalTextEffect({
				el: target,
				effect,
				text: target.textContent ?? "",
			});
		}
	}

	elements.log.scrollTop = elements.log.scrollHeight;
}

function queueEntrySequence(elements: TerminalModalElements, entries: TerminalEntry[]): void {
	clearSequenceTimers();

	let delay = 0;
	for (const entry of entries) {
		const timer = window.setTimeout(() => {
			appendRenderedEntry(elements, entry);
		}, delay);
		_sequenceTimers.push(timer);

		if (entry.kind === "prelude") {
			delay += 460;
		} else if (entry.kind === "system-art") {
			delay += 90;
		} else if (entry.kind === "system-meta") {
			delay += 165;
		} else {
			delay += 110;
		}
	}
}

function ensurePrelude(elements: TerminalModalElements): void {
	if (_entries.length > 0) return;

	const prelude = buildTerminalPrelude();
	const profile = buildTerminalSystemProfile(getTerminalSystemSnapshot());

	const newEntries: TerminalEntry[] = prelude.lines.map((line, index) => ({
		id: nextEntryId(),
		kind: "prelude",
		text: line,
		effect: index % 2 === 0 ? "decrypt" : "typing",
	}));
	newEntries.push(...createSystemProfileEntries(profile, { randomizeMetaEffects: true }));

	appendEntries(...newEntries);
	if (elements.log) {
		elements.log.innerHTML = "";
	}
	queueEntrySequence(elements, newEntries);
}

function focusInput(elements: TerminalModalElements): void {
	syncPromptMirror(elements);
	elements.input?.focus();
}

function openTerminal(detail?: NavBrandTerminalOpenDetail): void {
	const elements = getElements();
	if (!elements.windowEl) return;
	const hadTerminalSession = _entries.length > 0;

	_lastOpenSource = detail?.source ?? _lastOpenSource;

	if (_windowState.mode === "minimized") {
		_windowState = restoreTerminalWindow(_windowState);
	} else if (!_open && isMobile()) {
		_windowState = updateTerminalWindowRect(_windowState, getViewportRect());
	} else if (!_open) {
		const clampedRect = _windowState.mode === "fullscreen" ? getViewportRect() : clampRect(_windowState.rect);
		const centeredRect =
			_entries.length === 0
				? centerTerminalWindowRect(clampedRect, { width: window.innerWidth, height: window.innerHeight }, WINDOW_MARGIN)
				: clampedRect;
		_windowState = updateTerminalWindowRect(_windowState, centeredRect);
	}

	_open = true;
	setWindowVisibility(elements);
	updateTerminalPresence(elements);
	ensurePrelude(elements);
	renderTerminalAtmosphere(hadTerminalSession ? "resume" : "load");
	scheduleTerminalIdleAtmosphere();
	if (elements.status) {
		elements.status.textContent =
			_lastOpenSource === "sidebar-expanded" ? "restoring context" : `signal received · ${_lastOpenSource}`;
	}
	focusInput(elements);
}

function destroyTerminal(): void {
	const elements = getElements();
	resetTerminalSession(elements);
	_open = false;
	setWindowVisibility(elements);
	_opener?.focus();
	_opener = null;
}

function minimizeTerminal(): void {
	const elements = getElements();
	_open = false;
	clearTerminalIdleTimer();
	_windowState = minimizeTerminalWindow(_windowState);
	setWindowVisibility(elements);
}

function maximizeOrRestoreTerminal(): void {
	const elements = getElements();
	const mobile = isMobile();
	const currentMode: RestorableTerminalWindowMode =
		_windowState.mode === "minimized" ? (_windowState.restoreMode ?? "windowed") : _windowState.mode;
	const nextMode = mobile
		? getNextTerminalWindowModeForViewport(currentMode, true)
		: getNextTerminalWindowMode(currentMode);
	const nextRect =
		nextMode === "fullscreen" ? getFullscreenRect() : mobile ? getViewportRect() : getCenteredPresetRect(nextMode);

	_windowState = updateTerminalWindowRect(setTerminalWindowMode(_windowState, nextMode), nextRect);
	_windowState.restoreRect = null;
	_windowState.restoreMode = null;

	setWindowVisibility(elements);
}

function exitFullscreenToWindowed(): void {
	if (_windowState.mode !== "fullscreen") return;
	const elements = getElements();
	_windowState = updateTerminalWindowRect(
		setTerminalWindowMode(_windowState, "windowed"),
		isMobile() ? getViewportRect() : getCenteredPresetRect("windowed")
	);
	_windowState.restoreRect = null;
	_windowState.restoreMode = null;
	setWindowVisibility(elements);
}

function resetMobileTerminalToViewport(): void {
	if (!isMobile()) return;
	const elements = getElements();
	_windowState = updateTerminalWindowRect(setTerminalWindowMode(_windowState, "windowed"), getViewportRect());
	_windowState.restoreRect = null;
	_windowState.restoreMode = null;
	setWindowVisibility(elements);
}

function restoreFromDock(): void {
	openTerminal();
}

function beginDrag(event: PointerEvent, elements: TerminalModalElements): void {
	if (!elements.windowEl || _windowState.mode === "minimized" || _windowState.mode === "fullscreen" || isMobile())
		return;
	if (!(event.target instanceof HTMLElement)) return;
	if (event.target.closest("[data-terminal-control]")) return;
	if (event.target.closest("#terminal-modal-form")) return;

	_interaction = {
		kind: "drag",
		pointerId: event.pointerId,
		startX: event.clientX,
		startY: event.clientY,
		startRect: _windowState.rect,
	};
	elements.dragHandle?.setPointerCapture(event.pointerId);
}

function beginResize(event: PointerEvent, edge: string): void {
	if (_windowState.mode === "minimized" || _windowState.mode === "fullscreen") return;
	if (isMobile() && edge !== "n") return;

	_interaction = {
		kind: "resize",
		edge,
		pointerId: event.pointerId,
		startX: event.clientX,
		startY: event.clientY,
		startRect: _windowState.rect,
	};

	(event.currentTarget as HTMLElement | null)?.setPointerCapture(event.pointerId);
}

function updateDrag(event: PointerEvent): void {
	if (!_interaction || _interaction.kind !== "drag") return;
	const deltaX = event.clientX - _interaction.startX;
	const deltaY = event.clientY - _interaction.startY;
	const nextRect = clampRect({
		..._interaction.startRect,
		x: _interaction.startRect.x + deltaX,
		y: _interaction.startRect.y + deltaY,
	});

	_windowState = updateTerminalWindowRect(_windowState, nextRect);
	updateWindowFrame(getElements());
}

function updateResize(event: PointerEvent): void {
	if (!_interaction || _interaction.kind !== "resize") return;
	const deltaX = event.clientX - _interaction.startX;
	const deltaY = event.clientY - _interaction.startY;
	_windowState = updateTerminalWindowRect(
		_windowState,
		clampRect(resizeTerminalWindowRectFromEdge(_interaction.edge, _interaction.startRect, deltaX, deltaY))
	);
	updateWindowFrame(getElements());
}

function endInteraction(): void {
	_interaction = null;
}

function focusSearchInput(): boolean {
	const selectors = [
		'#floating-searchbox input[type="text"]',
		"#page-searchbox input[type='text']",
		".pagefind-ui__search-input",
	];
	for (const selector of selectors) {
		const input = document.querySelector(selector) as HTMLInputElement | null;
		if (input) {
			input.focus();
			return true;
		}
	}

	return false;
}

function openSearchSurface(query?: string): void {
	if (query && query.trim()) {
		const encodedQuery = encodeURIComponent(query.trim());
		const searchPath = `/search?q=${encodedQuery}`;
		if (window.location.pathname === "/search") {
			const searchInput = document.querySelector(".pagefind-ui__search-input") as HTMLInputElement | null;
			if (searchInput) {
				searchInput.value = query.trim();
				searchInput.dispatchEvent(new Event("input", { bubbles: true }));
				searchInput.focus();
				window.history.replaceState({}, "", searchPath);
				return;
			}
		}

		window.location.assign(searchPath);
		return;
	}

	const floatingModal = document.getElementById("floating-search-modal");
	if (floatingModal && !floatingModal.classList.contains("pointer-events-none")) {
		focusSearchInput();
		return;
	}

	const floatingSearchButton = document.getElementById("open-floating-search") as HTMLButtonElement | null;
	if (floatingSearchButton) {
		floatingSearchButton.click();
		window.setTimeout(() => {
			focusSearchInput();
		}, 60);
		return;
	}

	if (focusSearchInput()) return;
	if (window.location.pathname !== "/search") {
		window.location.assign("/search");
	}
}

function applyToggleIntent(target: string, value: string | boolean): void {
	if (target === "theme") {
		if (value === "toggle") {
			handleThemeToggle();
			return;
		}

		disableMatchDeviceTheme();
		setTheme(value as Theme);
		return;
	}

	if (target === "sidebar-collapse") {
		const collapseTab = document.getElementById("sidebar-collapse-tab") as HTMLButtonElement | null;
		if (!collapseTab) return;

		const isCollapsed = document.documentElement.hasAttribute("data-sidebar-collapsed");
		const shouldCollapse = value === "collapse";
		if (isCollapsed !== shouldCollapse) {
			collapseTab.click();
		}
		return;
	}

	const toggle = document.getElementById(target) as HTMLInputElement | null;
	if (!toggle) return;
	if (toggle.checked !== value) {
		toggle.click();
	}
}

function buildMessageOutput(
	commandId: NavBrandCommandId,
	intent: Extract<NavBrandCommandIntent, { type: "message" }>
): string {
	if (commandId === "help") {
		return "try: neofetch · search astro · blog · projects · theme dark · clear · history";
	}

	if (commandId === "status") {
		return "presence engine online · local horizon stable";
	}

	return intent.message;
}

function appendCommandAndOutput(
	elements: TerminalModalElements,
	commandText: string,
	output: string,
	kind: Extract<TerminalEntryKind, "output" | "system"> = "output"
): void {
	const commandEntry: TerminalEntry = {
		id: nextEntryId(),
		kind: "command",
		text: commandText,
	};
	const outputEntry: TerminalEntry = {
		id: nextEntryId(),
		kind,
		text: output,
		effect: kind === "system" ? "typing" : undefined,
	};

	appendEntries(commandEntry, outputEntry);
	renderLog(elements, commandEntry.id);
}

function appendCommandAndSystemProfile(elements: TerminalModalElements, commandText: string): void {
	const commandEntry: TerminalEntry = {
		id: nextEntryId(),
		kind: "command",
		text: commandText,
	};
	const profileEntries = createSystemProfileEntries(buildTerminalSystemProfile(getTerminalSystemSnapshot()), {
		randomizeMetaEffects: true,
	});

	appendEntries(commandEntry, ...profileEntries);
	appendRenderedEntry(elements, commandEntry);
	queueEntrySequence(elements, profileEntries);
}

function closeAfterDispatch(callback: () => void, statusText: string): void {
	const elements = getElements();
	if (elements.status) {
		elements.status.textContent = statusText;
	}
	window.setTimeout(() => {
		destroyTerminal();
		callback();
	}, CLOSE_DISPATCH_DELAY_MS);
}

function executeResolvedCommand(
	elements: TerminalModalElements,
	rawInput: string,
	resolved: ResolvedNavBrandCommand
): void {
	const intent = buildNavBrandCommandIntent(resolved);
	if (!intent) {
		appendCommandAndOutput(elements, rawInput, "unknown command · try: help", "system");
		return;
	}

	if (intent.type === "clear-history") {
		clearVisibleHistory(elements);
		return;
	}

	if (intent.type === "show-history") {
		const historyText =
			_commandHistory.length > 0
				? _commandHistory.map((command, index) => `${index + 1}. ${command}`).join("\n")
				: "no commands in session memory yet";
		appendCommandAndOutput(elements, rawInput, historyText, "system");
		return;
	}

	if (intent.type === "show-system-profile") {
		appendCommandAndSystemProfile(elements, rawInput);
		return;
	}

	if (intent.type === "message") {
		appendCommandAndOutput(elements, rawInput, buildMessageOutput(resolved.command.id, intent), "system");
		return;
	}

	if (intent.type === "toggle-pref") {
		applyToggleIntent(intent.target, intent.value);
		appendCommandAndOutput(elements, rawInput, `applied ${rawInput}`, "system");
		return;
	}

	if (intent.type === "external-link") {
		appendCommandAndOutput(elements, rawInput, `opening ${intent.href}`, "system");
		closeAfterDispatch(() => window.location.assign(intent.href), "dispatching external link");
		return;
	}

	if (intent.type === "navigate") {
		appendCommandAndOutput(elements, rawInput, `navigating to ${intent.href}`, "system");
		closeAfterDispatch(() => window.location.assign(intent.href), "routing to destination");
		return;
	}

	appendCommandAndOutput(
		elements,
		rawInput,
		intent.query ? `searching for ${intent.query}` : "opening search surface",
		"system"
	);
	closeAfterDispatch(() => openSearchSurface(intent.query ?? undefined), "handing off to search");
}

function submitCommand(rawInput: string): void {
	const elements = getElements();
	const normalizedInput = rawInput.trim();
	if (!normalizedInput) return;

	_commandHistory.push(normalizedInput);
	const resolved = resolveNavBrandCommandInput(normalizedInput);
	if (!resolved) {
		appendCommandAndOutput(elements, normalizedInput, "unknown command · try: help", "system");
		return;
	}

	executeResolvedCommand(elements, normalizedInput, resolved);
}

function onWindowAction(action: WindowAction): void {
	if (action === "close") {
		destroyTerminal();
		return;
	}

	if (action === "minimize") {
		minimizeTerminal();
		return;
	}

	if (action === "maximize") {
		maximizeOrRestoreTerminal();
		return;
	}

	restoreFromDock();
}

function bindTerminalAtmosphereEffects(elements: TerminalModalElements): void {
	if (!elements.atmosphere) return;

	const config = readTerminalTextEffectConfig(elements.atmosphere);
	if (!config) return;

	bindTerminalTextEffectTriggers({
		el: elements.atmosphere,
		effects: config.effects,
		triggers: config.triggers,
		randomIntervalMs: config.randomIntervalMs,
		getText: (el, trigger) => {
			const current = getCurrentAtmosphereText(el);
			if (!_open && trigger !== "load" && trigger !== "route-enter") {
				return current;
			}

			switch (trigger) {
				case "load":
				case "route-enter":
				case "resume":
				case "idle-return":
				case "random-time":
					return resolveTerminalAtmosphere(trigger as TerminalAtmosphereReason);
				default:
					return current;
			}
		},
	});
}

function initTerminalModal(): void {
	_abortController?.abort();
	_abortController = new AbortController();
	const { signal } = _abortController;

	const elements = getElements();
	if (
		!elements.windowEl ||
		!elements.overlay ||
		!elements.dockChip ||
		!elements.dragHandle ||
		!elements.form ||
		!elements.input
	)
		return;

	setWindowVisibility(elements);
	syncPromptMirror(elements);
	renderLog(elements);
	bindTerminalAtmosphereEffects(elements);

	document.addEventListener(
		NAVBRAND_OPEN_TERMINAL_EVENT,
		(event) => {
			_opener = document.activeElement as HTMLElement | null;
			openTerminal(event.detail);
		},
		{ signal }
	);

	elements.overlay.addEventListener("click", () => minimizeTerminal(), { signal });
	elements.closeButton?.addEventListener("click", () => onWindowAction("close"), { signal });
	elements.minimizeButton?.addEventListener("click", () => onWindowAction("minimize"), { signal });
	elements.maximizeButton?.addEventListener("click", () => onWindowAction("maximize"), { signal });
	elements.dockChip.addEventListener("click", () => onWindowAction("restore"), { signal });
	elements.dragHandle.addEventListener(
		"dblclick",
		() => {
			if (_windowState.mode === "fullscreen") {
				exitFullscreenToWindowed();
			}
		},
		{ signal }
	);
	elements.dragHandle.addEventListener(
		"pointerup",
		(event) => {
			if (!isMobile() || event.pointerType !== "touch") return;
			if (!(event.target instanceof HTMLElement)) return;
			if (event.target.closest("[data-terminal-control]")) return;
			if (_interaction) return;

			const now = Date.now();
			if (shouldTreatTerminalHandleTapAsDoubleTap(_lastDragHandleTapTs, now)) {
				_lastDragHandleTapTs = null;
				resetMobileTerminalToViewport();
				return;
			}

			_lastDragHandleTapTs = now;
		},
		{ signal }
	);

	elements.form.addEventListener(
		"submit",
		(event) => {
			event.preventDefault();
			submitCommand(elements.input?.value ?? "");
			noteTerminalActivity();
			if (elements.input) {
				elements.input.value = "";
				syncPromptMirror(elements);
				elements.input.focus();
			}
		},
		{ signal }
	);

	elements.input.addEventListener(
		"input",
		() => {
			syncPromptMirror(elements);
			noteTerminalActivity();
		},
		{ signal }
	);

	elements.input.addEventListener(
		"keydown",
		(event) => {
			noteTerminalActivity();
			const isCtrlOrCmd = event.ctrlKey || event.metaKey;
			if (isCtrlOrCmd && event.key.toLowerCase() === "k") {
				event.preventDefault();
				event.stopPropagation();
				clearVisibleHistory(getElements());
			}

			if (event.key === "Escape") {
				event.preventDefault();
				if (_windowState.mode === "fullscreen") {
					exitFullscreenToWindowed();
					return;
				}
				minimizeTerminal();
			}
		},
		{ signal }
	);

	elements.dragHandle.addEventListener("pointerdown", (event) => beginDrag(event, elements), { signal });
	elements.windowEl.addEventListener("pointerdown", () => noteTerminalActivity(), { signal });
	for (const handle of elements.resizeHandles) {
		const edge = handle.dataset.terminalResize;
		if (!edge) continue;
		handle.addEventListener("pointerdown", (event) => beginResize(event, edge), { signal });
	}

	document.addEventListener(
		"pointermove",
		(event) => {
			if (!_interaction) return;
			if (_interaction.kind === "drag") {
				updateDrag(event);
				return;
			}

			updateResize(event);
		},
		{ signal }
	);

	document.addEventListener("pointerup", endInteraction, { signal });
	window.addEventListener(
		"resize",
		() => {
			if (_windowState.mode === "fullscreen") {
				_windowState = updateTerminalWindowRect(_windowState, getFullscreenRect());
			} else if (isMobile()) {
				_windowState = updateTerminalWindowRect(_windowState, getViewportRect());
			} else {
				_windowState = updateTerminalWindowRect(_windowState, clampRect(_windowState.rect));
			}

			setWindowVisibility(getElements());
		},
		{ signal }
	);

	document.addEventListener(
		"keydown",
		(event) => {
			if (!_open) return;
			if (event.key === "Escape") {
				event.preventDefault();
				if (_windowState.mode === "fullscreen") {
					exitFullscreenToWindowed();
					return;
				}
				minimizeTerminal();
			}
		},
		{ signal }
	);
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", initTerminalModal, { once: true });
} else {
	initTerminalModal();
}

document.addEventListener("astro:page-load", initTerminalModal);
