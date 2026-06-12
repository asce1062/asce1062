import type { EffectRendererHandle, TypingEffectOptions } from "../types";
import {
	DEFAULT_BACKSPACE_STEP_MS,
	DEFAULT_BACKSPACE_HOLD_MS,
	DEFAULT_TYPING_STEP_VARIANCE_MS,
	DEFAULT_TYPING_END_BLINK_INTERVAL_MS,
	DEFAULT_TYPING_END_BLINK_COUNT,
	TERMINAL_BLOCK_CURSOR,
} from "../constants";
import { createTimeoutRenderer, resolveTextEffectDurationMs, renderTypingFrame, resolveHumanPauseMs } from "../utils";

export function runBackspaceExitRenderer(
	el: HTMLElement,
	text: string,
	options: TypingEffectOptions = {}
): EffectRendererHandle {
	const {
		stepMs = DEFAULT_BACKSPACE_STEP_MS,
		cursorChar = TERMINAL_BLOCK_CURSOR,
		cursorBlinkIntervalMs = DEFAULT_TYPING_END_BLINK_INTERVAL_MS,
		endBlinkCount = DEFAULT_TYPING_END_BLINK_COUNT,
	} = options;

	return createTimeoutRenderer((schedule, finish) => {
		const resolvedDurationMs = resolveTextEffectDurationMs("backspace", text);
		const averageStepMs = Math.max((resolvedDurationMs - DEFAULT_BACKSPACE_HOLD_MS) / Math.max(text.length, 1), stepMs);
		let index = text.length;
		let trailingBlinkCount = 0;
		el.textContent = renderTypingFrame(text, index, true, cursorChar);

		const scheduleTrailingBlink = () => {
			schedule(() => {
				trailingBlinkCount += 1;
				const showCursor = trailingBlinkCount % 2 === 0;
				el.textContent = renderTypingFrame("", 0, showCursor, cursorChar);

				if (trailingBlinkCount >= endBlinkCount * 2) {
					el.textContent = "";
					finish();
					return;
				}

				scheduleTrailingBlink();
			}, cursorBlinkIntervalMs);
		};
		const tick = () => {
			index -= 1;
			el.textContent = renderTypingFrame(text, Math.max(index, 0), true, cursorChar);

			if (index <= 0) {
				scheduleTrailingBlink();
				return;
			}

			const variance = Math.random() * Math.min(DEFAULT_TYPING_STEP_VARIANCE_MS, averageStepMs * 0.35);
			const humanPause = resolveHumanPauseMs(averageStepMs);
			schedule(tick, averageStepMs + variance + humanPause);
		};

		schedule(tick, averageStepMs);
	});
}
