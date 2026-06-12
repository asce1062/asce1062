import type { EffectRendererHandle, ScrambleEffectOptions } from "../types";
import { DEFAULT_SCRAMBLE_COUNT } from "../constants";
import { resolveTextEffectDurationMs, resolveGlitchCharsetStr } from "../utils";

export function runScrambleRenderer(
	el: HTMLElement,
	text: string,
	options: ScrambleEffectOptions = {}
): EffectRendererHandle {
	const { count = DEFAULT_SCRAMBLE_COUNT, charset = "blocks", durationMs } = options;
	const charsetStr = resolveGlitchCharsetStr(charset);
	const totalDuration = durationMs ?? resolveTextEffectDurationMs("scramble", text);
	const stepMs = totalDuration / Math.max(1, count);

	// Work array — mutations accumulate each tick (progressively noisier).
	const working = text.split("");
	const nonSpaceIndices = working.map((_, i) => i).filter((i) => !/\s/.test(text[i] ?? ""));

	let frame = 0;
	let resolvePromise: () => void = () => {};
	let settled = false;
	const promise = new Promise<void>((resolve) => {
		resolvePromise = resolve;
	});

	const intervalId = globalThis.setInterval(() => {
		if (nonSpaceIndices.length > 0) {
			const idx = nonSpaceIndices[Math.floor(Math.random() * nonSpaceIndices.length)]!;
			working[idx] = charsetStr[Math.floor(Math.random() * charsetStr.length)] ?? working[idx] ?? "_";
		}
		el.textContent = working.join("");

		frame += 1;

		if (frame >= count) {
			globalThis.clearInterval(intervalId);
			if (settled) return;
			settled = true;
			el.textContent = text;
			resolvePromise();
		}
	}, stepMs);

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
