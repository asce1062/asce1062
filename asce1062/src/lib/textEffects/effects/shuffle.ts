import type { EffectRendererHandle, ShuffleEffectOptions } from "../types";
import { DEFAULT_SHUFFLE_COUNT } from "../constants";
import { resolveTextEffectDurationMs } from "../utils";

export function runShuffleRenderer(
	el: HTMLElement,
	text: string,
	options: ShuffleEffectOptions = {}
): EffectRendererHandle {
	const { count = DEFAULT_SHUFFLE_COUNT, durationMs } = options;
	const chars = text.split("");
	const totalDuration = durationMs ?? resolveTextEffectDurationMs("shuffle", text);
	const stepMs = totalDuration / Math.max(1, count);

	let frame = 0;
	let resolvePromise: () => void = () => {};
	let settled = false;
	const promise = new Promise<void>((resolve) => {
		resolvePromise = resolve;
	});

	const intervalId = globalThis.setInterval(() => {
		// Fisher-Yates shuffle each frame.
		const shuffled = [...chars];
		for (let j = shuffled.length - 1; j > 0; j--) {
			const k = Math.floor(Math.random() * (j + 1));
			[shuffled[j], shuffled[k]] = [shuffled[k]!, shuffled[j]!];
		}
		el.textContent = shuffled.join("");

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
