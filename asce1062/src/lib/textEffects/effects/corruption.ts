import type { EffectRendererHandle, CorruptionEffectOptions } from "../types";
import { DEFAULT_CORRUPTION_COUNT, DEFAULT_CORRUPTION_INTENSITY, DEFAULT_CORRUPTION_ITEMS } from "../constants";
import { resolveTextEffectDurationMs, resolveGlitchCharsetStr } from "../utils";

export function runCorruptionRenderer(
	el: HTMLElement,
	text: string,
	options: CorruptionEffectOptions = {}
): EffectRendererHandle {
	const {
		intensity = DEFAULT_CORRUPTION_INTENSITY,
		count = DEFAULT_CORRUPTION_COUNT,
		charset = "blocks",
		items,
		delayMs,
		restore = true,
		durationMs,
	} = options;

	const charsetStr = items
		? items.join("")
		: charset === "blocks"
			? DEFAULT_CORRUPTION_ITEMS.join("")
			: resolveGlitchCharsetStr(charset);
	const totalCount = Math.max(3, count);
	const totalDuration = durationMs ?? resolveTextEffectDurationMs("corruption", text);
	const stepMs = delayMs ?? totalDuration / totalCount;
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

		if (frame >= totalCount) {
			globalThis.clearInterval(intervalId);
			if (settled) return;
			settled = true;
			if (restore) el.textContent = text;
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
