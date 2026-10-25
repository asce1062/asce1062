// @vitest-environment jsdom
/**
 * The music visualizer is mounted on every page load while the player is
 * closed. Mounting must insert its grid in one DOM operation and start no
 * loop until the player is shown.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AsciiVisualizerController } from "@/lib/asciiVisualizer";

function stubMatchMedia(reducedMotion: boolean): void {
	vi.stubGlobal(
		"matchMedia",
		vi.fn(() => ({ matches: reducedMotion, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
	);
}

describe("AsciiVisualizerController.mount", () => {
	let container: HTMLElement;
	let controller: AsciiVisualizerController;

	beforeEach(() => {
		vi.useFakeTimers();
		stubMatchMedia(false);
		container = document.createElement("div");
		document.body.appendChild(container);
		controller = new AsciiVisualizerController();
	});

	afterEach(() => {
		controller.teardown();
		container.remove();
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it("builds the 12x32 grid with a single insertion into the page", () => {
		const observer = new MutationObserver(() => {});
		observer.observe(container, { childList: true, subtree: true });

		controller.setVisible(false);
		controller.mount(container);
		const insertions = observer.takeRecords().filter((record) => record.addedNodes.length > 0);
		observer.disconnect();

		expect(container.children).toHaveLength(12);
		expect(container.children[0].children).toHaveLength(32);
		expect(insertions).toHaveLength(1);
	});

	it("starts no animation loop while hidden", () => {
		controller.setVisible(false);
		controller.mount(container);

		expect(vi.getTimerCount()).toBe(0);
	});

	it("starts the idle loop when mounted visible, and stops it when hidden", () => {
		controller.mount(container);
		expect(vi.getTimerCount()).toBe(1);

		controller.setVisible(false);
		expect(vi.getTimerCount()).toBe(0);
	});

	it("draws the static frame instead of a loop under reduced motion", () => {
		stubMatchMedia(true);
		controller.mount(container);

		expect(vi.getTimerCount()).toBe(0);
		expect(container.textContent?.trim()).not.toBe("");
	});
});
