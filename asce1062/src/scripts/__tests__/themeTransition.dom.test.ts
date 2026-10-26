// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { atomicSwitch } from "@/scripts/themeTransition";

describe("atomicSwitch", () => {
	let frames: FrameRequestCallback[];

	/** Run the frames queued so far, as one browser repaint would. */
	function flushFrame(): void {
		const queued = frames;
		frames = [];
		queued.forEach((callback) => callback(0));
	}

	beforeEach(() => {
		frames = [];
		vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => frames.push(callback));
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		document.documentElement.removeAttribute("data-theme-switching");
	});

	it("applies the change while transitions are frozen", () => {
		let frozenDuringApply = false;
		atomicSwitch(() => {
			frozenDuringApply = document.documentElement.hasAttribute("data-theme-switching");
		});
		expect(frozenDuringApply).toBe(true);
	});

	it("keeps the freeze through the first frame and lifts it after the second", () => {
		atomicSwitch(() => {});
		flushFrame();
		expect(document.documentElement.hasAttribute("data-theme-switching")).toBe(true);
		flushFrame();
		expect(document.documentElement.hasAttribute("data-theme-switching")).toBe(false);
	});
});
