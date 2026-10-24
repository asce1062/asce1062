import { afterEach, describe, expect, it, vi } from "vitest";
import type { EffectRendererHandle } from "@/lib/textEffects/types";
import { pickRandomGrapheme, renderTypingFrame, splitGraphemes } from "@/lib/textEffects/utils";
import { runTypingEnterRenderer } from "@/lib/textEffects/effects/typing";
import { runBackspaceExitRenderer } from "@/lib/textEffects/effects/backspace";
import { runCorruptionRenderer } from "@/lib/textEffects/effects/corruption";
import { runCensorRenderer } from "@/lib/textEffects/effects/censor";
import { runDecryptEnterRenderer } from "@/lib/textEffects/effects/decrypt";
import { runEntropyExitRenderer } from "@/lib/textEffects/effects/entropy";
import { runGlitchRenderer } from "@/lib/textEffects/effects/glitch";
import { runGlitchLockOnEnterRenderer } from "@/lib/textEffects/effects/glitchLockOn";
import { runScrambleRenderer } from "@/lib/textEffects/effects/scramble";
import { runShuffleRenderer } from "@/lib/textEffects/effects/shuffle";
import { runSignalLossExitRenderer } from "@/lib/textEffects/effects/signalLoss";
import { runSlowRevealRenderer } from "@/lib/textEffects/effects/slowReveal";
import { runTypewriterRenderer } from "@/lib/textEffects/effects/typewriter";
import { runUncensorRenderer } from "@/lib/textEffects/effects/uncensor";

// 🔥 is a surrogate pair; 👩‍💻 is a ZWJ sequence of two surrogate pairs.
const EMOJI_TEXT = "set the page on fire 🔥 👩‍💻!";
const EMOJI_ITEMS = ["🔥", "👾"];

const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
const SPLIT_ZWJ_SEQUENCE = /\u{1F469}(?!‍\u{1F4BB})|(?<!\u{1F469})‍/u;

/** Mock element that records every textContent write a renderer makes. */
function createRecordingElement(): { el: HTMLElement; frames: string[] } {
	const frames: string[] = [];
	let value = "";
	const target = new EventTarget() as HTMLElement & EventTarget;
	Object.defineProperty(target, "textContent", {
		get: () => value,
		set: (next: string) => {
			value = next;
			frames.push(next);
		},
	});
	Object.defineProperty(target, "dataset", { value: {} as DOMStringMap, writable: true });
	return { el: target, frames };
}

async function runToCompletion(handle: EffectRendererHandle): Promise<void> {
	let done = false;
	void handle.promise.then(() => {
		done = true;
	});
	for (let i = 0; i < 5000 && !done; i++) {
		await vi.advanceTimersByTimeAsync(10);
	}
	handle.cancel();
	expect(done).toBe(true);
}

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

describe("splitGraphemes", () => {
	it("keeps surrogate pairs whole", () => {
		expect(splitGraphemes("a🔥b")).toEqual(["a", "🔥", "b"]);
	});

	it("keeps ZWJ sequences, flags, and combining marks whole", () => {
		expect(splitGraphemes("👩‍💻🇰🇪é")).toEqual(["👩‍💻", "🇰🇪", "é"]);
	});

	it("returns an empty array for empty text", () => {
		expect(splitGraphemes("")).toEqual([]);
	});
});

describe("pickRandomGrapheme", () => {
	it("returns whole graphemes from a charset string", () => {
		vi.spyOn(Math, "random").mockReturnValue(0.99);
		expect(pickRandomGrapheme(["🔥", "👾"])).toBe("👾");
	});

	it("returns undefined for an empty charset", () => {
		expect(pickRandomGrapheme([])).toBeUndefined();
	});
});

describe("renderTypingFrame", () => {
	it("counts visible length in graphemes", () => {
		expect(renderTypingFrame("on 🔥!", 4, false)).toBe("on 🔥");
		expect(renderTypingFrame("on 🔥!", 4, true, "|")).toBe("on 🔥|");
	});
});

const RENDERERS: [string, (el: HTMLElement) => EffectRendererHandle][] = [
	["typing", (el) => runTypingEnterRenderer(el, EMOJI_TEXT, { leadInMs: 0 })],
	["backspace", (el) => runBackspaceExitRenderer(el, EMOJI_TEXT)],
	["corruption", (el) => runCorruptionRenderer(el, EMOJI_TEXT, { items: EMOJI_ITEMS, intensity: 1 })],
	["censor", (el) => runCensorRenderer(el, EMOJI_TEXT, { fillChar: EMOJI_ITEMS })],
	["decrypt", (el) => runDecryptEnterRenderer(el, EMOJI_TEXT)],
	["entropy", (el) => runEntropyExitRenderer(el, EMOJI_TEXT)],
	["glitch", (el) => runGlitchRenderer(el, EMOJI_TEXT, { items: EMOJI_ITEMS, shimmer: false })],
	["glitch-lock-on", (el) => runGlitchLockOnEnterRenderer(el, EMOJI_TEXT, { charset: "🔥👾" })],
	["scramble", (el) => runScrambleRenderer(el, EMOJI_TEXT, { items: EMOJI_ITEMS })],
	["shuffle", (el) => runShuffleRenderer(el, EMOJI_TEXT)],
	["signal-loss", (el) => runSignalLossExitRenderer(el, EMOJI_TEXT, { dropoutChar: "🔥" })],
	["slow-reveal", (el) => runSlowRevealRenderer(el, EMOJI_TEXT, { items: EMOJI_ITEMS })],
	["typewriter", (el) => runTypewriterRenderer(el, EMOJI_TEXT, { stutterChance: 0 })],
	["typewriter cycle", (el) => runTypewriterRenderer(el, "", { cycle: ["or 🔥", EMOJI_TEXT], stutterChance: 0 })],
	["uncensor", (el) => runUncensorRenderer(el, EMOJI_TEXT, { fillChar: "👾" })],
];

describe("text effect renderers never split a grapheme", () => {
	it.each(RENDERERS)("%s", async (_name, run) => {
		vi.useFakeTimers();
		const { el, frames } = createRecordingElement();

		await runToCompletion(run(el));

		expect(frames.length).toBeGreaterThan(1);
		for (const frame of frames) {
			expect(frame).not.toMatch(LONE_SURROGATE);
			expect(frame).not.toMatch(SPLIT_ZWJ_SEQUENCE);
		}
	});
});
