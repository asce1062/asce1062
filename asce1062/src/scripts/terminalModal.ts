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
	buildNavBrandHelpMessage,
	buildNavBrandHistoryMessage,
	buildNavBrandIdentityMessage,
	buildNavBrandRouteListMessage,
	buildNavBrandStatusMessage,
	buildNavBrandUnknownCommandMessage,
	resolveNavBrandCommandCompletions,
	resolveNavBrandCommandSuggestion,
	resolveNavBrandCommandInput,
	type NavBrandCommandCompletion,
	type NavBrandCommandIntent,
	type ResolvedNavBrandCommand,
} from "@/lib/navBrand/commands";
import { buildTerminalPromptMirrorParts } from "@/lib/navBrand/promptMirror";
import { isFlavor, setFlavor } from "@/scripts/flavorManager";
import {
	getTerminalPresenceSummary,
	selectTerminalAtmosphereMessage,
	type TerminalAtmosphereReason,
} from "@/lib/navBrand/messages";
import {
	createTerminalHistoryNavigationSession,
	navigateTerminalHistory,
	resetTerminalHistoryNavigationSession,
	type TerminalHistoryNavigationSession,
} from "@/lib/navBrand/historyNavigation";
import { buildTerminalPrelude } from "@/lib/navBrand/terminalPrelude";
import { buildTerminalSystemProfile, type TerminalSystemProfile } from "@/lib/navBrand/terminalSystemProfile";
import {
	shouldFocusTerminalInput,
	shouldPreserveTerminalOutputSelection,
	shouldRouteTerminalKeyboardToInput,
	type TerminalFocusReason,
	type TerminalFocusTargetRole,
} from "@/lib/navBrand/terminalFocus";
import { writeTextToClipboard } from "@/scripts/copyToClipboard";
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
	completions: HTMLElement | null;
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
type TerminalSystemFontEntry = {
	id: string;
	kind: "system-font";
	font: string;
	colorRole: TerminalSystemProfile["asciiLines"][number]["colorRole"];
};
type TerminalSystemMetaEntry = {
	id: string;
	kind: "system-meta";
	label: string;
	value: string;
	effect?: "typing" | "decrypt";
};
type TerminalViewportClearEntry = {
	id: string;
	kind: "viewport-clear";
	height: number;
};
type TerminalEntry =
	| TerminalTextEntry
	| TerminalSystemFontEntry
	| TerminalSystemArtEntry
	| TerminalSystemMetaEntry
	| TerminalViewportClearEntry;
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
let _completionInput = "";
let _completionItems: NavBrandCommandCompletion[] = [];
let _completionIndex = 0;
let _historyNavigationSession: TerminalHistoryNavigationSession = createTerminalHistoryNavigationSession();

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
		completions: document.getElementById("terminal-modal-completions"),
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

function setCompletionMenuHidden(menu: HTMLElement | null, hidden: boolean): void {
	if (!menu) return;
	menu.hidden = hidden;
	menu.setAttribute("aria-hidden", hidden ? "true" : "false");
}

function ensureCompletionMenu(elements: TerminalModalElements): HTMLElement | null {
	if (elements.completions) return elements.completions;
	const prompt = elements.mirror?.closest(".terminal-window__prompt");
	if (!prompt) return null;

	const menu = document.createElement("div");
	menu.id = "terminal-modal-completions";
	menu.className = "terminal-window__completions";
	menu.setAttribute("role", "listbox");
	menu.setAttribute("aria-label", "Command completions");
	setCompletionMenuHidden(menu, true);
	prompt.append(menu);
	elements.completions = menu;
	return menu;
}

function closeCompletionMenu(elements: TerminalModalElements): void {
	_completionInput = "";
	_completionItems = [];
	_completionIndex = 0;
	setCompletionMenuHidden(elements.completions, true);
	if (elements.completions) {
		elements.completions.innerHTML = "";
	}
}

function resetHistoryNavigation(): void {
	_historyNavigationSession = resetTerminalHistoryNavigationSession();
}

