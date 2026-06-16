import type { EffectRendererHandle, GlitchEffectOptions } from "../types";
import { DEFAULT_GLITCH_COUNT, DEFAULT_GLITCH_SHIMMER_INTERVAL_MS, DEFAULT_GLITCH_ITEMS } from "../constants";
import { resolveTextEffectDurationMs, resolveGlitchCharsetStr } from "../utils";

function pickChar(charsetStr: string): string {
	return charsetStr[Math.floor(Math.random() * charsetStr.length)] ?? "_";
}

function setCharAt(str: string, index: number, ch: string): string {
	const arr = str.split("");
	arr[index] = ch;
	return arr.join("");
}

export function runGlitchRenderer(
	el: HTMLElement,
	text: string,
	options: GlitchEffectOptions = {}
): EffectRendererHandle {
	const {
		charset = "blocks",
		items,
		reverse = false,
		delayMs,
		count = DEFAULT_GLITCH_COUNT,
		shimmerIntervalMs = DEFAULT_GLITCH_SHIMMER_INTERVAL_MS,
		shimmer = true,
	} = options;

	const charsetStr = items
		? items.join("")
		: charset === "blocks"
			? DEFAULT_GLITCH_ITEMS.join("")
			: resolveGlitchCharsetStr(charset);

	const stepMs = delayMs ?? resolveTextEffectDurationMs("glitch", text) / Math.max(1, text.length + count);
	const total = text.length + count;
	const nonSpaceIndices = text
		.split("")
		.map((_, i) => i)
		.filter((i) => !/\s/.test(text[i] ?? ""));

	let frame = 0;
	let settled = false;
	let revealInterval: ReturnType<typeof globalThis.setInterval> | null = null;
	let shimmerTimers: ReturnType<typeof globalThis.setTimeout>[] = [];
	let resolvePromise: () => void = () => {};

	const promise = new Promise<void>((resolve) => {
		resolvePromise = resolve;
	});

	function randomizeAll(current: string): string {
		let result = current;
		for (let i = 0; i < text.length; i++) {
			if (!/\s/.test(text[i] ?? "")) result = setCharAt(result, i, pickChar(charsetStr));
		}
		return result;
	}

	function scheduleShimmer() {
		if (settled) return;
		const idleMs = Math.floor(Math.random() * shimmerIntervalMs);
		const t0 = globalThis.setTimeout(() => {
			if (settled) return;
			if (nonSpaceIndices.length === 0) {
				scheduleShimmer();
				return;
			}
			const pos = nonSpaceIndices[Math.floor(Math.random() * nonSpaceIndices.length)]!;
			el.textContent = setCharAt(text, pos, pickChar(charsetStr));

			const t1 = globalThis.setTimeout(
				() => {
					if (settled) return;
					el.textContent = text;

					const t2 = globalThis.setTimeout(
						() => {
							if (settled) return;
							el.textContent = setCharAt(text, pos, pickChar(charsetStr));

							const t3 = globalThis.setTimeout(
								() => {
									if (settled) return;
									el.textContent = text;
									scheduleShimmer();
								},
								Math.floor(Math.random() * 300)
							);
							shimmerTimers.push(t3);
						},
						Math.floor(Math.random() * 100)
					);
					shimmerTimers.push(t2);
				},
				Math.floor(Math.random() * 100)
			);
			shimmerTimers.push(t1);
		}, idleMs);
		shimmerTimers.push(t0);
	}

	// Start with fully randomized text
	let working = randomizeAll(text);
	el.textContent = working;

	revealInterval = globalThis.setInterval(() => {
		const lockedCount = Math.max(0, frame - count + 1);

		// Lock in the next char once past the noise buffer
		if (frame >= count) {
			const lockIdx = reverse ? text.length - 1 - (frame - count) : frame - count;
			if (lockIdx >= 0 && lockIdx < text.length) {
				working = setCharAt(working, lockIdx, text[lockIdx] ?? "");
			}
		}

		// Re-randomize all unlocked positions
		for (let i = 0; i < text.length; i++) {
			if (/\s/.test(text[i] ?? "")) continue;
			const isLocked = reverse ? i >= text.length - lockedCount : i < lockedCount;
			if (!isLocked) {
				working = setCharAt(working, i, pickChar(charsetStr));
			}
		}

		el.textContent = working;
		frame++;

		if (frame >= total) {
			globalThis.clearInterval(revealInterval!);
			revealInterval = null;
			el.textContent = text;
			resolvePromise();
			if (shimmer) scheduleShimmer();
		}
	}, stepMs);

	return {
		promise,
		cancel: () => {
			if (settled) return;
			settled = true;
			if (revealInterval !== null) {
				globalThis.clearInterval(revealInterval);
				revealInterval = null;
			}
			for (const t of shimmerTimers) globalThis.clearTimeout(t);
			shimmerTimers = [];
			resolvePromise();
		},
	};
}
