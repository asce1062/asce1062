import type { EffectRendererHandle, GlitchEffectOptions } from "../types";
import { DEFAULT_GLITCH_COUNT, DEFAULT_GLITCH_SHIMMER_INTERVAL_MS, DEFAULT_GLITCH_ITEMS } from "../constants";
import { resolveTextEffectDurationMs, resolveGlitchCharsetStr, splitGraphemes, pickRandomGrapheme } from "../utils";
import { registerPostEffectStop } from "../activeEffects";

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
	let resolvePromise: () => void = () => {};

	const promise = new Promise<void>((resolve) => {
		resolvePromise = resolve;
	});

	function randomizeAll(): string[] {
		return chars.map((char) => (/\s/.test(char) ? char : pickChar()));
	}

	let shimmerTimer: ReturnType<typeof globalThis.setTimeout> | null = null;

	/** Stop the post-reveal shimmer (and anything still pending). */
	const stopShimmer = (): void => {
		settled = true;
		if (shimmerTimer !== null) globalThis.clearTimeout(shimmerTimer);
		shimmerTimer = null;
	};

	/** One pending shimmer step at a time; the chain ends once stopped or detached. */
	function later(step: () => void, ms: number): void {
		shimmerTimer = globalThis.setTimeout(() => {
			shimmerTimer = null;
			if (settled || el.isConnected === false) return;
			step();
		}, ms);
	}

	function scheduleShimmer(): void {
		if (settled) return;
		later(
			() => {
				if (nonSpaceIndices.length === 0) {
					scheduleShimmer();
					return;
				}
				const pos = nonSpaceIndices[Math.floor(Math.random() * nonSpaceIndices.length)]!;
				el.textContent = setCharAt(chars, pos, pickChar()).join("");
				later(
					() => {
						el.textContent = text;
						later(
							() => {
								el.textContent = setCharAt(chars, pos, pickChar()).join("");
								later(
									() => {
										el.textContent = text;
										scheduleShimmer();
									},
									Math.floor(Math.random() * 300)
								);
							},
							Math.floor(Math.random() * 100)
						);
					},
					Math.floor(Math.random() * 100)
				);
			},
			Math.floor(Math.random() * shimmerIntervalMs)
		);
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
			if (shimmer) {
				// The effect is "done" for the engine once resolved, so its cancel() is no
				// longer reachable: register a separate stop for the next effect or a swap.
				registerPostEffectStop(el, stopShimmer);
				scheduleShimmer();
			}
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
			stopShimmer();
			resolvePromise();
		},
	};
}
