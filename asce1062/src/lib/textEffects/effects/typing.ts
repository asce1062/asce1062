import type { EffectRendererHandle, TypingEffectOptions } from "../types";
import {
	DEFAULT_TYPING_STEP_MS,
	DEFAULT_TYPING_LEAD_IN_MS,
	DEFAULT_TYPING_STEP_VARIANCE_MS,
	DEFAULT_TYPING_END_BLINK_INTERVAL_MS,
	DEFAULT_TYPING_END_BLINK_COUNT,
	DEFAULT_HUMAN_PAUSE_CHANCE,
	DEFAULT_HUMAN_PAUSE_MIN_MS,
	DEFAULT_HUMAN_PAUSE_MAX_MS,
	TERMINAL_BLOCK_CURSOR,
} from "../constants";
import { createTimeoutRenderer, resolveTypingDurationMs, renderTypingFrame, resolveHumanPauseMs } from "../utils";

export function runTypingEnterRenderer(
	el: HTMLElement,
	text: string,
	options: TypingEffectOptions = {}
): EffectRendererHandle {
	const {
		stepMs = DEFAULT_TYPING_STEP_MS,
		cursorChar = TERMINAL_BLOCK_CURSOR,
		cursorBlinkIntervalMs = DEFAULT_TYPING_END_BLINK_INTERVAL_MS,
		endBlinkCount = DEFAULT_TYPING_END_BLINK_COUNT,
		leadInMs = DEFAULT_TYPING_LEAD_IN_MS,
		stutterChance = DEFAULT_HUMAN_PAUSE_CHANCE,
		stutterMaxMs = DEFAULT_HUMAN_PAUSE_MAX_MS,
		punctuationPauseMultiplier = 0.9,
	} = options;

	return createTimeoutRenderer((schedule, finish) => {
		const resolvedDurationMs = resolveTypingDurationMs(text, stepMs);
		const averageStepMs = Math.max((resolvedDurationMs - leadInMs) / Math.max(text.length, 1), 1);
		let index = 0;
		let trailingBlinkCount = 0;

		el.textContent = renderTypingFrame("", 0, true, cursorChar);

		const complete = () => {
			el.textContent = text;
			finish();
		};
		const scheduleTrailingBlink = (blinkText: string, completeText: string) => {
			schedule(() => {
				trailingBlinkCount += 1;
				const showCursor = trailingBlinkCount % 2 === 0;
				el.textContent = renderTypingFrame(blinkText, blinkText.length, showCursor, cursorChar);

				if (trailingBlinkCount >= endBlinkCount * 2) {
					el.textContent = completeText;
					complete();
					return;
				}

				scheduleTrailingBlink(blinkText, completeText);
			}, cursorBlinkIntervalMs);
		};
		const scheduleNext = () => {
			const variance = Math.random() * Math.min(DEFAULT_TYPING_STEP_VARIANCE_MS, averageStepMs * 0.45);
			const punctuationPause = /[.,;:!?]/.test(text[index] ?? "") ? averageStepMs * punctuationPauseMultiplier : 0;
			const humanPause =
				index > 0 ? resolveHumanPauseMs(averageStepMs, stutterChance, DEFAULT_HUMAN_PAUSE_MIN_MS, stutterMaxMs) : 0;
			const baseDelay = averageStepMs * (0.72 + Math.random() * 0.42);
			const currentLeadIn = index === 0 ? leadInMs : 0;
			schedule(tick, baseDelay + variance + punctuationPause + humanPause + currentLeadIn);
		};
		const tick = () => {
			index += 1;
			el.textContent = renderTypingFrame(text, index, true, cursorChar);

			if (index >= text.length) {
				scheduleTrailingBlink(text, text);
				return;
			}

			scheduleNext();
		};

		scheduleNext();
	});
}
