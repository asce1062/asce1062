import type {
	TextEffectKind,
	TextEffectTrigger,
	TextEffectConfig,
	TypingEffectOptions,
	GlitchLockOnEffectOptions,
	SignalLossEffectOptions,
	CorruptionEffectOptions,
	CensorEffectOptions,
	UncensorEffectOptions,
	ScrambleEffectOptions,
	SlowRevealEffectOptions,
	ShuffleEffectOptions,
	GlitchEffectOptions,
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
 * - `data-text-effect-triggers="load, hover, activate, resume, route-enter, intersection, idle-return, content-change, random-effect, random-time, random-interval"`
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
 * - `data-text-effect-corruption-charset`      — "blocks" | "letters" | "binary" | any custom string (corruption burst)
 * - `data-text-effect-corruption-frames`       — frame count (default 10) (corruption burst)
 * - `data-text-effect-corruption-intensity`    — fraction corrupted per frame 0–1 (default 0.5) (corruption burst)
 * - `data-text-effect-corruption-restore`      — "false" to leave final corrupted frame; default true (corruption burst)
 * - `data-text-effect-corruption-items`        — comma-separated corruption chars; takes precedence over charset (corruption burst)
 * - `data-text-effect-censor-fill-char`        — masking character (default "█")
 * - `data-text-effect-censor-restore`          — "false" to stay censored; default true (restore)
 * - `data-text-effect-censor-delay-ms`         — ms between each letter replacement (overrides durationMs)
 * - `data-text-effect-censor-hold-ms`          — ms to hold censored state before restoring (default 0)
 * - `data-text-effect-uncensor-fill-char`      — masking character (default "█")
 * - `data-text-effect-uncensor-delay-ms`      — ms between each letter reveal (overrides durationMs)
 * - `data-text-effect-scramble-count`          — noise iterations (default 20)
 * - `data-text-effect-scramble-charset`        — "blocks" | "letters" | "binary" | any custom string
 * - `data-text-effect-scramble-delay-ms`       — ms between each scramble tick (overrides durationMs)
 * - `data-text-effect-scramble-restore`        — "false" to leave the final scrambled state; default true
 * - `data-text-effect-scramble-items`          — comma-separated scramble chars; takes precedence over charset
 * - `data-text-effect-slow-reveal-cycles`      — slot-machine cycles per char (default 3)
 * - `data-text-effect-slow-reveal-charset`     — "blocks" | "letters" | "binary" | any custom string
 * - `data-text-effect-slow-reveal-delay-ms`    — ms between each step (overrides durationMs)
 * - `data-text-effect-slow-reveal-items`       — comma-separated slot-machine chars; takes precedence over charset
 * - `data-text-effect-shuffle-count`           — anagram-shuffle frames (default 20)
 * - `data-text-effect-shuffle-delay-ms`        — ms between each shuffle frame (overrides durationMs)
 * - `data-text-effect-shuffle-restore`         — "false" to leave the final shuffled frame; default true
 * - `data-text-effect-glitch-charset`          — "blocks" | "letters" | "binary" | any custom string (standalone glitch)
 * - `data-text-effect-glitch-reverse`          — presence attribute; reverses reveal direction right→left (standalone glitch)
 * - `data-text-effect-glitch-delay-ms`         — ms between each reveal tick (overrides auto-duration) (standalone glitch)
 * - `data-text-effect-glitch-count`            — extra noise frames before reveal starts (default 5) (standalone glitch)
 * - `data-text-effect-glitch-items`            — comma-separated glitch chars; takes precedence over charset (standalone glitch)
 * - `data-text-effect-glitch-shimmer-ms`       — max quiet ms between post-settle shimmer pulses (default 5000) (standalone glitch)
 * - `data-text-effect-glitch-shimmer`          — "false" to disable the post-settle shimmer loop (standalone glitch)
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
	const glitchLockOnOpts: GlitchLockOnEffectOptions = {};
	if (el.dataset.textEffectGlitchLockCharset !== undefined)
		glitchLockOnOpts.charset = el.dataset.textEffectGlitchLockCharset;
	if (el.dataset.textEffectGlitchLockReverse !== undefined) glitchLockOnOpts.reverse = true;
	const glitchLockFrames = el.dataset.textEffectGlitchLockFrames
		? Number.parseInt(el.dataset.textEffectGlitchLockFrames, 10)
		: NaN;
	if (Number.isFinite(glitchLockFrames)) glitchLockOnOpts.frameCount = glitchLockFrames;
	const glitchLockIntensity = el.dataset.textEffectGlitchLockIntensity
		? Number.parseFloat(el.dataset.textEffectGlitchLockIntensity)
		: NaN;
	if (Number.isFinite(glitchLockIntensity)) glitchLockOnOpts.intensity = Math.min(1, Math.max(0, glitchLockIntensity));
	const glitchLockOnOptions = Object.keys(glitchLockOnOpts).length > 0 ? glitchLockOnOpts : undefined;

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

	// --- corruption options ---
	const corruptionOpts: CorruptionEffectOptions = {};
	if (el.dataset.textEffectCorruptionCharset !== undefined)
		corruptionOpts.charset = el.dataset.textEffectCorruptionCharset;
	const corruptionCount = el.dataset.textEffectCorruptionCount
		? Number.parseInt(el.dataset.textEffectCorruptionCount, 10)
		: NaN;
	if (Number.isFinite(corruptionCount)) corruptionOpts.count = corruptionCount;
	const corruptionDelayMs = el.dataset.textEffectCorruptionDelayMs
		? Number.parseInt(el.dataset.textEffectCorruptionDelayMs, 10)
		: NaN;
	if (Number.isFinite(corruptionDelayMs)) corruptionOpts.delayMs = corruptionDelayMs;
	const corruptionIntensity = el.dataset.textEffectCorruptionIntensity
		? Number.parseFloat(el.dataset.textEffectCorruptionIntensity)
		: NaN;
	if (Number.isFinite(corruptionIntensity)) corruptionOpts.intensity = Math.min(1, Math.max(0, corruptionIntensity));
	if (el.dataset.textEffectCorruptionRestore !== undefined)
		corruptionOpts.restore = el.dataset.textEffectCorruptionRestore !== "false";
	if (el.dataset.textEffectCorruptionItems !== undefined) {
		const parsed = el.dataset.textEffectCorruptionItems
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean);
		if (parsed.length > 0) corruptionOpts.items = parsed;
	}
	const corruptionOptions = Object.keys(corruptionOpts).length > 0 ? corruptionOpts : undefined;

	// --- censor options ---
	const censorOpts: CensorEffectOptions = {};
	if (el.dataset.textEffectCensorFillChar !== undefined) censorOpts.fillChar = el.dataset.textEffectCensorFillChar;
	if (el.dataset.textEffectCensorRestore !== undefined)
		censorOpts.restore = el.dataset.textEffectCensorRestore !== "false";
	const censorDelayMs = el.dataset.textEffectCensorDelayMs
		? Number.parseInt(el.dataset.textEffectCensorDelayMs, 10)
		: NaN;
	if (Number.isFinite(censorDelayMs)) censorOpts.delayMs = censorDelayMs;
	const censorHoldMs = el.dataset.textEffectCensorHoldMs ? Number.parseInt(el.dataset.textEffectCensorHoldMs, 10) : NaN;
	if (Number.isFinite(censorHoldMs)) censorOpts.holdMs = censorHoldMs;
	const censorOptions = Object.keys(censorOpts).length > 0 ? censorOpts : undefined;

	// --- uncensor options ---
	const uncensorOpts: UncensorEffectOptions = {};
	if (el.dataset.textEffectUncensorFillChar !== undefined)
		uncensorOpts.fillChar = el.dataset.textEffectUncensorFillChar;
	const uncensorDelayMs = el.dataset.textEffectUncensorDelayMs
		? Number.parseInt(el.dataset.textEffectUncensorDelayMs, 10)
		: NaN;
	if (Number.isFinite(uncensorDelayMs)) uncensorOpts.delayMs = uncensorDelayMs;
	const uncensorOptions = Object.keys(uncensorOpts).length > 0 ? uncensorOpts : undefined;

	// --- scramble options ---
	const scrambleOpts: ScrambleEffectOptions = {};
	if (el.dataset.textEffectScrambleCharset !== undefined) scrambleOpts.charset = el.dataset.textEffectScrambleCharset;
	const scrambleCount = el.dataset.textEffectScrambleCount
		? Number.parseInt(el.dataset.textEffectScrambleCount, 10)
		: NaN;
	if (Number.isFinite(scrambleCount)) scrambleOpts.count = scrambleCount;
	const scrambleDelayMs = el.dataset.textEffectScrambleDelayMs
		? Number.parseInt(el.dataset.textEffectScrambleDelayMs, 10)
		: NaN;
	if (Number.isFinite(scrambleDelayMs)) scrambleOpts.delayMs = scrambleDelayMs;
	if (el.dataset.textEffectScrambleRestore !== undefined)
		scrambleOpts.restore = el.dataset.textEffectScrambleRestore !== "false";
	if (el.dataset.textEffectScrambleItems !== undefined) {
		const parsed = el.dataset.textEffectScrambleItems
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean);
		if (parsed.length > 0) scrambleOpts.items = parsed;
	}
	const scrambleOptions = Object.keys(scrambleOpts).length > 0 ? scrambleOpts : undefined;

	// --- slow-reveal options ---
	const slowRevealOpts: SlowRevealEffectOptions = {};
	if (el.dataset.textEffectSlowRevealCharset !== undefined)
		slowRevealOpts.charset = el.dataset.textEffectSlowRevealCharset;
	const slowRevealCycles = el.dataset.textEffectSlowRevealCycles
		? Number.parseInt(el.dataset.textEffectSlowRevealCycles, 10)
		: NaN;
	if (Number.isFinite(slowRevealCycles)) slowRevealOpts.cyclesPerChar = slowRevealCycles;
	const slowRevealDelayMs = el.dataset.textEffectSlowRevealDelayMs
		? Number.parseInt(el.dataset.textEffectSlowRevealDelayMs, 10)
		: NaN;
	if (Number.isFinite(slowRevealDelayMs)) slowRevealOpts.delayMs = slowRevealDelayMs;
	if (el.dataset.textEffectSlowRevealItems !== undefined) {
		const parsed = el.dataset.textEffectSlowRevealItems
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean);
		if (parsed.length > 0) slowRevealOpts.items = parsed;
	}
	const slowRevealOptions = Object.keys(slowRevealOpts).length > 0 ? slowRevealOpts : undefined;

	// --- shuffle options ---
	const shuffleOpts: ShuffleEffectOptions = {};
	const shuffleCount = el.dataset.textEffectShuffleCount ? Number.parseInt(el.dataset.textEffectShuffleCount, 10) : NaN;
	if (Number.isFinite(shuffleCount)) shuffleOpts.count = shuffleCount;
	const shuffleDelayMs = el.dataset.textEffectShuffleDelayMs
		? Number.parseInt(el.dataset.textEffectShuffleDelayMs, 10)
		: NaN;
	if (Number.isFinite(shuffleDelayMs)) shuffleOpts.delayMs = shuffleDelayMs;
	if (el.dataset.textEffectShuffleRestore !== undefined)
		shuffleOpts.restore = el.dataset.textEffectShuffleRestore !== "false";
	const shuffleOptions = Object.keys(shuffleOpts).length > 0 ? shuffleOpts : undefined;

	// --- glitch options ---
	const glitchOpts: GlitchEffectOptions = {};
	if (el.dataset.textEffectGlitchCharset !== undefined) glitchOpts.charset = el.dataset.textEffectGlitchCharset;
	if (el.dataset.textEffectGlitchReverse !== undefined) glitchOpts.reverse = true;
	const glitchDelayMs = el.dataset.textEffectGlitchDelayMs
		? Number.parseInt(el.dataset.textEffectGlitchDelayMs, 10)
		: NaN;
	if (Number.isFinite(glitchDelayMs)) glitchOpts.delayMs = glitchDelayMs;
	const glitchCount = el.dataset.textEffectGlitchCount ? Number.parseInt(el.dataset.textEffectGlitchCount, 10) : NaN;
	if (Number.isFinite(glitchCount)) glitchOpts.count = glitchCount;
	if (el.dataset.textEffectGlitchItems !== undefined) {
		const parsed = el.dataset.textEffectGlitchItems
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean);
		if (parsed.length > 0) glitchOpts.items = parsed;
	}
	const glitchShimmerMs = el.dataset.textEffectGlitchShimmerMs
		? Number.parseInt(el.dataset.textEffectGlitchShimmerMs, 10)
		: NaN;
	if (Number.isFinite(glitchShimmerMs)) glitchOpts.shimmerIntervalMs = glitchShimmerMs;
	if (el.dataset.textEffectGlitchShimmer !== undefined)
		glitchOpts.shimmer = el.dataset.textEffectGlitchShimmer !== "false";
	const glitchOptions = Object.keys(glitchOpts).length > 0 ? glitchOpts : undefined;

	return {
		effects: normalizeTextEffectKinds(effects),
		triggers: normalizeTextEffectTriggers(rawTriggers),
		randomIntervalMs: Number.isFinite(intervalValue) ? intervalValue : undefined,
		typingOptions,
		glitchLockOnOptions,
		signalLossOptions,
		corruptionOptions,
		censorOptions,
		uncensorOptions,
		scrambleOptions,
		slowRevealOptions,
		shuffleOptions,
		glitchOptions,
	};
}