function renderCompletionMenu(elements: TerminalModalElements): void {
	const menu = ensureCompletionMenu(elements);
	if (!menu || _completionItems.length === 0) {
		closeCompletionMenu(elements);
		return;
	}

	menu.innerHTML = "";
	_completionItems.forEach((item, index) => {
		const option = document.createElement("button");
		option.type = "button";
		option.className = "terminal-window__completion";
		option.dataset.completionIndex = String(index);
		option.setAttribute("role", "option");
		option.setAttribute("aria-selected", index === _completionIndex ? "true" : "false");
		option.textContent = item.value;
		option.addEventListener("pointerdown", (event) => {
			event.preventDefault();
			acceptCompletion(elements, index);
		});
		option.addEventListener("click", (event) => {
			event.preventDefault();
			acceptCompletion(elements, index);
		});
		menu.append(option);
	});

	setCompletionMenuHidden(menu, false);
	menu.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({
		block: "nearest",
		inline: "nearest",
	});
}

function openOrCycleCompletionMenu(elements: TerminalModalElements): void {
	if (!elements.input) return;
	const value = elements.input.value;
	const result = resolveNavBrandCommandCompletions(value);
	if (result.items.length === 0) {
		closeCompletionMenu(elements);
		return;
	}

	if (_completionInput === value && _completionItems.length > 0) {
		_completionIndex = (_completionIndex + 1) % _completionItems.length;
	} else {
		_completionInput = value;
		_completionItems = result.items;
		_completionIndex = 0;
	}

	renderCompletionMenu(elements);
}

function acceptCompletion(elements: TerminalModalElements, index = _completionIndex): boolean {
	if (!elements.input || _completionItems.length === 0) return false;
	const item = _completionItems[index] ?? _completionItems[0];
	if (!item) return false;

	elements.input.value = item.value;
	elements.input.setSelectionRange(elements.input.value.length, elements.input.value.length);
	resetHistoryNavigation();
	closeCompletionMenu(elements);
	syncPromptMirror(elements);
	requestTerminalInputFocus(elements, "completion", "input");
	return true;
}

function acceptInlineSuggestion(elements: TerminalModalElements): boolean {
	if (!elements.input) return false;
	const suggestion = resolveNavBrandCommandSuggestion(elements.input.value);
	if (!suggestion.completion) return false;

	elements.input.value = `${elements.input.value}${suggestion.completion}`;
	elements.input.setSelectionRange(elements.input.value.length, elements.input.value.length);
	resetHistoryNavigation();
	closeCompletionMenu(elements);
	syncPromptMirror(elements);
	return true;
}

function navigateInputHistory(elements: TerminalModalElements, direction: "previous" | "next"): boolean {
	if (!elements.input) return false;

	const result = navigateTerminalHistory({
		direction,
		history: _commandHistory,
		input: elements.input.value,
		session: _historyNavigationSession,
	});

	_historyNavigationSession = result.session;
	if (result.value === elements.input.value) return false;

	elements.input.value = result.value;
	elements.input.setSelectionRange(result.value.length, result.value.length);
	closeCompletionMenu(elements);
	syncPromptMirror(elements);
	return true;
}

function schedulePromptMirrorSync(elements: TerminalModalElements): void {
	window.requestAnimationFrame(() => syncPromptMirror(elements));
}

