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
		const resized = updateTerminalWindowRect(initial, { x: 120, y: 80, width: 840, height: 560 });
		const minimized = minimizeTerminalWindow(resized);
		const restored = restoreTerminalWindow(minimized);

		expect(restored.rect).toEqual({ x: 120, y: 80, width: 840, height: 560 });
		expect(restored.mode).toBe("windowed");
	});

	it("remembers the pre-maximize rect when maximized then restored", () => {
		const initial = createTerminalWindowState();
		const resized = updateTerminalWindowRect(initial, { x: 80, y: 64, width: 900, height: 620 });
		const maximized = maximizeTerminalWindow(resized);
		const restored = restoreTerminalWindow(maximized);

		expect(maximized.mode).toBe("maximized");
		expect(restored.rect).toEqual({ x: 80, y: 64, width: 900, height: 620 });
	});
});
