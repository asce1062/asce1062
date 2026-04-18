import { describe, expect, it } from "vitest";
import {
	getNextTerminalWindowMode,
	getNextTerminalWindowModeForViewport,
	shouldTreatTerminalHandleTapAsDoubleTap,
	centerTerminalWindowRect,
	createTerminalWindowState,
	getTerminalWindowPresetRect,
	minimizeTerminalWindow,
	setTerminalWindowMode,
	resizeTerminalWindowRectFromEdge,
	restoreTerminalWindow,
	updateTerminalWindowRect,
} from "@/lib/navBrand/terminalWindow";

describe("terminal window state", () => {
	it("stores geometry only in memory and preserves it across minimize/restore", () => {
		const initial = createTerminalWindowState();
		const initialRect = initial.rect;
		const resized = updateTerminalWindowRect(initial, { x: 120, y: 80, width: 840, height: 560 });
		const minimized = minimizeTerminalWindow(resized);
		const restored = restoreTerminalWindow(minimized);

		expect(initial.rect).toEqual(initialRect);
		expect(resized).not.toBe(initial);
		expect(resized.rect).not.toBe(initial.rect);
		expect(minimized).not.toBe(resized);
		expect(minimized.restoreRect).not.toBe(resized.rect);
		expect(restored.rect).toEqual({ x: 120, y: 80, width: 840, height: 560 });
		expect(restored.rect).not.toBe(minimized.restoreRect);
		expect(restored.mode).toBe("windowed");
		expect(restored.restoreRect).toBeNull();
	});

	it("cycles terminal modes from base to expanded to fullscreen then back to base", () => {
		expect(getTerminalWindowPresetRect("windowed")).toEqual({ x: 96, y: 88, width: 860, height: 580 });
		expect(getTerminalWindowPresetRect("expanded")).toEqual({ x: 96, y: 88, width: 940, height: 640 });
		expect(getNextTerminalWindowMode("windowed")).toBe("expanded");
		expect(getNextTerminalWindowMode("expanded")).toBe("fullscreen");
		expect(getNextTerminalWindowMode("fullscreen")).toBe("windowed");
	});

	it("uses a simpler windowed/fullscreen cycle on mobile", () => {
		expect(getNextTerminalWindowModeForViewport("windowed", true)).toBe("fullscreen");
		expect(getNextTerminalWindowModeForViewport("expanded", true)).toBe("fullscreen");
		expect(getNextTerminalWindowModeForViewport("fullscreen", true)).toBe("windowed");
		expect(getNextTerminalWindowModeForViewport("windowed", false)).toBe("expanded");
	});

	it("remembers the pre-fullscreen mode and rect when minimized then restored", () => {
		const initial = createTerminalWindowState();
		const resized = updateTerminalWindowRect(initial, { x: 80, y: 64, width: 900, height: 620 });
		const fullscreen = setTerminalWindowMode(resized, "fullscreen");
		const minimized = minimizeTerminalWindow(fullscreen);
		const restored = restoreTerminalWindow(minimized);

		expect(minimized.mode).toBe("minimized");
		expect(minimized.restoreMode).toBe("fullscreen");
		expect(minimized.restoreRect).toEqual({ x: 80, y: 64, width: 900, height: 620 });
		expect(minimized.restoreRect).not.toBe(resized.rect);
		expect(restored.mode).toBe("fullscreen");
		expect(restored.rect).toEqual({ x: 80, y: 64, width: 900, height: 620 });
		expect(restored.rect).not.toBe(minimized.restoreRect);
	});

	it("keeps the existing restore rect when minimizing or maximizing from a non-windowed state", () => {
		const initial = createTerminalWindowState();
		const resized = updateTerminalWindowRect(initial, { x: 140, y: 90, width: 780, height: 520 });
		const expanded = setTerminalWindowMode(resized, "expanded");
		const minimizedFromExpanded = minimizeTerminalWindow(expanded);

		expect(minimizedFromExpanded.restoreRect).toEqual({ x: 140, y: 90, width: 780, height: 520 });
		expect(minimizedFromExpanded.restoreMode).toBe("expanded");
		expect(restoreTerminalWindow(minimizedFromExpanded).rect).toEqual({
			x: 140,
			y: 90,
			width: 780,
			height: 520,
		});
	});

	it("centers a terminal rect inside the viewport bounds", () => {
		expect(
			centerTerminalWindowRect({ x: 96, y: 88, width: 860, height: 580 }, { width: 1440, height: 900 }, 24)
		).toEqual({
			x: 290,
			y: 160,
			width: 860,
			height: 580,
		});
	});

	it("resizes from all desktop edges and corners", () => {
		const start = { x: 100, y: 100, width: 860, height: 580 };

		expect(resizeTerminalWindowRectFromEdge("n", start, 0, -40)).toEqual({
			x: 100,
			y: 60,
			width: 860,
			height: 620,
		});
		expect(resizeTerminalWindowRectFromEdge("ne", start, 40, -40)).toEqual({
			x: 100,
			y: 60,
			width: 900,
			height: 620,
		});
		expect(resizeTerminalWindowRectFromEdge("nw", start, -40, -40)).toEqual({
			x: 60,
			y: 60,
			width: 900,
			height: 620,
		});
		expect(resizeTerminalWindowRectFromEdge("sw", start, -40, 40)).toEqual({
			x: 60,
			y: 100,
			width: 900,
			height: 620,
		});
	});

	it("treats only close successive taps as a handle double tap", () => {
		expect(shouldTreatTerminalHandleTapAsDoubleTap(null, 1_000)).toBe(false);
		expect(shouldTreatTerminalHandleTapAsDoubleTap(1_000, 1_220)).toBe(true);
		expect(shouldTreatTerminalHandleTapAsDoubleTap(1_000, 1_500)).toBe(false);
		expect(shouldTreatTerminalHandleTapAsDoubleTap(1_000, 1_000)).toBe(false);
	});
});
