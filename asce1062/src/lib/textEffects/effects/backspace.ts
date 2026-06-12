import type { EffectRendererHandle } from "../types";
import {
	DEFAULT_BACKSPACE_STEP_MS,
	DEFAULT_BACKSPACE_HOLD_MS,
	DEFAULT_TYPING_STEP_VARIANCE_MS,
	DEFAULT_TYPING_END_BLINK_INTERVAL_MS,
	DEFAULT_TYPING_END_BLINK_COUNT,
} from "../constants";
import {
	createTimeoutRenderer,
	resolveTerminalTextEffectDurationMs,
	renderTypingFrame,
	resolveHumanPauseMs,
} from "../utils";

export function runBackspaceExitRenderer(
	el: HTMLElement,
	text: string,
	typingStepMs = DEFAULT_BACKSPACE_STEP_MS
): EffectRendererHandle {
	return createTimeoutRenderer((schedule, finish) => {
		const resolvedDurationMs = resolveTerminalTextEffectDurationMs("backspace", text);
		const averageStepMs = Math.max(
			(resolvedDurationMs - DEFAULT_BACKSPACE_HOLD_MS) / Math.max(text.length, 1),
			typingStepMs
		);
		let index = text.length;
		let trailingBlinkCount = 0;
		el.textContent = renderTypingFrame(text, index, true);

		const scheduleTrailingBlink = () => {
			schedule(() => {
				trailingBlinkCount += 1;
				const showCursor = trailingBlinkCount % 2 === 0;
				el.textContent = renderTypingFrame("", 0, showCursor);

				if (trailingBlinkCount >= DEFAULT_TYPING_END_BLINK_COUNT * 2) {
					el.textContent = "";
					finish();
					return;
				}

				scheduleTrailingBlink();
			}, DEFAULT_TYPING_END_BLINK_INTERVAL_MS);
		};
		const tick = () => {
			index -= 1;
			el.textContent = renderTypingFrame(text, Math.max(index, 0), true);

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
