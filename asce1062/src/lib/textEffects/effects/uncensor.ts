import type { EffectRendererHandle, UncensorEffectOptions } from "../types";
import { DEFAULT_CENSOR_CHAR } from "../constants";
import { createIntervalRenderer, resolveTextEffectDurationMs, splitGraphemes } from "../utils";

export function runUncensorRenderer(
	el: HTMLElement,
	text: string,
	options: UncensorEffectOptions = {}
): EffectRendererHandle {
	const { fillChar = DEFAULT_CENSOR_CHAR, delayMs, durationMs } = options;
	const chars = splitGraphemes(text);
	const nonSpaceIndices = chars.map((c, i) => (/\s/.test(c) ? null : i)).filter((i): i is number => i !== null);
	const nonSpaceCount = Math.max(1, nonSpaceIndices.length);
	const totalDuration = durationMs ?? resolveTextEffectDurationMs("uncensor", text);
	const stepMs = delayMs ?? totalDuration / nonSpaceCount;

	const working = chars.map((c) => (/\s/.test(c) ? c : fillChar));
	el.textContent = working.join("");

	return createIntervalRenderer({
		frames: nonSpaceCount,
		intervalMs: stepMs,
		render: (step) => {
			const idx = nonSpaceIndices[step];
			if (idx !== undefined) working[idx] = chars[idx] ?? fillChar;
			el.textContent = working.join("");
		},
		complete: () => {
			el.textContent = text;
		},
	});
}
