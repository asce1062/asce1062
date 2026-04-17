import { describe, expect, it } from "vitest";
import {
	createTerminalWindowState,
	minimizeTerminalWindow,
	maximizeTerminalWindow,
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

	it("remembers the pre-maximize rect when maximized then restored", () => {
		const initial = createTerminalWindowState();
		const resized = updateTerminalWindowRect(initial, { x: 80, y: 64, width: 900, height: 620 });
		const maximized = maximizeTerminalWindow(resized);
		const restored = restoreTerminalWindow(maximized);

		expect(maximized.mode).toBe("maximized");
		expect(maximized.restoreRect).toEqual({ x: 80, y: 64, width: 900, height: 620 });
		expect(maximized.restoreRect).not.toBe(resized.rect);
		expect(restored.rect).toEqual({ x: 80, y: 64, width: 900, height: 620 });
		expect(restored.rect).not.toBe(maximized.restoreRect);
	});

	it("keeps the existing restore rect when minimizing or maximizing from a non-windowed state", () => {
		const initial = createTerminalWindowState();
		const resized = updateTerminalWindowRect(initial, { x: 140, y: 90, width: 780, height: 520 });
		const maximized = maximizeTerminalWindow(resized);
		const minimizedFromMax = minimizeTerminalWindow(maximized);

		expect(minimizedFromMax.restoreRect).toEqual({ x: 140, y: 90, width: 780, height: 520 });
		expect(minimizedFromMax.restoreRect).toBe(maximized.restoreRect);
		expect(restoreTerminalWindow(minimizedFromMax).rect).toEqual({
			x: 140,
			y: 90,
			width: 780,
			height: 520,
		});
	});
});
