import type { EffectRendererHandle } from "../types";
import { DECRYPT_CHARS, DEFAULT_DECRYPT_TOTAL_FRAMES } from "../constants";
import { createIntervalRenderer, resolveTextEffectDurationMs, splitGraphemes } from "../utils";

export function runDecryptEnterRenderer(el: HTMLElement, text: string, durationMs?: number): EffectRendererHandle {
	const totalFrames = DEFAULT_DECRYPT_TOTAL_FRAMES;
	const totalDuration = durationMs ?? resolveTextEffectDurationMs("decrypt", text);
	const chars = splitGraphemes(text);

	return createIntervalRenderer({
		frames: totalFrames,
		intervalMs: totalDuration / totalFrames,
		render: (frame) => {
			const resolved = Math.floor((frame / totalFrames) * chars.length);

			el.textContent = chars
				.map((char, i) => {
					if (/\s/.test(char)) return char;
					if (i < resolved) return char;
					return DECRYPT_CHARS[Math.floor(Math.random() * DECRYPT_CHARS.length)];
				})
				.join("");
		},
		complete: () => {
			el.textContent = text;
		},
	});
}
