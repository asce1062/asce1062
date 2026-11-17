import type { EffectRendererHandle } from "../types";
import { DECRYPT_CHARS, DEFAULT_ENTROPY_TOTAL_FRAMES } from "../constants";
import { createIntervalRenderer, resolveTextEffectDurationMs, splitGraphemes } from "../utils";

export function runEntropyExitRenderer(el: HTMLElement, text: string, durationMs?: number): EffectRendererHandle {
	const totalFrames = DEFAULT_ENTROPY_TOTAL_FRAMES;
	const totalDuration = durationMs ?? resolveTextEffectDurationMs("entropy", text);
	const chars = splitGraphemes(text);

	return createIntervalRenderer({
		frames: totalFrames,
		intervalMs: totalDuration / totalFrames,
		render: (frame) => {
			const entropyRatio = frame / totalFrames;
			const keepCount = Math.max(0, Math.floor((1 - entropyRatio) * chars.length));

			el.textContent = chars
				.map((char, i) => {
					if (/\s/.test(char)) return char;
					if (i < keepCount) return char;
					return DECRYPT_CHARS[Math.floor(Math.random() * DECRYPT_CHARS.length)];
				})
				.join("");
		},
		complete: () => {
			el.textContent = "";
		},
	});
}
