import type { EffectRendererHandle } from "../types";
import {
	DEFAULT_TYPING_STEP_MS,
	DEFAULT_TYPING_LEAD_IN_MS,
	DEFAULT_TYPING_STEP_VARIANCE_MS,
	DEFAULT_TYPING_END_BLINK_INTERVAL_MS,
	DEFAULT_TYPING_END_BLINK_COUNT,
} from "../constants";
import { createTimeoutRenderer, resolveTypingDurationMs, renderTypingFrame, resolveHumanPauseMs } from "../utils";

export function runTypingEnterRenderer(
	el: HTMLElement,
	text: string,
	typingStepMs = DEFAULT_TYPING_STEP_MS
): EffectRendererHandle {
	return createTimeoutRenderer((schedule, finish) => {
		const resolvedDurationMs = resolveTypingDurationMs(text, typingStepMs);
		const averageStepMs = Math.max((resolvedDurationMs - DEFAULT_TYPING_LEAD_IN_MS) / Math.max(text.length, 1), 1);
		let index = 0;
		let trailingBlinkCount = 0;

		el.textContent = renderTypingFrame("", 0, true);

		const complete = () => {
			el.textContent = text;
			finish();
		};
		const scheduleTrailingBlink = (blinkText: string, completeText: string) => {
			schedule(() => {
				trailingBlinkCount += 1;
				const showCursor = trailingBlinkCount % 2 === 0;
				el.textContent = renderTypingFrame(blinkText, blinkText.length, showCursor);

				if (trailingBlinkCount >= DEFAULT_TYPING_END_BLINK_COUNT * 2) {
					el.textContent = completeText;
					complete();
					return;
				}

				scheduleTrailingBlink(blinkText, completeText);
			}, DEFAULT_TYPING_END_BLINK_INTERVAL_MS);
		};
		const scheduleNext = () => {
			const variance = Math.random() * Math.min(DEFAULT_TYPING_STEP_VARIANCE_MS, averageStepMs * 0.45);
			const punctuationPause = /[.,;:!?]/.test(text[index] ?? "") ? averageStepMs * 0.9 : 0;
			const humanPause = index > 0 ? resolveHumanPauseMs(averageStepMs) : 0;
			const baseDelay = averageStepMs * (0.72 + Math.random() * 0.42);
			const leadIn = index === 0 ? DEFAULT_TYPING_LEAD_IN_MS : 0;
			schedule(tick, baseDelay + variance + punctuationPause + humanPause + leadIn);
		};
		const tick = () => {
			index += 1;
			el.textContent = renderTypingFrame(text, index, true);

			if (index >= text.length) {
				scheduleTrailingBlink(text, text);
				return;
			}

			scheduleNext();
		};

		scheduleNext();
	});
}
