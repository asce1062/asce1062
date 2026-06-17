import type { EffectRendererHandle, ShuffleEffectOptions } from "../types";
import { DEFAULT_SHUFFLE_COUNT } from "../constants";
import { resolveTextEffectDurationMs } from "../utils";

export function runShuffleRenderer(
	el: HTMLElement,
	text: string,
	options: ShuffleEffectOptions = {}
): EffectRendererHandle {
	const { count = DEFAULT_SHUFFLE_COUNT, delayMs, restore = true, durationMs } = options;
	const chars = text.split("");
	const totalDuration = durationMs ?? resolveTextEffectDurationMs("shuffle", text);
	const stepMs = delayMs ?? totalDuration / Math.max(1, count);

	let frame = 0;
	let resolvePromise: () => void = () => {};
	let settled = false;
	let activeInterval: ReturnType<typeof globalThis.setInterval> | null = null;
	let lastShuffle = [...chars];
	const promise = new Promise<void>((resolve) => {
		resolvePromise = resolve;
	});

	function done() {
		if (settled) return;
		settled = true;
		resolvePromise();
	}

	function startRestorePhase() {
		const working = [...lastShuffle];
		let step = 0;
		activeInterval = globalThis.setInterval(() => {
			working[step] = chars[step] ?? "";
			el.textContent = working.join("");
			step++;
			if (step >= chars.length) {
				globalThis.clearInterval(activeInterval!);
				activeInterval = null;
				el.textContent = text;
				done();
			}
		}, stepMs);
	}

	activeInterval = globalThis.setInterval(() => {
		// Fisher-Yates shuffle each frame.
		const shuffled = [...chars];
		for (let j = shuffled.length - 1; j > 0; j--) {
			const k = Math.floor(Math.random() * (j + 1));
			[shuffled[j], shuffled[k]] = [shuffled[k]!, shuffled[j]!];
		}
		lastShuffle = shuffled;
		el.textContent = shuffled.join("");
		frame++;

		if (frame >= count) {
			globalThis.clearInterval(activeInterval!);
			activeInterval = null;
			if (!restore) {
				done();
				return;
			}
			startRestorePhase();
		}
	}, stepMs);

	return {
		promise,
		cancel: () => {
			if (settled) return;
			settled = true;
			if (activeInterval !== null) globalThis.clearInterval(activeInterval);
			resolvePromise();
		},
	};
}
