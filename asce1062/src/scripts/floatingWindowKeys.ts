/**
 * Keyboard move and resize for the floating windows (terminal, music player).
 *
 * Both windows make their title bar a keyboard stop. While it has focus:
 * - Arrow keys move the window one step
 * - Shift + Arrow keys resize it one step
 *
 * This file only turns a keydown into an intent. Each window applies it through
 * its own rect clamp, so the keyboard obeys the same movement box and minimum
 * sizes as the pointer.
 */

/** One key press, in CSS pixels. */
export const WINDOW_KEY_STEP_PX = 16;

export type WindowKeyNudge = {
	kind: "move" | "resize";
	deltaX: number;
	deltaY: number;
};

type WindowKeyEvent = Pick<KeyboardEvent, "key" | "shiftKey" | "ctrlKey" | "metaKey" | "altKey" | "target">;

const ARROW_DIRECTIONS: Record<string, { x: number; y: number }> = {
	ArrowLeft: { x: -1, y: 0 },
	ArrowRight: { x: 1, y: 0 },
	ArrowUp: { x: 0, y: -1 },
	ArrowDown: { x: 0, y: 1 },
};

/**
 * The move or resize a keydown asks for, or null when it is not one. Only keys
 * pressed on the title bar itself count: a button inside it, or the terminal
 * input, keeps its own arrow keys.
 */
export function resolveWindowKeyNudge(event: WindowKeyEvent, handle: EventTarget | null): WindowKeyNudge | null {
	if (!handle || event.target !== handle) return null;
	if (event.ctrlKey || event.metaKey || event.altKey) return null;
	const direction = ARROW_DIRECTIONS[event.key];
	if (!direction) return null;

	return {
		kind: event.shiftKey ? "resize" : "move",
		deltaX: direction.x * WINDOW_KEY_STEP_PX,
		deltaY: direction.y * WINDOW_KEY_STEP_PX,
	};
}

/**
 * The edge a keyboard resize drags, so the edge travels the way the arrow
 * points: right and bottom edges normally, the top edge where the pointer can
 * only resize from the top (phones). Null when that key cannot resize.
 */
export function getWindowKeyResizeEdge(nudge: WindowKeyNudge, topEdgeOnly: boolean): string | null {
	if (topEdgeOnly) return nudge.deltaY !== 0 ? "n" : null;
	return nudge.deltaX !== 0 ? "e" : "s";
}
