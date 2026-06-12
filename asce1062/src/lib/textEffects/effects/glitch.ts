import type { EffectRendererHandle, GlitchBurstEffectOptions } from "../types";
import { DEFAULT_GLITCH_BURST_TOTAL_FRAMES, DEFAULT_GLITCH_BURST_INTENSITY } from "../constants";
import { resolveTextEffectDurationMs, resolveGlitchCharsetStr } from "../utils";

export function runGlitchRenderer(
	el: HTMLElement,
	text: string,
	options: GlitchBurstEffectOptions = {}
): EffectRendererHandle {
	const {
		intensity = DEFAULT_GLITCH_BURST_INTENSITY,
		frameCount = DEFAULT_GLITCH_BURST_TOTAL_FRAMES,
		charset = "blocks",
		durationMs,
	} = options;

	const charsetStr = resolveGlitchCharsetStr(charset);
	const totalFrames = Math.max(3, frameCount);
	const totalDuration = durationMs ?? resolveTextEffectDurationMs("glitch", text);
	const frameInterval = totalDuration / totalFrames;
	const clampedIntensity = Math.min(1, Math.max(0, intensity));

	let frame = 0;
	let resolvePromise: () => void = () => {};
	let settled = false;
	const promise = new Promise<void>((resolve) => {
		resolvePromise = resolve;
	});

	const intervalId = globalThis.setInterval(() => {
		el.textContent = text
			.split("")
			.map((char) => {
				if (/\s/.test(char)) return char;
				return Math.random() < clampedIntensity
					? (charsetStr[Math.floor(Math.random() * charsetStr.length)] ?? char)
					: char;
			})
			.join("");

		frame += 1;

		if (frame >= totalFrames) {
			globalThis.clearInterval(intervalId);
			if (settled) return;
			settled = true;
			el.textContent = text;
			resolvePromise();
		}
	}, frameInterval);

	return {
		promise,
		cancel: () => {
			if (settled) return;
			settled = true;
			globalThis.clearInterval(intervalId);
			resolvePromise();
		},
	};
}
