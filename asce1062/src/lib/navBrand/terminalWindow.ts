export type TerminalWindowMode = "windowed" | "expanded" | "fullscreen" | "minimized";
export type RestorableTerminalWindowMode = Exclude<TerminalWindowMode, "minimized">;
export type TerminalWindowRect = { x: number; y: number; width: number; height: number };
export type TerminalWindowState = {
	mode: TerminalWindowMode;
	rect: TerminalWindowRect;
	restoreRect: TerminalWindowRect | null;
	restoreMode: RestorableTerminalWindowMode | null;
};

const DEFAULT_RECT: TerminalWindowRect = { x: 96, y: 88, width: 860, height: 580 };
const EXPANDED_RECT: TerminalWindowRect = { x: 96, y: 88, width: 940, height: 640 };
const HANDLE_DOUBLE_TAP_MAX_GAP_MS = 320;

export function createTerminalWindowState(): TerminalWindowState {
	return {
		mode: "windowed",
		rect: { ...DEFAULT_RECT },
		restoreRect: null,
		restoreMode: null,
	};
}

export function updateTerminalWindowRect(state: TerminalWindowState, rect: TerminalWindowRect): TerminalWindowState {
	return { ...state, rect: { ...rect } };
}

export function getTerminalWindowPresetRect(
	mode: Extract<RestorableTerminalWindowMode, "windowed" | "expanded">
): TerminalWindowRect {
	return mode === "expanded" ? { ...EXPANDED_RECT } : { ...DEFAULT_RECT };
}

export function getNextTerminalWindowMode(mode: RestorableTerminalWindowMode): RestorableTerminalWindowMode {
	if (mode === "windowed") return "expanded";
	if (mode === "expanded") return "fullscreen";
	return "windowed";
}

export function getNextTerminalWindowModeForViewport(
	mode: RestorableTerminalWindowMode,
	isMobile: boolean
): RestorableTerminalWindowMode {
	if (!isMobile) {
		return getNextTerminalWindowMode(mode);
	}

	return mode === "fullscreen" ? "windowed" : "fullscreen";
}

export function setTerminalWindowMode(
	state: TerminalWindowState,
	mode: RestorableTerminalWindowMode
): TerminalWindowState {
	return {
		...state,
		mode,
	};
}

export function centerTerminalWindowRect(
	rect: TerminalWindowRect,
	viewport: { width: number; height: number },
	margin = 24
): TerminalWindowRect {
	const maxX = Math.max(margin, viewport.width - rect.width - margin);
	const maxY = Math.max(margin, viewport.height - rect.height - margin);

	return {
		...rect,
		x: Math.min(maxX, Math.max(margin, Math.round((viewport.width - rect.width) / 2))),
		y: Math.min(maxY, Math.max(margin, Math.round((viewport.height - rect.height) / 2))),
	};
}

export function resizeTerminalWindowRectFromEdge(
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

	return { x, y, width, height };
}

export function shouldTreatTerminalHandleTapAsDoubleTap(
	lastTapTs: number | null,
	now: number,
	maxGapMs = HANDLE_DOUBLE_TAP_MAX_GAP_MS
): boolean {
	if (lastTapTs === null) return false;
	const gap = now - lastTapTs;
	return gap > 0 && gap <= maxGapMs;
}

export function minimizeTerminalWindow(state: TerminalWindowState): TerminalWindowState {
	return {
		...state,
		mode: "minimized",
		restoreRect: state.mode === "minimized" ? state.restoreRect : { ...state.rect },
		restoreMode: state.mode === "minimized" ? state.restoreMode : state.mode,
	};
}

export function restoreTerminalWindow(state: TerminalWindowState): TerminalWindowState {
	return {
		...state,
		mode: state.restoreMode ?? "windowed",
		rect: state.restoreRect ? { ...state.restoreRect } : { ...state.rect },
		restoreRect: null,
		restoreMode: null,
	};
}
