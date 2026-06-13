import type { EffectRendererHandle, CensorEffectOptions } from "../types";
import { DEFAULT_CENSOR_CHAR } from "../constants";
import { resolveTextEffectDurationMs } from "../utils";

function pickFillChar(fillChar: string | string[]): string {
	if (Array.isArray(fillChar)) {
		return fillChar[Math.floor(Math.random() * fillChar.length)] ?? DEFAULT_CENSOR_CHAR;
	}
	return fillChar;
}

export function runCensorRenderer(
	el: HTMLElement,
	text: string,
	options: CensorEffectOptions = {}
): EffectRendererHandle {
	const { fillChar = DEFAULT_CENSOR_CHAR, restore = true, durationMs } = options;
	const chars = text.split("");
	const totalDuration = durationMs ?? resolveTextEffectDurationMs("censor", text);
	const phaseSteps = Math.max(1, chars.length);
	const totalSteps = restore ? phaseSteps * 2 : phaseSteps;
	const stepMs = totalDuration / totalSteps;

	// Snapshot fill chars per position once so the restore phase mirrors censor phase.
	const fillChars = chars.map((c) => (/\s/.test(c) ? c : pickFillChar(fillChar)));

	let step = 0;
	let resolvePromise: () => void = () => {};
	let settled = false;
	const promise = new Promise<void>((resolve) => {
		resolvePromise = resolve;
	});

	const intervalId = globalThis.setInterval(() => {
		if (step < phaseSteps) {
			el.textContent = chars.map((c, i) => (i <= step ? (fillChars[i] ?? c) : c)).join("");
		} else {
			const revealIndex = step - phaseSteps;
			el.textContent = chars.map((c, i) => (i <= revealIndex ? c : (fillChars[i] ?? c))).join("");
		}

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
