import { describe, expect, it } from "vitest";
import { EFFECT_COOLDOWN_MS, chooseTransitionEffect, type NavBrandEffect } from "@/lib/navBrand/state";

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
