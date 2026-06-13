import type { EffectRendererHandle, UncensorEffectOptions } from "../types";
import { DEFAULT_CENSOR_CHAR } from "../constants";
import { resolveTextEffectDurationMs } from "../utils";

export function runUncensorRenderer(
	el: HTMLElement,
	text: string,
	options: UncensorEffectOptions = {}
): EffectRendererHandle {
	const { fillChar = DEFAULT_CENSOR_CHAR, durationMs } = options;
	const chars = text.split("");
	const totalDuration = durationMs ?? resolveTextEffectDurationMs("uncensor", text);
	const totalSteps = Math.max(1, chars.length);
	const stepMs = totalDuration / totalSteps;

	// Start fully censored.
	el.textContent = chars.map((c) => (/\s/.test(c) ? c : fillChar)).join("");

	let step = 0;
	let resolvePromise: () => void = () => {};
	let settled = false;
	const promise = new Promise<void>((resolve) => {
		resolvePromise = resolve;
	});

	const intervalId = globalThis.setInterval(() => {
		el.textContent = chars.map((c, i) => (i <= step || /\s/.test(c) ? c : fillChar)).join("");
		step += 1;

		if (step >= totalSteps) {
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
