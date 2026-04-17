export type TerminalWindowMode = "windowed" | "minimized" | "maximized";
export type TerminalWindowRect = { x: number; y: number; width: number; height: number };
export type TerminalWindowState = {
	mode: TerminalWindowMode;
	rect: TerminalWindowRect;
	restoreRect: TerminalWindowRect | null;
};

const DEFAULT_RECT: TerminalWindowRect = { x: 96, y: 88, width: 860, height: 580 };

export function createTerminalWindowState(): TerminalWindowState {
	return {
		mode: "windowed",
		rect: { ...DEFAULT_RECT },
		restoreRect: null,
	};
}

export function updateTerminalWindowRect(state: TerminalWindowState, rect: TerminalWindowRect): TerminalWindowState {
	return { ...state, rect: { ...rect } };
}

export function minimizeTerminalWindow(state: TerminalWindowState): TerminalWindowState {
	return {
		...state,
		mode: "minimized",
		restoreRect: state.mode === "windowed" ? { ...state.rect } : state.restoreRect,
	};
}

export function maximizeTerminalWindow(state: TerminalWindowState): TerminalWindowState {
	return {
		...state,
		mode: "maximized",
		restoreRect: state.mode === "windowed" ? { ...state.rect } : state.restoreRect,
	};
}

export function restoreTerminalWindow(state: TerminalWindowState): TerminalWindowState {
	return {
		...state,
		mode: "windowed",
		rect: state.restoreRect ? { ...state.restoreRect } : { ...state.rect },
		restoreRect: null,
	};
}
