import type { EffectRendererHandle, UncensorEffectOptions } from "../types";
import { DEFAULT_CENSOR_CHAR } from "../constants";
import { resolveTextEffectDurationMs } from "../utils";

export function runUncensorRenderer(
	el: HTMLElement,
	text: string,
	options: UncensorEffectOptions = {}
): EffectRendererHandle {
	const { fillChar = DEFAULT_CENSOR_CHAR, delayMs, durationMs } = options;
	const chars = text.split("");
	const nonSpaceIndices = chars.map((c, i) => (/\s/.test(c) ? null : i)).filter((i): i is number => i !== null);
	const nonSpaceCount = Math.max(1, nonSpaceIndices.length);
	const totalDuration = durationMs ?? resolveTextEffectDurationMs("uncensor", text);
	const stepMs = delayMs ?? totalDuration / nonSpaceCount;

	const working = chars.map((c) => (/\s/.test(c) ? c : fillChar));
	el.textContent = working.join("");

	let step = 0;
	let resolvePromise: () => void = () => {};
	let settled = false;
	const promise = new Promise<void>((resolve) => {
		resolvePromise = resolve;
	});

	const intervalId = globalThis.setInterval(() => {
		const idx = nonSpaceIndices[step];
		if (idx !== undefined) working[idx] = chars[idx] ?? fillChar;
		el.textContent = working.join("");
		step += 1;

		if (step >= nonSpaceCount) {
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
