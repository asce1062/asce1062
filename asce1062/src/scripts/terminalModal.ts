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
import { getFeltDuration } from "@/lib/navBrand/messages";
import { buildTerminalPrelude } from "@/lib/navBrand/terminalPrelude";
import {
	createTerminalWindowState,
	maximizeTerminalWindow,
	minimizeTerminalWindow,
	restoreTerminalWindow,
	updateTerminalWindowRect,
	type TerminalWindowRect,
	type TerminalWindowState,
} from "@/lib/navBrand/terminalWindow";
import { NAVBRAND_OPEN_TERMINAL_EVENT, type NavBrandTerminalOpenDetail } from "@/lib/navBrand/terminalEvents";
import { playTerminalTextEffect, resetTerminalTextEffect } from "@/lib/textEffects/terminalTextEffect";
import { disableMatchDeviceTheme, handleThemeToggle, setTheme, type Theme } from "@/scripts/themeManager";

type TerminalModalElements = {
	overlay: HTMLElement | null;
	windowEl: HTMLElement | null;
	dockChip: HTMLButtonElement | null;
	log: HTMLElement | null;
	status: HTMLElement | null;
	geometry: HTMLElement | null;
	dragHandle: HTMLElement | null;
	closeButton: HTMLButtonElement | null;
	minimizeButton: HTMLButtonElement | null;
	maximizeButton: HTMLButtonElement | null;
	form: HTMLFormElement | null;
	input: HTMLInputElement | null;
	resizeHandles: HTMLElement[];
};

type WindowAction = "close" | "minimize" | "maximize" | "restore";
type TerminalEntryKind = "prelude" | "system" | "command" | "output";
type TerminalEntry = {
	id: string;
	kind: TerminalEntryKind;
	text: string;
	effect?: "typing" | "decrypt";
};
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
const MIN_WIDTH = 420;
const MIN_HEIGHT = 320;
const CLOSE_DISPATCH_DELAY_MS = 140;

let _abortController: AbortController | null = null;
let _open = false;
let _windowState: TerminalWindowState = createTerminalWindowState();
let _opener: HTMLElement | null = null;
let _interaction: InteractionSession | null = null;
let _lastOpenSource = "sidebar-expanded";
let _entries: TerminalEntry[] = [];
const _commandHistory: string[] = [];
let _nextEntryId = 0;

