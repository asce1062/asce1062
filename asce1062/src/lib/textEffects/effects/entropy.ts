import type { EffectRendererHandle } from "../types";
import { DECRYPT_CHARS, DEFAULT_ENTROPY_TOTAL_FRAMES } from "../constants";
import { resolveTerminalTextEffectDurationMs } from "../utils";

export function runEntropyExitRenderer(el: HTMLElement, text: string, durationMs?: number): EffectRendererHandle {
	const totalFrames = DEFAULT_ENTROPY_TOTAL_FRAMES;
	const totalDuration = durationMs ?? resolveTerminalTextEffectDurationMs("entropy", text);
	const frameInterval = totalDuration / totalFrames;
	let frame = 0;
	let resolvePromise: () => void = () => {};
	let settled = false;
	const promise = new Promise<void>((resolve) => {
		resolvePromise = resolve;
	});
	const intervalId = globalThis.setInterval(() => {
		const entropyRatio = frame / totalFrames;
		const keepCount = Math.max(0, Math.floor((1 - entropyRatio) * text.length));

		el.textContent = text
			.split("")
			.map((char, i) => {
				if (char === " ") return char;
				if (i < keepCount) return char;
				return DECRYPT_CHARS[Math.floor(Math.random() * DECRYPT_CHARS.length)];
			})
			.join("");

		frame += 1;

		if (frame >= totalFrames) {
			globalThis.clearInterval(intervalId);
			if (settled) return;
			settled = true;
			el.textContent = "";
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