function syncPromptMirror(elements: TerminalModalElements): void {
	if (!elements.input || !elements.mirror || !elements.mirrorText) return;

	const value = elements.input.value;
	const placeholder = elements.input.getAttribute("placeholder") ?? "";
	elements.mirror.dataset.empty = value.length > 0 ? "false" : "true";
	elements.mirror.dataset.hasSuggestion = "false";
	elements.mirrorText.textContent = "";

	if (value.length === 0) {
		elements.mirror.dataset.commandState = "empty";
		elements.mirrorText.textContent = placeholder;
		return;
	}

	const suggestion = resolveNavBrandCommandSuggestion(value);
	elements.mirror.dataset.commandState = suggestion.state;

	const parts = buildTerminalPromptMirrorParts(value, elements.input.selectionStart, suggestion.completion);

	if (parts.beforeCaret) {
		const beforeCaret = document.createElement("span");
		beforeCaret.className = "terminal-window__mirror-typed";
		beforeCaret.textContent = parts.beforeCaret;
		elements.mirrorText.append(beforeCaret);
	}

	const cursorChar = document.createElement("span");
	cursorChar.className = "blink terminal-window__mirror-completion-cursor";
	cursorChar.textContent = parts.cursorChar;
	elements.mirrorText.append(cursorChar);

	if (parts.afterCaret) {
		const afterCaret = document.createElement("span");
		afterCaret.className = "terminal-window__mirror-typed";
		afterCaret.textContent = parts.afterCaret;
		elements.mirrorText.append(afterCaret);
	}

	if (parts.completionAfterCursor) {
		elements.mirror.dataset.hasSuggestion = "true";

		const completion = document.createElement("span");
		completion.className = "terminal-window__mirror-completion";
		completion.textContent = parts.completionAfterCursor;
		elements.mirrorText.append(completion);
	}
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
	return el.dataset.textEffectStableText ?? el.dataset.greetingTarget ?? el.textContent?.trim() ?? "";
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

function clearTerminalViewport(elements: TerminalModalElements, commandText: string): void {
	const viewportHeight = Math.max(elements.log?.clientHeight ?? 0, 240);
	const commandEntry: TerminalEntry = {
		id: nextEntryId(),
		kind: "command",
		text: commandText,
	};
	const spacerEntry: TerminalEntry = {
		id: nextEntryId(),
		kind: "viewport-clear",
		height: viewportHeight,
	};

	appendEntries(commandEntry, spacerEntry);
	renderLog(elements, commandEntry.id);
	if (elements.status) {
		elements.status.textContent = "viewport cleared";
	}
}

function resetTerminalRuntime(elements: TerminalModalElements): void {
	clearSequenceTimers();
	_entries = [];
	_commandHistory.length = 0;
	_nextEntryId = 0;
	_interaction = null;
	clearTerminalIdleTimer();
	_terminalIdleCount = 0;
	_terminalLastAtmosphere = null;
	_terminalLastSystemTs = 0;
	_terminalLastRareTs = 0;
	resetHistoryNavigation();

	if (elements.log) {
		elements.log.innerHTML = "";
	}

	if (elements.input) {
		elements.input.value = "";
	}

	if (elements.status) {
		elements.status.textContent = "terminal reinitialized";
	}

	if (elements.atmosphere) {
		resetTerminalTextEffect(elements.atmosphere);
		elements.atmosphere.textContent = "restoring context";
		elements.atmosphere.dataset.textEffectStableText = "restoring context";
		elements.atmosphere.dataset.greetingTarget = "restoring context";
	}

	syncPromptMirror(elements);
	updateTerminalPresence(elements);
	ensurePrelude(elements);
	renderTerminalAtmosphere("load");
	scheduleTerminalIdleAtmosphere();
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
	resetHistoryNavigation();

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
		elements.atmosphere.dataset.textEffectStableText = "restoring context";
		elements.atmosphere.dataset.greetingTarget = "restoring context";
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
	const fontEntry: TerminalEntry = {
		id: nextEntryId(),
		kind: "system-font",
		font: profile.font,
		colorRole: profile.asciiLines[0]?.colorRole ?? "secondary",
	};
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

	return [fontEntry, ...artEntries, ...metaEntries];
}

function appendTerminalEntryText(
	target: HTMLElement,
	text: string,
	options: { highlightSections?: boolean } = {}
): void {
	const { highlightSections = false } = options;
	const lines = text.split("\n");

	lines.forEach((line, index) => {
		if (index > 0) {
			target.append(document.createTextNode("\n"));
		}

		if (highlightSections && /^\[[^\]]+\]$/.test(line.trim())) {
			const heading = document.createElement("span");
			heading.className = "terminal-window__entry-section-heading";
			heading.textContent = line;
			target.append(heading);
			return;
		}

		if (highlightSections && /^stellar (verbose|info)\b/.test(line.trim())) {
			const diagnostic = document.createElement("span");
			diagnostic.className = "terminal-window__entry-diagnostic";
			diagnostic.textContent = line;
			target.append(diagnostic);
			return;
		}

		target.append(document.createTextNode(line));
	});
}

