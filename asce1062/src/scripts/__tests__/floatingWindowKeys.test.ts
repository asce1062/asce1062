import { describe, expect, it } from "vitest";
import { WINDOW_KEY_STEP_PX, getWindowKeyResizeEdge, resolveWindowKeyNudge } from "@/scripts/floatingWindowKeys";

const handle = new EventTarget();

function key(key: string, overrides: Partial<Parameters<typeof resolveWindowKeyNudge>[0]> = {}) {
	return { key, shiftKey: false, ctrlKey: false, metaKey: false, altKey: false, target: handle, ...overrides };
}

describe("resolveWindowKeyNudge", () => {
	it("moves one step per arrow key", () => {
		expect(resolveWindowKeyNudge(key("ArrowLeft"), handle)).toEqual({
			kind: "move",
			deltaX: -WINDOW_KEY_STEP_PX,
			deltaY: 0,
		});
		expect(resolveWindowKeyNudge(key("ArrowRight"), handle)).toEqual({
			kind: "move",
			deltaX: WINDOW_KEY_STEP_PX,
			deltaY: 0,
		});
		expect(resolveWindowKeyNudge(key("ArrowUp"), handle)).toEqual({
			kind: "move",
			deltaX: 0,
			deltaY: -WINDOW_KEY_STEP_PX,
		});
		expect(resolveWindowKeyNudge(key("ArrowDown"), handle)).toEqual({
			kind: "move",
			deltaX: 0,
			deltaY: WINDOW_KEY_STEP_PX,
		});
	});

	it("resizes with Shift held", () => {
		expect(resolveWindowKeyNudge(key("ArrowDown", { shiftKey: true }), handle)).toEqual({
			kind: "resize",
			deltaX: 0,
			deltaY: WINDOW_KEY_STEP_PX,
		});
	});

	it("ignores keys pressed on anything but the handle itself", () => {
		expect(resolveWindowKeyNudge(key("ArrowLeft", { target: new EventTarget() }), handle)).toBeNull();
		expect(resolveWindowKeyNudge(key("ArrowLeft"), null)).toBeNull();
	});

	it("ignores other keys and browser or system chords", () => {
		expect(resolveWindowKeyNudge(key("Enter"), handle)).toBeNull();
		expect(resolveWindowKeyNudge(key("a"), handle)).toBeNull();
		expect(resolveWindowKeyNudge(key("ArrowLeft", { altKey: true }), handle)).toBeNull();
		expect(resolveWindowKeyNudge(key("ArrowLeft", { ctrlKey: true }), handle)).toBeNull();
		expect(resolveWindowKeyNudge(key("ArrowLeft", { metaKey: true }), handle)).toBeNull();
	});
});

describe("getWindowKeyResizeEdge", () => {
	const horizontal = { kind: "resize", deltaX: WINDOW_KEY_STEP_PX, deltaY: 0 } as const;
	const vertical = { kind: "resize", deltaX: 0, deltaY: -WINDOW_KEY_STEP_PX } as const;

	it("drags the right and bottom edges", () => {
		expect(getWindowKeyResizeEdge(horizontal, false)).toBe("e");
		expect(getWindowKeyResizeEdge(vertical, false)).toBe("s");
	});

	it("drags only the top edge where the pointer can only resize from the top", () => {
		expect(getWindowKeyResizeEdge(vertical, true)).toBe("n");
		expect(getWindowKeyResizeEdge(horizontal, true)).toBeNull();
	});
});
