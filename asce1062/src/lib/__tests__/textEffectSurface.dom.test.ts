// @vitest-environment jsdom
/**
 * Effects rewrite text many times a second. Screen readers must read the
 * settled text, never the frames: effects draw into an aria-hidden frame while
 * a visually hidden label holds the stable text.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	bindTextEffectTriggers,
	playTextEffect,
	readTextEffectText,
	resetTextEffect,
	runTextTransition,
	writeTextEffectText,
} from "@/lib/textEffects/textEffect";
import { clearActiveEffect } from "@/lib/textEffects/activeEffects";

function host(text: string): HTMLElement {
	const el = document.createElement("span");
	el.textContent = text;
	document.body.append(el);
	return el;
}

const frameOf = (el: HTMLElement) => el.querySelector<HTMLElement>(":scope > [data-text-effect-frame]");
const labelOf = (el: HTMLElement) => el.querySelector<HTMLElement>(":scope > [data-text-effect-label]");

function stubReducedMotion(reduce: boolean): void {
	vi.stubGlobal(
		"matchMedia",
		vi.fn(() => ({ matches: reduce, addEventListener() {}, removeEventListener() {} }))
	);
}

describe("text effect screen-reader surface", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		stubReducedMotion(false);
		document.body.innerHTML = "";
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it("animates an aria-hidden frame while the label holds the settled text", async () => {
		const el = host("restoring context");

		playTextEffect({ el, effect: "scramble", text: "restoring context" });
		await vi.advanceTimersByTimeAsync(40);

		const frame = frameOf(el)!;
		expect(frame.getAttribute("aria-hidden")).toBe("true");
		expect(frame.textContent).not.toBe("restoring context"); // mid-scramble
		expect(labelOf(el)!.className).toBe("sr-only");
		expect(labelOf(el)!.textContent).toBe("restoring context");

		await vi.runAllTimersAsync();
		expect(frame.textContent).toBe("restoring context");
		expect(labelOf(el)!.textContent).toBe("restoring context");
	});

	it("labels a changing text with its destination as soon as the transition starts", async () => {
		const el = host("alex");

		playTextEffect({ el, effect: "typing", text: "engineer" });
		await vi.advanceTimersByTimeAsync(20);

		expect(labelOf(el)!.textContent).toBe("engineer");
		expect(frameOf(el)!.textContent).not.toBe("engineer");
		await vi.runAllTimersAsync();
		expect(readTextEffectText(el)).toBe("engineer");
	});

	it("restores a lost label without nesting the frame", async () => {
		const el = host("hello");
		playTextEffect({ el, effect: "scramble", text: "hello" });
		await vi.runAllTimersAsync();
		labelOf(el)!.remove();

		playTextEffect({ el, effect: "scramble", text: "hello" });
		await vi.runAllTimersAsync();

		expect(el.querySelectorAll("[data-text-effect-frame]")).toHaveLength(1);
		expect(labelOf(el)!.textContent).toBe("hello");
		expect(frameOf(el)!.textContent).toBe("hello");
	});

	it("keeps plain text under reduced motion", () => {
		stubReducedMotion(true);
		const el = host("alex");

		playTextEffect({ el, effect: "decrypt", text: "engineer" });

		expect(el.children).toHaveLength(0);
		expect(el.textContent).toBe("engineer");
	});

	it("reset settles both frame and label", async () => {
		const el = host("hello");
		playTextEffect({ el, effect: "scramble", text: "hello" });
		await vi.advanceTimersByTimeAsync(40);

		resetTextEffect(el);

		expect(frameOf(el)!.textContent).toBe("hello");
		expect(labelOf(el)!.textContent).toBe("hello");
	});

	it("keeps a looping typewriter labelled with its stable text", async () => {
		const el = host("Looks like you're lost.");

		void runTextTransition({
			el,
			toText: "Looks like you're lost.",
			mode: "standalone",
			effect: "typewriter",
			typewriterOptions: { cycle: ["or not...", "set the page on fire"], loop: true, delayMs: 10 },
		});
		await vi.advanceTimersByTimeAsync(5_000);

		expect(labelOf(el)!.textContent).toBe("Looks like you're lost.");
		expect(frameOf(el)!.getAttribute("aria-hidden")).toBe("true");
		clearActiveEffect(el);
	});

	it("content-change reads the visible text, not text plus label", async () => {
		const el = host("[ carrier search... ]");
		bindTextEffectTriggers({ el, effects: ["decrypt"], triggers: ["content-change"] });
		playTextEffect({ el, effect: "decrypt", text: "[ carrier search... ]" });
		await vi.runAllTimersAsync();

		// What the music player does on a new signal
		resetTextEffect(el);
		el.dataset.textEffectStableText = "[ signal locked ]";
		writeTextEffectText(el, "[ signal locked ]");
		await vi.runAllTimersAsync();

		expect(readTextEffectText(el)).toBe("[ signal locked ]");
		expect(labelOf(el)!.textContent).toBe("[ signal locked ]");
	});

	it("stops the glitch shimmer, which runs on the frame, when the host is cleared", async () => {
		const el = host("nothing here");
		void runTextTransition({
			el,
			toText: "nothing here",
			mode: "standalone",
			effect: "glitch",
			glitchOptions: { shimmer: true, shimmerIntervalMs: 50, delayMs: 5 },
		});
		await vi.advanceTimersByTimeAsync(2_000);
		expect(vi.getTimerCount()).toBeGreaterThan(0); // the shimmer is running

		clearActiveEffect(el);
		expect(vi.getTimerCount()).toBe(0);
	});
});
