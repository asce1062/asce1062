import { afterEach, describe, expect, it, vi } from "vitest";
import { playNavBrandEffect } from "@/lib/navBrand/effects";
import { EFFECT_COOLDOWN_MS, chooseTransitionEffect, type NavBrandEffect } from "@/lib/navBrand/state";

function createMockEffectElement(text = ""): HTMLElement {
	const target = new EventTarget() as HTMLElement & EventTarget;
	target.textContent = text;
	Object.defineProperty(target, "dataset", {
		value: {
			greetingTarget: text,
			textEffectStableText: text,
		} as DOMStringMap,
		writable: true,
	});
	return target;
}

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

describe("chooseTransitionEffect", () => {
	it("returns none when reduced motion is enabled", () => {
		expect(
			chooseTransitionEffect({
				fromState: "active",
				toState: "return",
				tone: "normal",
				reducedMotion: true,
				lastEffectTs: 0,
				now: 100_000,
				randomValue: 0,
				decryptRandomValue: 0,
			})
		).toBe<NavBrandEffect>("none");
	});

	it("returns none when the effect cooldown has not elapsed", () => {
		expect(
			chooseTransitionEffect({
				fromState: "idle",
				toState: "active",
				tone: "normal",
				reducedMotion: false,
				lastEffectTs: 100_000 - EFFECT_COOLDOWN_MS + 1,
				now: 100_000,
				randomValue: 0,
				decryptRandomValue: 0,
			})
		).toBe("none");
	});

	it("returns none for non-meaningful transitions", () => {
		expect(
			chooseTransitionEffect({
				fromState: "active",
				toState: "active",
				tone: "normal",
				reducedMotion: false,
				lastEffectTs: 0,
				now: 100_000,
				randomValue: 0,
				decryptRandomValue: 0,
			})
		).toBe("none");
	});

	it("uses typing for meaningful transitions when the effect chance passes", () => {
		expect(
			chooseTransitionEffect({
				fromState: "idle",
				toState: "active",
				tone: "normal",
				reducedMotion: false,
				lastEffectTs: 0,
				now: 100_000,
				randomValue: 0,
				decryptRandomValue: 0.99,
			})
		).toBe("typing");
	});

	it("uses decrypt for rare system transitions when decrypt chance passes", () => {
		expect(
			chooseTransitionEffect({
				fromState: "active",
				toState: "system",
				tone: "rare",
				reducedMotion: false,
				lastEffectTs: 0,
				now: 100_000,
				randomValue: 0,
				decryptRandomValue: 0,
			})
		).toBe("decrypt");
	});
});

describe("playNavBrandEffect", () => {
	it("uses a paired full transition instead of reset-then-reveal", async () => {
		vi.useFakeTimers();
		vi.spyOn(Math, "random").mockReturnValue(0);
		const el = createMockEffectElement("alex");
		const rootEl = createMockEffectElement();

		expect(
			playNavBrandEffect({
				el,
				rootEl,
				effect: "typing",
				text: "engineer",
			})
		).toBe(true);

		vi.advanceTimersByTime(120);
		expect(el.textContent).not.toBe("engineer");
		expect(rootEl.dataset.navbrandEffect).toBe("backspace");

		await vi.runAllTimersAsync();
		expect(el.textContent).toBe("engineer");
		expect(el.dataset.textEffectStableText).toBe("engineer");
		expect(rootEl.dataset.navbrandEffect).toBe("none");
	});
});
