// @vitest-environment jsdom
/**
 * Soft navigation swaps most of <body>. Trigger bindings on swapped-out
 * elements must be released, or every navigation leaves behind document
 * listeners, observers and self-rescheduling timers that keep playing effects
 * on detached nodes.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bindTextEffectTriggers } from "@/lib/textEffects/textEffect";
import { releaseDetachedTriggerBindings } from "@/lib/textEffects/activeEffects";

class NoopIntersectionObserver {
	observe() {}
	unobserve() {}
	disconnect() {}
	takeRecords() {
		return [];
	}
}

function bindEverything(el: HTMLElement): void {
	bindTextEffectTriggers({
		el,
		effects: ["scramble"],
		triggers: ["resume", "route-enter", "idle-return", "intersection", "random-time", "random-interval"],
		randomIntervalMs: 1_000,
	} as Parameters<typeof bindTextEffectTriggers>[0]);
}

describe("text effect trigger lifecycle", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.stubGlobal("IntersectionObserver", NoopIntersectionObserver);
		vi.stubGlobal(
			"matchMedia",
			vi.fn(() => ({ matches: true, addEventListener() {}, removeEventListener() {} }))
		);
		document.body.innerHTML = "";
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("releases timers and document listeners of elements removed by a swap", () => {
		const added = vi.spyOn(document, "addEventListener");
		const removed = vi.spyOn(document, "removeEventListener");
		const el = document.createElement("p");
		el.textContent = "hello world";
		document.body.append(el);

		bindEverything(el);
		const documentListeners = added.mock.calls.length;
		expect(vi.getTimerCount()).toBeGreaterThan(0);

		el.remove(); // what a soft navigation does to non-persisted nodes
		releaseDetachedTriggerBindings();

		expect(vi.getTimerCount()).toBe(0);
		expect(removed.mock.calls.length).toBeGreaterThanOrEqual(documentListeners);
	});

	it("keeps bindings of elements that are still connected (persisted)", () => {
		const el = document.createElement("p");
		el.textContent = "still here";
		document.body.append(el);
		bindEverything(el);
		const timers = vi.getTimerCount();

		releaseDetachedTriggerBindings();

		expect(vi.getTimerCount()).toBe(timers);
	});
});

describe("glitch shimmer", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("can be stopped after the reveal resolves, and stops itself when detached", async () => {
		const { runGlitchRenderer } = await import("@/lib/textEffects/effects/glitch");
		const { clearActiveEffect } = await import("@/lib/textEffects/activeEffects");
		const el = document.createElement("p");
		document.body.append(el);

		const handle = runGlitchRenderer(el, "signal found", { delayMs: 10, count: 2, shimmerIntervalMs: 50 });
		await vi.advanceTimersByTimeAsync(500);
		await handle.promise;
		expect(vi.getTimerCount()).toBeGreaterThan(0); // shimmer still running after resolve

		clearActiveEffect(el);
		expect(vi.getTimerCount()).toBe(0);

		const detached = document.createElement("p");
		document.body.append(detached);
		const second = runGlitchRenderer(detached, "signal found", { delayMs: 10, count: 2, shimmerIntervalMs: 50 });
		await vi.advanceTimersByTimeAsync(500);
		await second.promise;
		detached.remove();
		await vi.advanceTimersByTimeAsync(2_000);
		expect(vi.getTimerCount()).toBe(0);
	});
});
