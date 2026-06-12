import type {
	TextEffectKind,
	TextEffectTrigger,
	TextEffectConfig,
	TypingEffectOptions,
	GlitchEffectOptions,
	SignalLossEffectOptions,
} from "./types";
import { TEXT_EFFECTS } from "./types";
import { DEFAULT_TEXT_EFFECT_TRIGGERS } from "./constants";

export function normalizeTextEffectKinds(effects: TextEffectKind[]): TextEffectKind[] {
	return [...new Set(effects)];
}

export function normalizeTextEffectTriggers(
	triggers: TextEffectTrigger[] = DEFAULT_TEXT_EFFECT_TRIGGERS
): TextEffectTrigger[] {
	return [...new Set(triggers)];
}

export function shouldHandleTextEffectTrigger(
	triggers: readonly TextEffectTrigger[],
	trigger: TextEffectTrigger
): boolean {
	return triggers.includes(trigger);
}

/**
 * Declarative parser for the registry path.
 *
 * Supported attributes:
 * - `data-text-effect="typing"` or `data-text-effect="typing, decrypt, backspace, entropy"`
 * - `data-text-effect-triggers="load, hover, activate, resume, route-enter, intersection, idle-return, content-change, random-effect, random-time"`
 * - `data-text-effect-interval-ms="18000"`
 * - `data-text-effect-managed="manual"` to opt out of the declarative registry
 *
 * Per-effect tunables (all optional, all backward-compatible):
 * - `data-text-effect-typing-cursor-char`      — cursor character (default "█")
 * - `data-text-effect-typing-cursor-blink-ms`  — cursor blink interval in ms (default 500)
 * - `data-text-effect-typing-end-blink-count`  — trailing blinks after typing (default 3)
 * - `data-text-effect-typing-lead-in-ms`       — pre-type pause in ms (default 120)
 * - `data-text-effect-typing-stutter-chance`   — 0–1 probability of a stutter pause (default 0.12)
 * - `data-text-effect-typing-stutter-max-ms`   — max stutter pause duration in ms (default 420)
 * - `data-text-effect-glitch-charset`          — "blocks" | "letters" | "binary" | any custom string
 * - `data-text-effect-glitch-reverse`          — presence attribute; reverses lock-in direction
 * - `data-text-effect-glitch-frames`           — frame count (default 6, min 3)
 * - `data-text-effect-glitch-intensity`        — scramble intensity 0–1 (default 1.0)
 * - `data-text-effect-signal-dropout-char`     — character to show for dropped-out positions (default "_")
 * - `data-text-effect-signal-blackout-ms`      — blackout hold duration in ms (default 760)
 * - `data-text-effect-signal-false-recovery`   — presence attribute; disables mid-animation false-recovery flash
 *
 * Parsing is intentionally strict:
 * - unknown effects are ignored; if nothing valid remains, the registry skips the element
 * - multiple effects are allowed so `random-effect` can choose from the
 *   element's declared set rather than a hardcoded global pair
 * - declaring an enter effect is enough for full transitions; the paired exit
 *   is inferred from metadata when stable content replays or changes
 * - declaring an exit effect allows explicit standalone flourishes such as
 *   `backspace` or `entropy`
 * - trigger strings are normalized/deduplicated before binding
 * - invalid interval values are ignored rather than crashing
 */
