import type { EffectRendererHandle, TimeoutHandle, SignalLossEffectOptions } from "../types";
import {
	DEFAULT_SIGNAL_LOSS_TOTAL_FRAMES,
	DEFAULT_SIGNAL_LOSS_BLACKOUT_HOLD_MS,
	DEFAULT_SIGNAL_DROPOUT_CHAR,
} from "../constants";
import { resolveTextEffectDurationMs } from "../utils";

function renderSignalLossDropoutText(text: string, dropoutChar: string): string {
	return text
		.split("")
		.map((char) => (/\s/.test(char) ? char : dropoutChar))
		.join("");
}

function renderSignalLossFrame(
	text: string,
	frame: number,
	totalFrames: number,
	dropoutChar: string,
	falseRecovery: boolean
): string {
	if (frame === 0) return text;
	if (frame >= totalFrames - 1) return renderSignalLossDropoutText(text, dropoutChar);

	const chars = text.split("");
	const lossRatio = frame / Math.max(totalFrames - 1, 1);
	if (falseRecovery && totalFrames > 5 && frame === Math.floor(totalFrames * 0.45)) return text;

	const dropoutCount = Math.max(1, Math.ceil(chars.length * lossRatio * 0.72));
	const start = Math.min(chars.length - 1, (frame * 2) % Math.max(chars.length, 1));
	const rendered = chars.map((char, index) => {
		if (char === " ") return char;
		const inPrimaryDropout = index >= start && index < start + dropoutCount;
		const inWrappedDropout = start + dropoutCount > chars.length && index < (start + dropoutCount) % chars.length;
		const shouldDrop = inPrimaryDropout || inWrappedDropout || (lossRatio > 0.58 && (index + frame) % 3 === 0);
		if (!shouldDrop) return char;
		return frame % 2 === 0 ? dropoutChar : " ";
	});

	if (lossRatio > 0.72) {
		return rendered
			.map((char, index) => {
				if (/\s/.test(chars[index] ?? "")) return chars[index] ?? char;
				return index < Math.floor(chars.length * (1 - lossRatio)) ? char : dropoutChar;
			})
			.join("");
	}

	return rendered.join("");
}

export function runSignalLossExitRenderer(
	el: HTMLElement,
	text: string,
	options: SignalLossEffectOptions = {}
): EffectRendererHandle {
	const {
		dropoutChar = DEFAULT_SIGNAL_DROPOUT_CHAR,
		blackoutHoldMs = DEFAULT_SIGNAL_LOSS_BLACKOUT_HOLD_MS,
		falseRecovery = true,
		durationMs,
	} = options;

	const totalFrames = DEFAULT_SIGNAL_LOSS_TOTAL_FRAMES;
	const totalDuration = durationMs ?? resolveTextEffectDurationMs("signal-loss", text);
	const frameInterval = totalDuration / totalFrames;
	let timeoutId: TimeoutHandle | null = null;
	let frame = 0;
	let resolvePromise: () => void = () => {};
	let settled = false;
	const promise = new Promise<void>((resolve) => {
		resolvePromise = resolve;
	});
	const intervalId = globalThis.setInterval(() => {
		el.textContent = renderSignalLossFrame(text, frame, totalFrames, dropoutChar, falseRecovery);

		frame += 1;

		if (frame >= totalFrames) {
			globalThis.clearInterval(intervalId);
			if (settled) return;
			settled = true;
			el.textContent = renderSignalLossDropoutText(text, dropoutChar);
			timeoutId = globalThis.setTimeout(resolvePromise, blackoutHoldMs);
		}
	}, frameInterval);

	return {
		promise,
		cancel: () => {
			if (settled && timeoutId === null) return;
			settled = true;
			globalThis.clearInterval(intervalId);
			if (timeoutId !== null) {
				globalThis.clearTimeout(timeoutId);
				timeoutId = null;
			}
			resolvePromise();
		},
	};
}