function createEntryElement(entry: TerminalEntry): HTMLElement {
	if (entry.kind === "viewport-clear") {
		const spacer = document.createElement("div");
		spacer.className = "terminal-window__viewport-clear";
		spacer.dataset.entryId = entry.id;
		spacer.style.height = `${entry.height}px`;
		return spacer;
	}

	if (entry.kind === "system-font") {
		const line = document.createElement("p");
		line.className = `terminal-window__system-font terminal-window__system-art-line--${entry.colorRole}`;
		line.dataset.entryId = entry.id;
		line.textContent = `[${entry.font}]`;
		return line;
	}

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
	appendTerminalEntryText(text, entry.text, { highlightSections: entry.kind === "system" });
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
		} else if (entry.kind === "system-font") {
			delay += 95;
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

function getTerminalFocusTargetRole(
	target: EventTarget | null,
	elements: TerminalModalElements
): TerminalFocusTargetRole {
	if (!(target instanceof HTMLElement)) return "content";
	if (target === elements.input || target.closest("#terminal-modal-input")) return "input";
	if (target.closest("[data-terminal-control]")) return "control";
	if (target.closest("[data-terminal-resize]")) return "resize";
	if (target.closest("#terminal-modal-completions, .terminal-window__completion")) return "completion";
	if (elements.windowEl && !elements.windowEl.contains(target)) return "external";
	return "content";
}

function getSelectionElement(node: Node | null): HTMLElement | null {
	if (!node) return null;
	return node instanceof HTMLElement ? node : node.parentElement;
}

function getTerminalKeyboardTargetRole(
	target: EventTarget | null,
	elements: TerminalModalElements
): TerminalFocusTargetRole {
	const targetRole = getTerminalFocusTargetRole(target, elements);
	if (targetRole !== "external") return targetRole;

	const selection = document.getSelection();
	const anchor = getSelectionElement(selection?.anchorNode ?? null);
	const focus = getSelectionElement(selection?.focusNode ?? null);
	if (
		elements.windowEl &&
		((anchor && elements.windowEl.contains(anchor)) || (focus && elements.windowEl.contains(focus)))
	) {
		return "content";
	}

	return targetRole;
}

function writeToTerminalInput(elements: TerminalModalElements, text: string): void {
	if (!elements.input || !elements.windowEl) return;

	requestTerminalInputFocus(elements, "interaction", "input");
	const start = elements.input.selectionStart ?? elements.input.value.length;
	const end = elements.input.selectionEnd ?? elements.input.value.length;
	elements.input.setRangeText(text, start, end, "end");
	resetHistoryNavigation();
	closeCompletionMenu(elements);
	syncPromptMirror(elements);
}

function requestTerminalInputFocus(
	elements: TerminalModalElements,
	reason: TerminalFocusReason,
	targetRole: TerminalFocusTargetRole = "content"
): void {
	if (
		!elements.input ||
		!elements.windowEl ||
		!shouldFocusTerminalInput({
			open: _open,
			windowHidden: Boolean(elements.windowEl.hidden),
			targetRole,
			reason,
		})
	) {
		return;
	}

	syncPromptMirror(elements);
	requestAnimationFrame(() => {
		if (
			!elements.input ||
			!elements.windowEl ||
			!shouldFocusTerminalInput({
				open: _open,
				windowHidden: Boolean(elements.windowEl.hidden),
				targetRole,
				reason,
			})
		) {
			return;
		}

		elements.input.focus({ preventScroll: true });
	});
}

function openTerminal(detail?: NavBrandTerminalOpenDetail): void {
	const elements = getElements();
	if (!elements.windowEl) return;
	const hadTerminalSession = _entries.length > 0;
	const wasMinimized = _windowState.mode === "minimized";

	_lastOpenSource = detail?.source ?? _lastOpenSource;

	if (wasMinimized) {
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
	requestTerminalInputFocus(elements, wasMinimized ? "restore" : "open");
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
	if (target === "flavor" && typeof value === "string" && isFlavor(value)) {
		setFlavor(value);
		return;
	}

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

		if (value === "toggle") {
			collapseTab.click();
			return;
		}

		const isCollapsed = document.documentElement.hasAttribute("data-sidebar-collapsed");
		const shouldCollapse = value === "collapse";
		if (isCollapsed !== shouldCollapse) {
			collapseTab.click();
		}
		return;
	}

	const toggle = document.getElementById(target) as HTMLInputElement | null;
	if (!toggle) return;
	if (value === "toggle") {
		toggle.click();
		return;
	}
	if (toggle.checked !== value) {
		toggle.click();
	}
}

function buildMessageOutput(intent: Extract<NavBrandCommandIntent, { type: "message" }>): string {
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
		effect: kind === "system" && !output.includes("\n") ? "typing" : undefined,
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

function minimizeAfterDispatch(callback: () => void, statusText: string): void {
	const elements = getElements();
	if (elements.status) {
		elements.status.textContent = statusText;
	}
	window.setTimeout(() => {
		minimizeTerminal();
		callback();
	}, CLOSE_DISPATCH_DELAY_MS);
}

function navigateSoftly(href: string): void {
	const anchor = document.createElement("a");
	anchor.href = href;
	anchor.style.display = "none";
	document.body.append(anchor);
	anchor.click();
	anchor.remove();
}

function openExternalPreservingTerminal(href: string): void {
	if (/^https?:\/\//i.test(href)) {
		window.open(href, "_blank", "noopener,noreferrer");
		return;
	}

	window.location.assign(href);
}

async function executeResolvedCommand(
	elements: TerminalModalElements,
	rawInput: string,
	resolved: ResolvedNavBrandCommand
): Promise<void> {
	const intent = buildNavBrandCommandIntent(resolved);
	if (!intent) {
		appendCommandAndOutput(elements, rawInput, buildNavBrandUnknownCommandMessage(rawInput), "system");
		return;
	}

	if (intent.type === "clear-viewport") {
		clearTerminalViewport(elements, rawInput);
		return;
	}

	if (intent.type === "clear-history") {
		clearVisibleHistory(elements);
		return;
	}

	if (intent.type === "reset-terminal") {
		resetTerminalRuntime(elements);
		return;
	}

	if (intent.type === "minimize-terminal") {
		appendCommandAndOutput(elements, rawInput, "minimizing terminal", "system");
		window.setTimeout(() => minimizeTerminal(), CLOSE_DISPATCH_DELAY_MS);
		return;
	}

	if (intent.type === "close-terminal") {
		appendCommandAndOutput(elements, rawInput, "closing terminal session", "system");
		window.setTimeout(() => destroyTerminal(), CLOSE_DISPATCH_DELAY_MS);
		return;
	}

	if (intent.type === "show-history") {
		appendCommandAndOutput(
			elements,
			rawInput,
			buildNavBrandHistoryMessage(_commandHistory, { verbose: resolved.verbose, argv: resolved.argv }),
			"system"
		);
		return;
	}

	if (intent.type === "show-status") {
		const snapshot = getTerminalSystemSnapshot();
		appendCommandAndOutput(
			elements,
			rawInput,
			buildNavBrandStatusMessage(
				{
					route: snapshot.route,
					theme: snapshot.theme,
					flavor: snapshot.flavor,
					network: snapshot.network,
					reducedMotion: snapshot.reducedMotion,
					platform: snapshot.platform,
					timezone: snapshot.timezone,
					viewport: snapshot.viewport,
					language: snapshot.language,
				},
				{
					verbose: resolved.verbose,
					argv: resolved.argv,
				}
			),
			"system"
		);
		return;
	}

	if (intent.type === "show-working-route") {
		appendCommandAndOutput(elements, rawInput, window.location.pathname || "/", "system");
		return;
	}

	if (intent.type === "list-routes") {
		appendCommandAndOutput(
			elements,
			rawInput,
			buildNavBrandRouteListMessage({ verbose: resolved.verbose, argv: resolved.argv }),
			"system"
		);
		return;
	}

	if (intent.type === "show-system-profile") {
		appendCommandAndSystemProfile(elements, rawInput);
		return;
	}

	if (intent.type === "message") {
		appendCommandAndOutput(
			elements,
			rawInput,
			resolved.command.id === "help"
				? buildNavBrandHelpMessage(resolved.query, { verbose: resolved.verbose, argv: resolved.argv })
				: resolved.command.id === "identity"
					? buildNavBrandIdentityMessage({ verbose: resolved.verbose, argv: resolved.argv })
					: buildMessageOutput(intent),
			"system"
		);
		return;
	}

	if (intent.type === "batch") {
		for (const item of intent.intents) {
			if (item.type === "toggle-pref") {
				applyToggleIntent(item.target, item.value);
			}
		}
		appendCommandAndOutput(elements, rawInput, `applied ${rawInput}`, "system");
		return;
	}

	if (intent.type === "toggle-pref") {
		applyToggleIntent(intent.target, intent.value);
		appendCommandAndOutput(elements, rawInput, `applied ${rawInput}`, "system");
		return;
	}

	if (intent.type === "external-link") {
		appendCommandAndOutput(elements, rawInput, `opening ${intent.href}`, "system");
		minimizeAfterDispatch(() => openExternalPreservingTerminal(intent.href), "dispatching external link");
		return;
	}

	if (intent.type === "copy") {
		const copied = await writeTextToClipboard(intent.value);
		appendCommandAndOutput(
			elements,
			rawInput,
			copied ? `copied ${intent.label}\n${intent.value}` : `copy unavailable · ${intent.value}`,
			"system"
		);
		return;
	}

	if (intent.type === "navigate") {
		appendCommandAndOutput(elements, rawInput, `navigating to ${intent.href}`, "system");
		minimizeAfterDispatch(() => navigateSoftly(intent.href), "routing to destination");
		return;
	}

	appendCommandAndOutput(
		elements,
		rawInput,
		intent.query ? `searching for ${intent.query}` : "opening search surface",
		"system"
	);
	minimizeAfterDispatch(() => openSearchSurface(intent.query ?? undefined), "handing off to search");
}

function submitCommand(rawInput: string): void {
	const elements = getElements();
	const normalizedInput = rawInput.trim();
	if (!normalizedInput) return;

	_commandHistory.push(normalizedInput);
	const resolved = resolveNavBrandCommandInput(normalizedInput);
	if (!resolved) {
		appendCommandAndOutput(elements, normalizedInput, buildNavBrandUnknownCommandMessage(normalizedInput), "system");
		return;
	}

	void executeResolvedCommand(elements, normalizedInput, resolved);
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
			if (acceptCompletion(elements)) {
				noteTerminalActivity();
				return;
			}
			submitCommand(elements.input?.value ?? "");
			resetHistoryNavigation();
			noteTerminalActivity();
			if (elements.input) {
				elements.input.value = "";
				syncPromptMirror(elements);
				requestTerminalInputFocus(elements, "submit", "input");
			}
		},
		{ signal }
	);

	elements.input.addEventListener(
		"input",
		() => {
			resetHistoryNavigation();
			closeCompletionMenu(elements);
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
				closeCompletionMenu(elements);
				resetHistoryNavigation();
				clearVisibleHistory(getElements());
				return;
			}

			if (event.key === "ArrowRight" && acceptInlineSuggestion(elements)) {
				event.preventDefault();
				return;
			}

			if (event.key === "ArrowUp" || event.key === "ArrowDown") {
				if (_commandHistory.length > 0) {
					event.preventDefault();
					closeCompletionMenu(elements);
					navigateInputHistory(elements, event.key === "ArrowUp" ? "previous" : "next");
					return;
				}
			}

			if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
				schedulePromptMirrorSync(elements);
			}

			if (event.key === "Tab") {
				event.preventDefault();
				openOrCycleCompletionMenu(elements);
				return;
			}

			if (event.key === "Enter" && _completionItems.length > 0) {
				event.preventDefault();
				acceptCompletion(elements);
				return;
			}

			if (event.key === "Escape") {
				event.preventDefault();
				if (_completionItems.length > 0) {
					closeCompletionMenu(elements);
					return;
				}
				if (_windowState.mode === "fullscreen") {
					exitFullscreenToWindowed();
					return;
				}
				minimizeTerminal();
			}
		},
		{ signal }
	);

	elements.input.addEventListener("keyup", () => syncPromptMirror(elements), { signal });
	elements.input.addEventListener("click", () => syncPromptMirror(elements), { signal });
	elements.input.addEventListener("pointerup", () => schedulePromptMirrorSync(elements), { signal });
	elements.input.addEventListener("select", () => syncPromptMirror(elements), { signal });

	elements.dragHandle.addEventListener("pointerdown", (event) => beginDrag(event, elements), { signal });
	elements.windowEl.addEventListener(
		"pointerdown",
		(event) => {
			noteTerminalActivity();
			const targetRole = getTerminalFocusTargetRole(event.target, elements);
			if (shouldPreserveTerminalOutputSelection(targetRole)) {
				return;
			}
			if (targetRole !== "input") {
				requestTerminalInputFocus(elements, "interaction", targetRole);
			}
		},
		{ signal }
	);
	elements.windowEl.addEventListener(
		"focusin",
		(event) => {
			const targetRole = getTerminalFocusTargetRole(event.target, elements);
			if (shouldPreserveTerminalOutputSelection(targetRole)) {
				return;
			}
			if (targetRole !== "input") {
				requestTerminalInputFocus(elements, "interaction", targetRole);
			}
		},
		{ signal }
	);
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
	document.addEventListener(
		"keydown",
		(event) => {
			const elements = getElements();
			const targetRole = getTerminalKeyboardTargetRole(event.target, elements);
			if (
				!shouldRouteTerminalKeyboardToInput({
					open: _open,
					windowHidden: Boolean(elements.windowEl?.hidden ?? true),
					targetRole,
					key: event.key,
					ctrlKey: event.ctrlKey,
					metaKey: event.metaKey,
					altKey: event.altKey,
				})
			) {
				return;
			}

			event.preventDefault();
			noteTerminalActivity();
			if (event.key === "Backspace") {
				const input = elements.input;
				if (!input) return;
				const start = input.selectionStart ?? input.value.length;
				const end = input.selectionEnd ?? input.value.length;
				if (start !== end) {
					writeToTerminalInput(elements, "");
					return;
				}
				if (start > 0) {
					input.setSelectionRange(start - 1, end);
					writeToTerminalInput(elements, "");
				}
				return;
			}

			writeToTerminalInput(elements, event.key);
		},
		{ signal }
	);
	document.addEventListener(
		"paste",
		(event) => {
			const elements = getElements();
			const targetRole = getTerminalKeyboardTargetRole(event.target, elements);
			if (
				!shouldFocusTerminalInput({
					open: _open,
					windowHidden: Boolean(elements.windowEl?.hidden ?? true),
					targetRole,
					reason: "interaction",
				}) ||
				targetRole !== "content"
			) {
				return;
			}

			const text = event.clipboardData?.getData("text/plain") ?? "";
			if (!text) return;
			event.preventDefault();
			noteTerminalActivity();
			writeToTerminalInput(elements, text);
		},
		{ signal }
	);
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
