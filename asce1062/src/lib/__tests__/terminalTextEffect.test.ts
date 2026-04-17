import { describe, expect, it } from "vitest";
import {
	DEFAULT_TERMINAL_TEXT_EFFECT_TRIGGERS,
	normalizeTerminalTextEffectTriggers,
	readTerminalTextEffectConfig,
	resolveTerminalTextEffectKind,
	shouldHandleTerminalTextEffectTrigger,
} from "@/lib/textEffects/terminalTextEffect";

describe("normalizeTerminalTextEffectTriggers", () => {
	it("uses the default triggers when none are provided", () => {
		expect(normalizeTerminalTextEffectTriggers()).toEqual(DEFAULT_TERMINAL_TEXT_EFFECT_TRIGGERS);
	});

	it("deduplicates triggers while preserving order", () => {
		expect(normalizeTerminalTextEffectTriggers(["hover", "tap", "hover", "manual"])).toEqual([
			"hover",
			"tap",
			"manual",
		]);
	});

	it("supports the expanded trigger vocabulary", () => {
		expect(
			normalizeTerminalTextEffectTriggers(["load", "click", "tap", "random-effect", "random-time", "click"])
		).toEqual(["load", "click", "tap", "random-effect", "random-time"]);
	});
});

describe("shouldHandleTerminalTextEffectTrigger", () => {
	it("matches configured triggers", () => {
		expect(shouldHandleTerminalTextEffectTrigger(["load", "hover"], "hover")).toBe(true);
		expect(shouldHandleTerminalTextEffectTrigger(["load", "hover"], "tap")).toBe(false);
	});
});

describe("resolveTerminalTextEffectKind", () => {
	it("returns the first declared effect when not using random-effect", () => {
		expect(resolveTerminalTextEffectKind(["decrypt"], false, 0.9)).toBe("decrypt");
		expect(resolveTerminalTextEffectKind(["typing", "decrypt"], false, 0.1)).toBe("typing");
	});

	it("randomizes across the declared effect list when random-effect is enabled", () => {
		expect(resolveTerminalTextEffectKind(["typing", "decrypt"], true, 0.1)).toBe("typing");
		expect(resolveTerminalTextEffectKind(["typing", "decrypt"], true, 0.9)).toBe("decrypt");
	});

	it("falls back to the first effect when random-effect has only one candidate", () => {
		expect(resolveTerminalTextEffectKind(["decrypt"], true, 0.9)).toBe("decrypt");
	});
});

describe("readTerminalTextEffectConfig", () => {
	it("parses effect config from dataset attributes", () => {
		const el = {
			dataset: {
				textEffect: "typing, decrypt",
				textEffectTriggers: "load, hover, click, random-effect, random-time",
				textEffectIntervalMs: "18000",
			},
		} as unknown as HTMLElement;

		expect(readTerminalTextEffectConfig(el)).toEqual({
			effects: ["typing", "decrypt"],
			triggers: ["load", "hover", "click", "random-effect", "random-time"],
			randomIntervalMs: 18_000,
		});
	});

	it("returns null when the dataset does not define an effect", () => {
		const el = {
			dataset: {},
		} as unknown as HTMLElement;

		expect(readTerminalTextEffectConfig(el)).toBeNull();
	});
});
