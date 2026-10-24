import type { EffectRendererHandle, GlitchEffectOptions } from "../types";
import { DEFAULT_GLITCH_COUNT, DEFAULT_GLITCH_SHIMMER_INTERVAL_MS, DEFAULT_GLITCH_ITEMS } from "../constants";
import { resolveTextEffectDurationMs, resolveGlitchCharsetStr, splitGraphemes, pickRandomGrapheme } from "../utils";

function setCharAt(chars: readonly string[], index: number, ch: string): string[] {
	const next = [...chars];
	next[index] = ch;
	return next;
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

	const glyphs = splitGraphemes(
		items ? items.join("") : charset === "blocks" ? DEFAULT_GLITCH_ITEMS.join("") : resolveGlitchCharsetStr(charset)
	);
	const pickChar = (): string => pickRandomGrapheme(glyphs) ?? "_";

	const chars = splitGraphemes(text);
	const stepMs = delayMs ?? resolveTextEffectDurationMs("glitch", text) / Math.max(1, chars.length + count);
	const total = chars.length + count;
	const nonSpaceIndices = chars.map((_, i) => i).filter((i) => !/\s/.test(chars[i] ?? ""));

	let frame = 0;
	let settled = false;
	let revealInterval: ReturnType<typeof globalThis.setInterval> | null = null;
	let shimmerTimers: ReturnType<typeof globalThis.setTimeout>[] = [];
	let resolvePromise: () => void = () => {};

	const promise = new Promise<void>((resolve) => {
		resolvePromise = resolve;
	});

	function randomizeAll(): string[] {
		return chars.map((char) => (/\s/.test(char) ? char : pickChar()));
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
			el.textContent = setCharAt(chars, pos, pickChar()).join("");

			const t1 = globalThis.setTimeout(
				() => {
					if (settled) return;
					el.textContent = text;

					const t2 = globalThis.setTimeout(
						() => {
							if (settled) return;
							el.textContent = setCharAt(chars, pos, pickChar()).join("");

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
	let working = randomizeAll();
	el.textContent = working.join("");

	revealInterval = globalThis.setInterval(() => {
		const lockedCount = Math.max(0, frame - count + 1);

		// Lock in the next char once past the noise buffer
		if (frame >= count) {
			const lockIdx = reverse ? chars.length - 1 - (frame - count) : frame - count;
			if (lockIdx >= 0 && lockIdx < chars.length) {
				working = setCharAt(working, lockIdx, chars[lockIdx] ?? "");
			}
		}

		// Re-randomize all unlocked positions
		working = working.map((char, i) => {
			if (/\s/.test(chars[i] ?? "")) return char;
			const isLocked = reverse ? i >= chars.length - lockedCount : i < lockedCount;
			return isLocked ? char : pickChar();
		});

		el.textContent = working.join("");
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
