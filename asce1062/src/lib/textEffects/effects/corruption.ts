import type { EffectRendererHandle, CorruptionEffectOptions } from "../types";
import { DEFAULT_CORRUPTION_COUNT, DEFAULT_CORRUPTION_INTENSITY, DEFAULT_CORRUPTION_ITEMS } from "../constants";
import {
	createIntervalRenderer,
	resolveTextEffectDurationMs,
	resolveGlitchCharsetStr,
	splitGraphemes,
	pickRandomGrapheme,
} from "../utils";

export function runCorruptionRenderer(
	el: HTMLElement,
	text: string,
	options: CorruptionEffectOptions = {}
): EffectRendererHandle {
	const {
		intensity = DEFAULT_CORRUPTION_INTENSITY,
		count = DEFAULT_CORRUPTION_COUNT,
		charset = "blocks",
		items,
		delayMs,
		restore = true,
		durationMs,
	} = options;

	const glyphs = splitGraphemes(
		items ? items.join("") : charset === "blocks" ? DEFAULT_CORRUPTION_ITEMS.join("") : resolveGlitchCharsetStr(charset)
	);
	const chars = splitGraphemes(text);
	const totalCount = Math.max(3, count);
	const totalDuration = durationMs ?? resolveTextEffectDurationMs("corruption", text);
	const stepMs = delayMs ?? totalDuration / totalCount;
	const clampedIntensity = Math.min(1, Math.max(0, intensity));

	return createIntervalRenderer({
		frames: totalCount,
		intervalMs: stepMs,
		render: () => {
			el.textContent = chars
				.map((char) => {
					if (/\s/.test(char)) return char;
					return Math.random() < clampedIntensity ? (pickRandomGrapheme(glyphs) ?? char) : char;
				})
				.join("");
		},
		complete: () => {
			if (restore) el.textContent = text;
		},
	});
}
