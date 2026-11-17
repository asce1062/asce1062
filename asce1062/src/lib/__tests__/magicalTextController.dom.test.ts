// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bindMagicalText } from "@/lib/magicalText";

type ObserverCallback = (entries: Array<{ isIntersecting: boolean }>) => void;

let observerCallback: ObserverCallback | null = null;
const disconnect = vi.fn();

class FakeIntersectionObserver {
	constructor(callback: ObserverCallback) {
		observerCallback = callback;
	}
	observe() {}
	unobserve() {}
	disconnect() {
		disconnect();
	}
}

function setDocumentHidden(hidden: boolean): void {
	Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
	document.dispatchEvent(new Event("visibilitychange"));
}

describe("bindMagicalText color-tracking loop", () => {
	let pendingFrames: Map<number, FrameRequestCallback>;
	let nextFrameId: number;
	let el: HTMLElement;

	const runFrame = (now: number): void => {
		const callbacks = [...pendingFrames.values()];
		pendingFrames.clear();
		for (const callback of callbacks) callback(now);
	};

	beforeEach(() => {
		pendingFrames = new Map();
		nextFrameId = 0;
		observerCallback = null;
		disconnect.mockClear();
		vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
		vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
			nextFrameId += 1;
			pendingFrames.set(nextFrameId, callback);
			return nextFrameId;
		});
		vi.stubGlobal("cancelAnimationFrame", (id: number) => {
			pendingFrames.delete(id);
		});
		setDocumentHidden(false);
		document.body.innerHTML = "<span id='magic'>hello</span>";
		el = document.getElementById("magic")!;
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		Reflect.deleteProperty(document, "hidden");
	});

	const bind = () => bindMagicalText(el, { colors: ["#ff0000", "#0000ff"], adornment: "star", adornmentCount: 2 });

	it("runs while the element is on screen and the document is visible", () => {
		const cleanup = bind();
		expect(pendingFrames.size).toBe(1);

		runFrame(performance.now() + 16);

		expect(pendingFrames.size).toBe(1);
		expect(el.querySelector("[data-sparkle-path]")?.getAttribute("fill")).toMatch(/^rgb\(/);
		cleanup();
	});

	it("pauses when the element scrolls offscreen and resumes when it returns", () => {
		const cleanup = bind();

		observerCallback!([{ isIntersecting: false }]);
		expect(pendingFrames.size).toBe(0);

		observerCallback!([{ isIntersecting: true }]);
		expect(pendingFrames.size).toBe(1);
		cleanup();
	});

	it("pauses while the document is hidden and resumes when it is shown", () => {
		const cleanup = bind();

		setDocumentHidden(true);
		expect(pendingFrames.size).toBe(0);

		setDocumentHidden(false);
		expect(pendingFrames.size).toBe(1);
		cleanup();
	});

	it("stays paused when shown again while still offscreen", () => {
		const cleanup = bind();

		observerCallback!([{ isIntersecting: false }]);
		setDocumentHidden(true);
		setDocumentHidden(false);

		expect(pendingFrames.size).toBe(0);
		cleanup();
	});

	it("never schedules more than one frame at a time", () => {
		const cleanup = bind();

		observerCallback!([{ isIntersecting: true }]);
		setDocumentHidden(false);

		expect(pendingFrames.size).toBe(1);
		cleanup();
	});

	it("stops the loop, the observer and the visibility listener on cleanup", () => {
		const cleanup = bind();

		cleanup();

		expect(pendingFrames.size).toBe(0);
		expect(disconnect).toHaveBeenCalledTimes(1);
		setDocumentHidden(true);
		setDocumentHidden(false);
		expect(pendingFrames.size).toBe(0);
		expect(el.innerHTML).toBe("hello");
	});

	it("does not start a loop for adornments that are not color tracked", () => {
		const cleanup = bindMagicalText(el, { colors: ["#ff0000", "#0000ff"], adornment: "ghost" });

		expect(pendingFrames.size).toBe(0);
		expect(observerCallback).toBeNull();
		cleanup();
	});
});
