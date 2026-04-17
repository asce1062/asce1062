import { describe, expect, it } from "vitest";
import {
	DEFAULT_TERMINAL_TEXT_EFFECT_TRIGGERS,
	normalizeTerminalTextEffectTriggers,
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
});

describe("shouldHandleTerminalTextEffectTrigger", () => {
	it("matches configured triggers", () => {
		expect(shouldHandleTerminalTextEffectTrigger(["load", "hover"], "hover")).toBe(true);
		expect(shouldHandleTerminalTextEffectTrigger(["load", "hover"], "tap")).toBe(false);
	});
});
