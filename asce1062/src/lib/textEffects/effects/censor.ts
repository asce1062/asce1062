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
	const { fillChar = DEFAULT_CENSOR_CHAR, restore = true, delayMs, holdMs = 0, durationMs } = options;
	const chars = text.split("");

	// Only iterate non-space characters — spaces are preserved in position throughout
	const nonSpaceIndices = chars.map((c, i) => (/\s/.test(c) ? null : i)).filter((i): i is number => i !== null);
	const nonSpaceCount = Math.max(1, nonSpaceIndices.length);

	// Snapshot fill chars once so the restore phase mirrors what was shown during censor
	const fillChars = chars.map((c) => (/\s/.test(c) ? c : pickFillChar(fillChar)));

	// stepMs: per-letter delay when provided; otherwise derive from total duration budget
	const totalDuration = durationMs ?? resolveTextEffectDurationMs("censor", text);
	const stepMs = delayMs ?? totalDuration / nonSpaceCount;

	const working = [...chars];

	let resolvePromise: () => void = () => {};
	let settled = false;
	const promise = new Promise<void>((resolve) => {
		resolvePromise = resolve;
	});

	let activeInterval: ReturnType<typeof globalThis.setInterval> | null = null;
	let activeTimeout: ReturnType<typeof globalThis.setTimeout> | null = null;

	function done() {
		if (settled) return;
		settled = true;
		resolvePromise();
	}

	function startRestorePhase() {
		let step = 0;
		activeInterval = globalThis.setInterval(() => {
			const idx = nonSpaceIndices[step];
			if (idx !== undefined) working[idx] = chars[idx] ?? "";
			el.textContent = working.join("");
			step++;
			if (step >= nonSpaceCount) {
				globalThis.clearInterval(activeInterval!);
				activeInterval = null;
				el.textContent = text;
				done();
			}
		}, stepMs);
	}

	// Phase 1: censor — replace one non-space char per tick, spaces are skipped
	let censorStep = 0;
	activeInterval = globalThis.setInterval(() => {
		const idx = nonSpaceIndices[censorStep];
		if (idx !== undefined) working[idx] = fillChars[idx] ?? DEFAULT_CENSOR_CHAR;
		el.textContent = working.join("");
		censorStep++;

		if (censorStep >= nonSpaceCount) {
			globalThis.clearInterval(activeInterval!);
			activeInterval = null;

			if (!restore) {
				// Text stays censored — leave working content in place
				done();
				return;
			}

			if (holdMs > 0) {
				activeTimeout = globalThis.setTimeout(() => {
					activeTimeout = null;
					if (!settled) startRestorePhase();
				}, holdMs);
			} else {
				startRestorePhase();
			}
		}
	}, stepMs);

	return {
		promise,
		cancel: () => {
			if (settled) return;
			settled = true;
			if (activeInterval !== null) globalThis.clearInterval(activeInterval);
			if (activeTimeout !== null) globalThis.clearTimeout(activeTimeout);
			resolvePromise();
		},
	};
}
