/**
 * Shared terminal window coordinator.
 *
 * Responsibilities:
 * - listen for the shared `navbrand:open-terminal` event
 * - own the terminal shell lifecycle (open, close, minimize, maximize, restore)
 * - keep geometry and history in memory for the current session only
 * - render the curated prelude on open using the pure navbrand helpers
 *
 * Non-responsibilities:
 * - teaser policy and prompt hints remain in `src/scripts/navBrand.ts`
 * - command parsing/execution/history expansion belongs to the later Phase 3 task
 */
import { PREF_KEYS, getPref } from "@/lib/prefs";
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

type TerminalModalElements = {
	overlay: HTMLElement | null;
	windowEl: HTMLElement | null;
	dockChip: HTMLButtonElement | null;
	prelude: HTMLElement | null;
	status: HTMLElement | null;
	geometry: HTMLElement | null;
	dragHandle: HTMLElement | null;
	closeButton: HTMLButtonElement | null;
	minimizeButton: HTMLButtonElement | null;
	maximizeButton: HTMLButtonElement | null;
	resizeHandles: HTMLElement[];
};

type WindowAction = "close" | "minimize" | "maximize" | "restore";
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

let _abortController: AbortController | null = null;
let _open = false;
let _windowState: TerminalWindowState = createTerminalWindowState();
let _opener: HTMLElement | null = null;
let _interaction: InteractionSession | null = null;
let _lastOpenSource = "sidebar-expanded";

function getElements(): TerminalModalElements {
	return {
		overlay: document.getElementById("terminal-modal-overlay"),
		windowEl: document.getElementById("terminal-modal"),
		dockChip: document.getElementById("terminal-dock-chip") as HTMLButtonElement | null,
		prelude: document.getElementById("terminal-modal-prelude"),
		status: document.getElementById("terminal-modal-status"),
		geometry: document.getElementById("terminal-modal-geometry"),
		dragHandle: document.getElementById("terminal-modal-drag-handle"),
		closeButton: document.getElementById("terminal-close") as HTMLButtonElement | null,
		minimizeButton: document.getElementById("terminal-minimize") as HTMLButtonElement | null,
		maximizeButton: document.getElementById("terminal-maximize") as HTMLButtonElement | null,
		resizeHandles: Array.from(document.querySelectorAll<HTMLElement>("[data-terminal-resize]")),
	};
}

function isMobile(): boolean {
	return window.matchMedia(MOBILE_QUERY).matches;
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

function clearPreludeEffects(prelude: HTMLElement): void {
	for (const el of prelude.querySelectorAll<HTMLElement>("[data-terminal-prelude-text]")) {
		resetTerminalTextEffect(el);
	}
}

function renderPrelude(elements: TerminalModalElements): void {
	if (!elements.prelude || !elements.status) return;

	const prelude = buildTerminalPrelude({
		visits: Math.max(getVisitCount(), 1),
		lastVisitLabel: getLastVisitLabel(),
	});

	elements.status.textContent =
		_lastOpenSource === "sidebar-expanded" ? "restoring context" : `signal received · ${_lastOpenSource}`;
	clearPreludeEffects(elements.prelude);
	elements.prelude.innerHTML = "";

	for (const line of prelude.lines) {
		const row = document.createElement("p");
		row.className = "terminal-window__prelude-line";
		const text = document.createElement("span");
		text.className = "terminal-window__prelude-text";
		text.dataset.terminalPreludeText = "";
		text.textContent = line;
		row.append(text);
		elements.prelude.append(row);
	}

	const statusRow = document.createElement("p");
	statusRow.className = "terminal-window__prelude-status";
	const statusText = document.createElement("span");
	statusText.className = "terminal-window__prelude-text";
	statusText.dataset.terminalPreludeText = "";
	statusText.textContent = prelude.statusLine;
	statusRow.append(statusText);
	elements.prelude.append(statusRow);

	if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
		return;
	}

	const lines = Array.from(elements.prelude.querySelectorAll<HTMLElement>("[data-terminal-prelude-text]"));
	for (const [index, line] of lines.entries()) {
		window.setTimeout(() => {
			playTerminalTextEffect({
				el: line,
				effect: Math.random() > 0.5 ? "decrypt" : "typing",
				text: line.textContent ?? "",
			});
		}, index * 110);
	}
}

function focusWindow(elements: TerminalModalElements): void {
	elements.windowEl?.focus();
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
	renderPrelude(elements);
	focusWindow(elements);
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
	if (!elements.windowEl || !elements.overlay || !elements.dockChip || !elements.dragHandle) return;

	setWindowVisibility(elements);

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
