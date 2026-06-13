import type { EffectRendererHandle, SlowRevealEffectOptions } from "../types";
import { DEFAULT_SLOW_REVEAL_CYCLES_PER_CHAR } from "../constants";
import { resolveTextEffectDurationMs, resolveGlitchCharsetStr, createTimeoutRenderer } from "../utils";

export function runSlowRevealRenderer(
	el: HTMLElement,
	text: string,
	options: SlowRevealEffectOptions = {}
): EffectRendererHandle {
	const { cyclesPerChar = DEFAULT_SLOW_REVEAL_CYCLES_PER_CHAR, charset = "blocks", durationMs } = options;
	const charsetStr = resolveGlitchCharsetStr(charset);
	const chars = text.split("");
	const nonSpacePositions = chars.map((c, i) => ({ c, i })).filter(({ c }) => !/\s/.test(c));
	const totalDuration = durationMs ?? resolveTextEffectDurationMs("slow-reveal", text);
	const stepsTotal = Math.max(1, nonSpacePositions.length) * (cyclesPerChar + 1);
	const stepMs = totalDuration / stepsTotal;

	return createTimeoutRenderer((schedule, finish) => {
		const working = chars.map((c) =>
			/\s/.test(c) ? c : (charsetStr[Math.floor(Math.random() * charsetStr.length)] ?? c)
		);
		el.textContent = working.join("");

		let posIdx = 0;
		let cycleCount = 0;

		const tick = () => {
			if (posIdx >= nonSpacePositions.length) {
				el.textContent = text;
				finish();
				return;
			}

			const entry = nonSpacePositions[posIdx]!;

			if (cycleCount < cyclesPerChar) {
				working[entry.i] = charsetStr[Math.floor(Math.random() * charsetStr.length)] ?? entry.c;
				el.textContent = working.join("");
				cycleCount++;
				schedule(tick, stepMs);
			} else {
				working[entry.i] = entry.c;
				el.textContent = working.join("");
				cycleCount = 0;
				posIdx++;
				schedule(tick, stepMs);
			}
		};

		schedule(tick, stepMs);
	});
}