export function readTextEffectConfig(el: HTMLElement): TextEffectConfig | null {
	const effects = el.dataset.textEffect
		?.split(",")
		.map((value) => value.trim())
		.filter((value): value is TextEffectKind => value in TEXT_EFFECTS);

	if (!effects || effects.length === 0) {
		return null;
	}

	const rawTriggers = el.dataset.textEffectTriggers
		?.split(",")
		.map((value) => value.trim())
		.filter(Boolean) as TextEffectTrigger[] | undefined;

	const intervalValue = el.dataset.textEffectIntervalMs
		? Number.parseInt(el.dataset.textEffectIntervalMs, 10)
		: undefined;

	// --- typing options ---
	const typingOpts: TypingEffectOptions = {};
	if (el.dataset.textEffectTypingCursorChar !== undefined)
		typingOpts.cursorChar = el.dataset.textEffectTypingCursorChar;
	const typingBlinkMs = el.dataset.textEffectTypingCursorBlinkMs
		? Number.parseInt(el.dataset.textEffectTypingCursorBlinkMs, 10)
		: NaN;
	if (Number.isFinite(typingBlinkMs)) typingOpts.cursorBlinkIntervalMs = typingBlinkMs;
	const typingEndBlinks = el.dataset.textEffectTypingEndBlinkCount
		? Number.parseInt(el.dataset.textEffectTypingEndBlinkCount, 10)
		: NaN;
	if (Number.isFinite(typingEndBlinks)) typingOpts.endBlinkCount = typingEndBlinks;
	const typingLeadIn = el.dataset.textEffectTypingLeadInMs
		? Number.parseInt(el.dataset.textEffectTypingLeadInMs, 10)
		: NaN;
	if (Number.isFinite(typingLeadIn)) typingOpts.leadInMs = typingLeadIn;
	const stutterChance = el.dataset.textEffectTypingStutterChance
		? Number.parseFloat(el.dataset.textEffectTypingStutterChance)
		: NaN;
	if (Number.isFinite(stutterChance)) typingOpts.stutterChance = Math.min(1, Math.max(0, stutterChance));
	const stutterMax = el.dataset.textEffectTypingStutterMaxMs
		? Number.parseInt(el.dataset.textEffectTypingStutterMaxMs, 10)
		: NaN;
	if (Number.isFinite(stutterMax)) typingOpts.stutterMaxMs = stutterMax;
	const typingOptions = Object.keys(typingOpts).length > 0 ? typingOpts : undefined;

	// --- glitch options ---
	const glitchOpts: GlitchEffectOptions = {};
	if (el.dataset.textEffectGlitchCharset !== undefined) glitchOpts.charset = el.dataset.textEffectGlitchCharset;
	if (el.dataset.textEffectGlitchReverse !== undefined) glitchOpts.reverse = true;
	const glitchFrames = el.dataset.textEffectGlitchFrames ? Number.parseInt(el.dataset.textEffectGlitchFrames, 10) : NaN;
	if (Number.isFinite(glitchFrames)) glitchOpts.frameCount = glitchFrames;
	const glitchIntensity = el.dataset.textEffectGlitchIntensity
		? Number.parseFloat(el.dataset.textEffectGlitchIntensity)
		: NaN;
	if (Number.isFinite(glitchIntensity)) glitchOpts.intensity = Math.min(1, Math.max(0, glitchIntensity));
	const glitchOptions = Object.keys(glitchOpts).length > 0 ? glitchOpts : undefined;

	// --- signal-loss options ---
	const signalOpts: SignalLossEffectOptions = {};
	if (el.dataset.textEffectSignalDropoutChar !== undefined)
		signalOpts.dropoutChar = el.dataset.textEffectSignalDropoutChar;
	const blackoutMs = el.dataset.textEffectSignalBlackoutMs
		? Number.parseInt(el.dataset.textEffectSignalBlackoutMs, 10)
		: NaN;
	if (Number.isFinite(blackoutMs)) signalOpts.blackoutHoldMs = blackoutMs;
	if (el.dataset.textEffectSignalFalseRecovery !== undefined) signalOpts.falseRecovery = false;
	const signalLossOptions = Object.keys(signalOpts).length > 0 ? signalOpts : undefined;

	return {
		effects: normalizeTextEffectKinds(effects),
		triggers: normalizeTextEffectTriggers(rawTriggers),
		randomIntervalMs: Number.isFinite(intervalValue) ? intervalValue : undefined,
		typingOptions,
		glitchOptions,
		signalLossOptions,
	};
}
