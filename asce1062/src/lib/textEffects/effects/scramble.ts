import type { EffectRendererHandle, ScrambleEffectOptions } from "../types";
import { DEFAULT_SCRAMBLE_COUNT, DEFAULT_SCRAMBLE_ITEMS } from "../constants";
import { resolveTextEffectDurationMs, resolveGlitchCharsetStr } from "../utils";

export function runScrambleRenderer(
	el: HTMLElement,
	text: string,
	options: ScrambleEffectOptions = {}
): EffectRendererHandle {
	const { count = DEFAULT_SCRAMBLE_COUNT, charset = "blocks", items, delayMs, restore = true, durationMs } = options;

	const charsetStr = items
		? items.join("")
		: charset === "blocks"
			? DEFAULT_SCRAMBLE_ITEMS.join("")
			: resolveGlitchCharsetStr(charset);
	const totalDuration = durationMs ?? resolveTextEffectDurationMs("scramble", text);
	const stepMs = delayMs ?? totalDuration / Math.max(1, count);

	const chars = text.split("");
	const working = [...chars];
	const nonSpaceIndices = chars.map((_, i) => i).filter((i) => !/\s/.test(text[i] ?? ""));

	let frame = 0;
	let resolvePromise: () => void = () => {};
	let settled = false;
	let activeInterval: ReturnType<typeof globalThis.setInterval> | null = null;
	const promise = new Promise<void>((resolve) => {
		resolvePromise = resolve;
	});

	function done() {
		if (settled) return;
		settled = true;
		resolvePromise();
	}

	function startRestorePhase() {
		let restoreStep = 0;
		activeInterval = globalThis.setInterval(() => {
			const idx = nonSpaceIndices[restoreStep];
			if (idx !== undefined) working[idx] = chars[idx] ?? "";
			el.textContent = working.join("");
			restoreStep++;
			if (restoreStep >= nonSpaceIndices.length) {
				globalThis.clearInterval(activeInterval!);
				activeInterval = null;
				el.textContent = text;
				done();
			}
		}, stepMs);
	}

	activeInterval = globalThis.setInterval(() => {
		if (nonSpaceIndices.length > 0) {
			const idx = nonSpaceIndices[Math.floor(Math.random() * nonSpaceIndices.length)]!;
			working[idx] = charsetStr[Math.floor(Math.random() * charsetStr.length)] ?? working[idx] ?? "_";
		}
		el.textContent = working.join("");
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
