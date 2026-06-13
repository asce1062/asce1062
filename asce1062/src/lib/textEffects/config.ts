import type {
	TextEffectKind,
	TextEffectTrigger,
	TextEffectConfig,
	TypingEffectOptions,
	GlitchEffectOptions,
	SignalLossEffectOptions,
	GlitchBurstEffectOptions,
	CensorEffectOptions,
	UncensorEffectOptions,
	ScrambleEffectOptions,
	SlowRevealEffectOptions,
	ShuffleEffectOptions,
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
 * - `data-text-effect-glitch-lock-charset`     — "blocks" | "letters" | "binary" | any custom string (glitch-lock-on)
 * - `data-text-effect-glitch-lock-reverse`     — presence attribute; reverses lock-in direction (glitch-lock-on)
 * - `data-text-effect-glitch-lock-frames`      — frame count (default 6, min 3) (glitch-lock-on)
 * - `data-text-effect-glitch-lock-intensity`   — scramble intensity 0–1 (default 1.0) (glitch-lock-on)
 * - `data-text-effect-signal-dropout-char`     — character to show for dropped-out positions (default "_")
 * - `data-text-effect-signal-blackout-ms`      — blackout hold duration in ms (default 760)
 * - `data-text-effect-signal-false-recovery`   — presence attribute; disables mid-animation false-recovery flash
 * - `data-text-effect-glitch-charset`          — "blocks" | "letters" | "binary" | any custom string (glitch burst)
 * - `data-text-effect-glitch-frames`           — frame count (default 10) (glitch burst)
 * - `data-text-effect-glitch-intensity`        — fraction corrupted per frame 0–1 (default 0.5) (glitch burst)
 * - `data-text-effect-censor-fill-char`        — masking character (default "█")
 * - `data-text-effect-censor-restore`          — "false" to stay censored; default true (restore)
 * - `data-text-effect-uncensor-fill-char`      — masking character (default "█")
 * - `data-text-effect-scramble-count`          — noise iterations (default 20)
 * - `data-text-effect-scramble-charset`        — "blocks" | "letters" | "binary" | any custom string
 * - `data-text-effect-slow-reveal-cycles`      — slot-machine cycles per char (default 3)
 * - `data-text-effect-slow-reveal-charset`     — "blocks" | "letters" | "binary" | any custom string
 * - `data-text-effect-shuffle-count`           — anagram-shuffle frames (default 20)
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

	// --- glitch-lock-on options ---
	const glitchOpts: GlitchEffectOptions = {};
	if (el.dataset.textEffectGlitchLockCharset !== undefined) glitchOpts.charset = el.dataset.textEffectGlitchLockCharset;
	if (el.dataset.textEffectGlitchLockReverse !== undefined) glitchOpts.reverse = true;
	const glitchLockFrames = el.dataset.textEffectGlitchLockFrames
		? Number.parseInt(el.dataset.textEffectGlitchLockFrames, 10)
		: NaN;
	if (Number.isFinite(glitchLockFrames)) glitchOpts.frameCount = glitchLockFrames;
	const glitchLockIntensity = el.dataset.textEffectGlitchLockIntensity
		? Number.parseFloat(el.dataset.textEffectGlitchLockIntensity)
		: NaN;
	if (Number.isFinite(glitchLockIntensity)) glitchOpts.intensity = Math.min(1, Math.max(0, glitchLockIntensity));
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

	// --- glitch (standalone burst) options ---
	const glitchBurstOpts: GlitchBurstEffectOptions = {};
	if (el.dataset.textEffectGlitchCharset !== undefined) glitchBurstOpts.charset = el.dataset.textEffectGlitchCharset;
	const glitchBurstFrames = el.dataset.textEffectGlitchFrames
		? Number.parseInt(el.dataset.textEffectGlitchFrames, 10)
		: NaN;
	if (Number.isFinite(glitchBurstFrames)) glitchBurstOpts.frameCount = glitchBurstFrames;
	const glitchBurstIntensity = el.dataset.textEffectGlitchIntensity
		? Number.parseFloat(el.dataset.textEffectGlitchIntensity)
		: NaN;
	if (Number.isFinite(glitchBurstIntensity)) glitchBurstOpts.intensity = Math.min(1, Math.max(0, glitchBurstIntensity));
	const glitchBurstOptions = Object.keys(glitchBurstOpts).length > 0 ? glitchBurstOpts : undefined;

	// --- censor options ---
	const censorOpts: CensorEffectOptions = {};
	if (el.dataset.textEffectCensorFillChar !== undefined) censorOpts.fillChar = el.dataset.textEffectCensorFillChar;
	if (el.dataset.textEffectCensorRestore !== undefined)
		censorOpts.restore = el.dataset.textEffectCensorRestore !== "false";
	const censorOptions = Object.keys(censorOpts).length > 0 ? censorOpts : undefined;

	// --- uncensor options ---
	const uncensorOpts: UncensorEffectOptions = {};
	if (el.dataset.textEffectUncensorFillChar !== undefined)
		uncensorOpts.fillChar = el.dataset.textEffectUncensorFillChar;
	const uncensorOptions = Object.keys(uncensorOpts).length > 0 ? uncensorOpts : undefined;

	// --- scramble options ---
	const scrambleOpts: ScrambleEffectOptions = {};
	if (el.dataset.textEffectScrambleCharset !== undefined) scrambleOpts.charset = el.dataset.textEffectScrambleCharset;
	const scrambleCount = el.dataset.textEffectScrambleCount
		? Number.parseInt(el.dataset.textEffectScrambleCount, 10)
		: NaN;
	if (Number.isFinite(scrambleCount)) scrambleOpts.count = scrambleCount;
	const scrambleOptions = Object.keys(scrambleOpts).length > 0 ? scrambleOpts : undefined;

	// --- slow-reveal options ---
	const slowRevealOpts: SlowRevealEffectOptions = {};
	if (el.dataset.textEffectSlowRevealCharset !== undefined)
		slowRevealOpts.charset = el.dataset.textEffectSlowRevealCharset;
	const slowRevealCycles = el.dataset.textEffectSlowRevealCycles
		? Number.parseInt(el.dataset.textEffectSlowRevealCycles, 10)
		: NaN;
	if (Number.isFinite(slowRevealCycles)) slowRevealOpts.cyclesPerChar = slowRevealCycles;
	const slowRevealOptions = Object.keys(slowRevealOpts).length > 0 ? slowRevealOpts : undefined;

	// --- shuffle options ---
	const shuffleOpts: ShuffleEffectOptions = {};
	const shuffleCount = el.dataset.textEffectShuffleCount ? Number.parseInt(el.dataset.textEffectShuffleCount, 10) : NaN;
	if (Number.isFinite(shuffleCount)) shuffleOpts.count = shuffleCount;
	const shuffleOptions = Object.keys(shuffleOpts).length > 0 ? shuffleOpts : undefined;

	return {
		effects: normalizeTextEffectKinds(effects),
		triggers: normalizeTextEffectTriggers(rawTriggers),
		randomIntervalMs: Number.isFinite(intervalValue) ? intervalValue : undefined,
		typingOptions,
		glitchOptions,
		signalLossOptions,
		glitchBurstOptions,
		censorOptions,
		uncensorOptions,
		scrambleOptions,
		slowRevealOptions,
		shuffleOptions,
	};
}
