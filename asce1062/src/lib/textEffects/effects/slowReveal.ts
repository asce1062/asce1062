import type { EffectRendererHandle, SlowRevealEffectOptions } from "../types";
import { DEFAULT_SLOW_REVEAL_CYCLES_PER_CHAR, DEFAULT_SCRAMBLE_ITEMS } from "../constants";
import {
	resolveTextEffectDurationMs,
	resolveGlitchCharsetStr,
	createTimeoutRenderer,
	splitGraphemes,
	pickRandomGrapheme,
} from "../utils";

export function runSlowRevealRenderer(
	el: HTMLElement,
	text: string,
	options: SlowRevealEffectOptions = {}
): EffectRendererHandle {
	const {
		cyclesPerChar = DEFAULT_SLOW_REVEAL_CYCLES_PER_CHAR,
		charset = "blocks",
		items,
		delayMs,
		durationMs,
	} = options;

	const glyphs = splitGraphemes(
		items ? items.join("") : charset === "blocks" ? DEFAULT_SCRAMBLE_ITEMS.join("") : resolveGlitchCharsetStr(charset)
	);

	const chars = splitGraphemes(text);
	const nonSpacePositions = chars.map((c, i) => ({ c, i })).filter(({ c }) => !/\s/.test(c));
	const totalDuration = durationMs ?? resolveTextEffectDurationMs("slow-reveal", text);
	const stepsTotal = Math.max(1, nonSpacePositions.length) * (cyclesPerChar + 1);
	const stepMs = delayMs ?? totalDuration / stepsTotal;

	return createTimeoutRenderer((schedule, finish) => {
		const working = chars.map((c) => (/\s/.test(c) ? c : (pickRandomGrapheme(glyphs) ?? c)));
		el.textContent = working.join("");

		let posIdx = 0;
		let cycleCount = 0;

		const tick = () => {
			if (posIdx >= nonSpacePositions.length) {
				el.textContent = text;
				finish();
				return;
			}

			const entry = nonSpacePositions[posIdx]!;

			if (cycleCount < cyclesPerChar) {
				working[entry.i] = pickRandomGrapheme(glyphs) ?? entry.c;
				el.textContent = working.join("");
				cycleCount++;
				schedule(tick, stepMs);
			} else {
				working[entry.i] = entry.c;
				el.textContent = working.join("");
				cycleCount = 0;
				posIdx++;
				schedule(tick, stepMs);
			}
		};

		schedule(tick, stepMs);
	});
}