function getElements(): TerminalModalElements {
	return {
		overlay: document.getElementById("terminal-modal-overlay"),
		windowEl: document.getElementById("terminal-modal"),
		dockChip: document.getElementById("terminal-dock-chip") as HTMLButtonElement | null,
		log: document.getElementById("terminal-modal-log"),
		status: document.getElementById("terminal-modal-status"),
		geometry: document.getElementById("terminal-modal-geometry"),
		dragHandle: document.getElementById("terminal-modal-drag-handle"),
		closeButton: document.getElementById("terminal-close") as HTMLButtonElement | null,
		minimizeButton: document.getElementById("terminal-minimize") as HTMLButtonElement | null,
		maximizeButton: document.getElementById("terminal-maximize") as HTMLButtonElement | null,
		form: document.getElementById("terminal-modal-form") as HTMLFormElement | null,
		input: document.getElementById("terminal-modal-input") as HTMLInputElement | null,
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

function getViewportRect(): TerminalWindowRect {
	if (isMobile()) {
		return {
			x: 12,
			y: 12,
			width: Math.max(320, window.innerWidth - 24),
			height: Math.max(420, window.innerHeight - 24),
		};
	}

	const width = Math.min(window.innerWidth - WINDOW_MARGIN * 2, 940);
	const height = Math.min(window.innerHeight - WINDOW_MARGIN * 2, 640);
	const x = Math.max(WINDOW_MARGIN, window.innerWidth - width - 48);
	const y = Math.max(WINDOW_MARGIN, 72);

	return { x, y, width, height };
}

function clampRect(rect: TerminalWindowRect): TerminalWindowRect {
	const minWidth = Math.min(MIN_WIDTH, Math.max(320, window.innerWidth - WINDOW_MARGIN * 2));
	const minHeight = Math.min(MIN_HEIGHT, Math.max(280, window.innerHeight - WINDOW_MARGIN * 2));
	const width = Math.min(Math.max(rect.width, minWidth), window.innerWidth - WINDOW_MARGIN * 2);
	const height = Math.min(Math.max(rect.height, minHeight), window.innerHeight - WINDOW_MARGIN * 2);
	const x = Math.min(
		Math.max(rect.x, WINDOW_MARGIN),
		Math.max(WINDOW_MARGIN, window.innerWidth - width - WINDOW_MARGIN)
	);
	const y = Math.min(
		Math.max(rect.y, WINDOW_MARGIN),
		Math.max(WINDOW_MARGIN, window.innerHeight - height - WINDOW_MARGIN)
	);

	return { x, y, width, height };
}

function setHidden(el: HTMLElement | null, hidden: boolean): void {
	if (!el) return;
	el.hidden = hidden;
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
	setDockState(elements);
	updateWindowFrame(elements);
}

function getVisitCount(): number {
	const visits = Number.parseInt(getPref(PREF_KEYS.navBrandVisits) ?? "0", 10);
	return Number.isFinite(visits) && visits >= 0 ? visits : 0;
}

function getLastVisitLabel(): string | null {
	const raw = Number.parseInt(getPref(PREF_KEYS.navBrandLastVisit) ?? "0", 10);
	if (!Number.isFinite(raw) || raw <= 0) return null;
	return getFeltDuration(raw, Date.now());
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

function createEntryElement(entry: TerminalEntry): HTMLElement {
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
				const effect = entry?.effect ?? null;
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

function ensurePrelude(elements: TerminalModalElements): void {
	if (_entries.length > 0) return;

	const prelude = buildTerminalPrelude({
		visits: Math.max(getVisitCount(), 1),
		lastVisitLabel: getLastVisitLabel(),
	});

	const newEntries: TerminalEntry[] = prelude.lines.map((line, index) => ({
		id: nextEntryId(),
		kind: "prelude",
		text: line,
		effect: index % 2 === 0 ? "decrypt" : "typing",
	}));

	newEntries.push({
		id: nextEntryId(),
		kind: "system",
		text: prelude.statusLine,
		effect: "typing",
	});

	appendEntries(...newEntries);
	renderLog(elements, newEntries[0]?.id);
}

function focusInput(elements: TerminalModalElements): void {
	elements.input?.focus();
}

function openTerminal(detail?: NavBrandTerminalOpenDetail): void {
	const elements = getElements();
	if (!elements.windowEl) return;

	_lastOpenSource = detail?.source ?? _lastOpenSource;

	if (_windowState.mode === "minimized") {
		_windowState = restoreTerminalWindow(_windowState);
	} else if (!_open && isMobile()) {
		_windowState = updateTerminalWindowRect(_windowState, getViewportRect());
	} else if (!_open) {
		_windowState = updateTerminalWindowRect(_windowState, clampRect(_windowState.rect));
	}

	_open = true;
	setWindowVisibility(elements);
	ensurePrelude(elements);
	if (elements.status) {
		elements.status.textContent =
			_lastOpenSource === "sidebar-expanded" ? "restoring context" : `signal received · ${_lastOpenSource}`;
	}
	focusInput(elements);
}

function closeTerminal(): void {
	const elements = getElements();
	_open = false;
	_windowState = restoreTerminalWindow({ ..._windowState, mode: "windowed", restoreRect: _windowState.restoreRect });
	setWindowVisibility(elements);
	_opener?.focus();
	_opener = null;
}

function minimizeTerminal(): void {
	const elements = getElements();
	_open = false;
	_windowState = minimizeTerminalWindow(_windowState);
	setWindowVisibility(elements);
}

function maximizeOrRestoreTerminal(): void {
	const elements = getElements();
	if (_windowState.mode === "maximized") {
		_windowState = restoreTerminalWindow(_windowState);
	} else {
		_windowState = maximizeTerminalWindow(_windowState);
		_windowState = updateTerminalWindowRect(_windowState, getViewportRect());
	}

	setWindowVisibility(elements);
}

function restoreFromDock(): void {
	openTerminal();
}

function beginDrag(event: PointerEvent, elements: TerminalModalElements): void {
	if (!elements.windowEl || _windowState.mode !== "windowed" || isMobile()) return;
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
	if (_windowState.mode !== "windowed" || isMobile()) return;

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

function resizeFromEdge(
	edge: string,
	startRect: TerminalWindowRect,
	deltaX: number,
	deltaY: number
): TerminalWindowRect {
	let { x, y, width, height } = startRect;

	if (edge.includes("e")) width += deltaX;
	if (edge.includes("s")) height += deltaY;
	if (edge.includes("w")) {
		x += deltaX;
		width -= deltaX;
	}

	if (edge.includes("n")) {
		y += deltaY;
		height -= deltaY;
	}

	return clampRect({ x, y, width, height });
}

function updateResize(event: PointerEvent): void {
	if (!_interaction || _interaction.kind !== "resize") return;
	const deltaX = event.clientX - _interaction.startX;
	const deltaY = event.clientY - _interaction.startY;
	_windowState = updateTerminalWindowRect(
		_windowState,
		resizeFromEdge(_interaction.edge, _interaction.startRect, deltaX, deltaY)
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
		return "try: search astro · blog · projects · theme dark · clear · history";
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

function closeAfterDispatch(callback: () => void, statusText: string): void {
	const elements = getElements();
	if (elements.status) {
		elements.status.textContent = statusText;
	}
	window.setTimeout(() => {
		closeTerminal();
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
		closeTerminal();
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
	renderLog(elements);

	document.addEventListener(
		NAVBRAND_OPEN_TERMINAL_EVENT,
		(event) => {
			_opener = document.activeElement as HTMLElement | null;
			openTerminal(event.detail);
		},
		{ signal }
	);

	elements.overlay.addEventListener("click", () => closeTerminal(), { signal });
	elements.closeButton?.addEventListener("click", () => onWindowAction("close"), { signal });
	elements.minimizeButton?.addEventListener("click", () => onWindowAction("minimize"), { signal });
	elements.maximizeButton?.addEventListener("click", () => onWindowAction("maximize"), { signal });
	elements.dockChip.addEventListener("click", () => onWindowAction("restore"), { signal });

	elements.form.addEventListener(
		"submit",
		(event) => {
			event.preventDefault();
			submitCommand(elements.input?.value ?? "");
			if (elements.input) {
				elements.input.value = "";
				elements.input.focus();
			}
		},
		{ signal }
	);

	elements.input.addEventListener(
		"keydown",
		(event) => {
			const isCtrlOrCmd = event.ctrlKey || event.metaKey;
			if (isCtrlOrCmd && event.key.toLowerCase() === "k") {
				event.preventDefault();
				event.stopPropagation();
				clearVisibleHistory(getElements());
			}

			if (event.key === "Escape") {
				event.preventDefault();
				closeTerminal();
			}
		},
		{ signal }
	);

	elements.dragHandle.addEventListener("pointerdown", (event) => beginDrag(event, elements), { signal });
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
			if (_windowState.mode === "maximized" || isMobile()) {
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
				closeTerminal();
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
