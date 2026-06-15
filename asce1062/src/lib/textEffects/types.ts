export type TextEffectFamily = "type" | "cipher" | "rare";
export type TextEffectRole = "enter" | "exit" | "standalone";
export type TextEffectKind =
	| "typing"
	| "backspace"
	| "decrypt"
	| "entropy"
	| "glitch-lock-on"
	| "signal-loss"
	| "corruption"
	| "censor"
	| "uncensor"
	| "scramble"
	| "slow-reveal"
	| "shuffle";
export type TextEffectState = "none" | TextEffectKind;
export type TextEffectReducedMotionStrategy = "instant-target" | "instant-restore" | "instant-clear";

export type TextEffectMetadata = {
	/** Internal grouping used to infer enter/exit pairs without hardcoding pairs at callsites. */
	family: TextEffectFamily;
	/** Direction of travel for transition sequencing. */
	role: TextEffectRole;
	/** Whether this effect can run alone and restore/settle without implying a content change. */
	standaloneSafe: boolean;
	/** Central reduced-motion fallback for this effect when animation is disabled. */
	reducedMotion: TextEffectReducedMotionStrategy;
};

export const TEXT_EFFECTS: Record<TextEffectKind, TextEffectMetadata> = {
	typing: {
		family: "type",
		role: "enter",
		standaloneSafe: false,
		reducedMotion: "instant-target",
	},
	backspace: {
		family: "type",
		role: "exit",
		standaloneSafe: true,
		reducedMotion: "instant-restore",
	},
	decrypt: {
		family: "cipher",
		role: "enter",
		standaloneSafe: true,
		reducedMotion: "instant-target",
	},
	entropy: {
		family: "cipher",
		role: "exit",
		standaloneSafe: true,
		reducedMotion: "instant-restore",
	},
	"glitch-lock-on": {
		family: "rare",
		role: "enter",
		standaloneSafe: true,
		reducedMotion: "instant-target",
	},
	"signal-loss": {
		family: "rare",
		role: "exit",
		standaloneSafe: true,
		reducedMotion: "instant-restore",
	},
	corruption: {
		family: "rare",
		role: "standalone",
		standaloneSafe: true,
		reducedMotion: "instant-restore",
	},
	censor: {
		family: "rare",
		role: "standalone",
		standaloneSafe: true,
		reducedMotion: "instant-restore",
	},
	uncensor: {
		family: "rare",
		role: "standalone",
		standaloneSafe: true,
		reducedMotion: "instant-restore",
	},
	scramble: {
		family: "rare",
		role: "standalone",
		standaloneSafe: true,
		reducedMotion: "instant-restore",
	},
	"slow-reveal": {
		family: "rare",
		role: "standalone",
		standaloneSafe: true,
		reducedMotion: "instant-restore",
	},
	shuffle: {
		family: "rare",
		role: "standalone",
		standaloneSafe: true,
		reducedMotion: "instant-restore",
	},
};

export type TextEffectTrigger =
	| "load"
	| "hover"
	| "focus"
	| "activate"
	| "tap"
	| "click"
	| "resume"
	| "route-enter"
	| "intersection"
	| "idle-return"
	| "content-change"
	| "manual"
	| "random-effect"
	| "random-time"
	| "random-interval";

/** Charset for glitch-lock-on artifact characters. Named presets or any custom string. */
export type GlitchCharset = "blocks" | "letters" | "binary" | (string & {});

/** Per-effect customization for typing and backspace renderers. */
export type TypingEffectOptions = {
	stepMs?: number;
	cursorChar?: string;
	cursorBlinkIntervalMs?: number;
	endBlinkCount?: number;
	leadInMs?: number;
	stutterChance?: number;
	stutterMaxMs?: number;
	punctuationPauseMultiplier?: number;
};

/** Per-effect customization for glitch-lock-on renderer. */
export type GlitchLockOnEffectOptions = {
	charset?: GlitchCharset;
	reverse?: boolean;
	frameCount?: number;
	intensity?: number;
	durationMs?: number;
};

/** Per-effect customization for signal-loss renderer. */
export type SignalLossEffectOptions = {
	dropoutChar?: string;
	blackoutHoldMs?: number;
	/** Pass false to disable the mid-animation false-recovery flash. Defaults to true. */
	falseRecovery?: boolean;
	durationMs?: number;
};

/** Per-effect customization for standalone corruption renderer. */
export type CorruptionEffectOptions = {
	/** 0–1 fraction of chars corrupted per frame. Default 0.5. */
	intensity?: number;
	/** Number of corruption frames. Default 10. */
	count?: number;
	/** Named noise charset preset. Ignored when `items` is provided. Default "blocks". */
	charset?: GlitchCharset;
	/** Explicit array of corruption characters. Takes precedence over `charset`. */
	items?: string[];
	/** Ms between each frame. When provided, takes precedence over durationMs. */
	delayMs?: number;
	/** Restore original text after all frames complete. Default true. When false, the final corrupted frame is left in place. */
	restore?: boolean;
	durationMs?: number;
};

/** Per-effect customization for censor (L-to-R fill) renderer. */
export type CensorEffectOptions = {
	/** Masking character or array of chars to pick randomly. Default "█". */
	fillChar?: string | string[];
	/** Restore original text after censoring. Default true. */
	restore?: boolean;
	/** Ms between each letter replacement. When provided, takes precedence over durationMs. */
	delayMs?: number;
	/** Ms to hold the censored state before restoring. Default 0. */
	holdMs?: number;
	durationMs?: number;
};

/** Per-effect customization for uncensor (reveal from fully censored) renderer. */
export type UncensorEffectOptions = {
	/** Masking character. Default "█". */
	fillChar?: string;
	/** Ms between each letter reveal. When provided, takes precedence over durationMs. */
	delayMs?: number;
	durationMs?: number;
};

/** Per-effect customization for scramble renderer. */
export type ScrambleEffectOptions = {
	/** Number of scramble iterations. Default 20. */
	count?: number;
	/** Named noise charset preset. Ignored when `items` is provided. Default "blocks". */
	charset?: GlitchCharset;
	/** Explicit array of scramble characters. Takes precedence over `charset`. */
	items?: string[];
	/** Ms between each scramble tick. When provided, takes precedence over durationMs. */
	delayMs?: number;
	/** Restore original text after all iterations. Default true. When false, the final scrambled state is left in place. */
	restore?: boolean;
	durationMs?: number;
};

/** Per-effect customization for slow-reveal (per-char slot-machine lock-in) renderer. */
export type SlowRevealEffectOptions = {
	/** Number of noise cycles each char spins through before locking in. Default 3. */
	cyclesPerChar?: number;
	/** Named noise charset preset. Ignored when `items` is provided. Default "blocks". */
	charset?: GlitchCharset;
	/** Explicit array of slot-machine characters. Takes precedence over `charset`. */
	items?: string[];
	/** Ms between each step. When provided, takes precedence over durationMs. */
	delayMs?: number;
	durationMs?: number;
};

/** Per-effect customization for shuffle (anagram frame) renderer. */
export type ShuffleEffectOptions = {
	/** Number of shuffle frames. Default 20. */
	count?: number;
	/** Ms between each shuffle frame. When provided, takes precedence over durationMs. */
	delayMs?: number;
	/** Restore original text after all frames. Default true. When false, the final shuffled frame is left in place. */
	restore?: boolean;
	durationMs?: number;
};

export type TextEffectConfig = {
	effects: TextEffectKind[];
	triggers: TextEffectTrigger[];
	randomIntervalMs?: number;
	typingOptions?: TypingEffectOptions;
	glitchLockOnOptions?: GlitchLockOnEffectOptions;
	signalLossOptions?: SignalLossEffectOptions;
	corruptionOptions?: CorruptionEffectOptions;
	censorOptions?: CensorEffectOptions;
	uncensorOptions?: UncensorEffectOptions;
	scrambleOptions?: ScrambleEffectOptions;
	slowRevealOptions?: SlowRevealEffectOptions;
	shuffleOptions?: ShuffleEffectOptions;
};

export type TextTransitionMode = "standalone" | "enter-only" | "exit-only" | "full-transition";

export type TextEffectOptions = {
	durationMs?: number;
	typingStepMs?: number;
	rootEl?: HTMLElement | null;
	rootEffectDataset?: string;
	onComplete?: () => void;
	reducedMotion?: boolean;
	typingOptions?: TypingEffectOptions;
	glitchLockOnOptions?: GlitchLockOnEffectOptions;
	signalLossOptions?: SignalLossEffectOptions;
	corruptionOptions?: CorruptionEffectOptions;
	censorOptions?: CensorEffectOptions;
	uncensorOptions?: UncensorEffectOptions;
	scrambleOptions?: ScrambleEffectOptions;
	slowRevealOptions?: SlowRevealEffectOptions;
	shuffleOptions?: ShuffleEffectOptions;
};

export type TextTransitionOptions = TextEffectOptions & {
	el: HTMLElement | null;
	fromText?: string;
	toText: string;
	mode?: TextTransitionMode;
	enterEffect?: TextEffectKind | "none";
	exitEffect?: TextEffectKind | "none";
	effect?: TextEffectKind | "none";
	holdMs?: number;
	reason?: string;
};

/**
 * Family pair map.
 *
 * This is what lets callers request `typing` while the coordinator infers that
 * changed stable text should first leave with `backspace`. The same rule applies
 * to `decrypt -> entropy` and `glitch-lock-on -> signal-loss`.
 */
export const TEXT_EFFECT_FAMILY_PAIRS: Partial<
	Record<TextEffectFamily, { enter: TextEffectKind; exit: TextEffectKind }>
> = {
	type: { enter: "typing", exit: "backspace" },
	cipher: { enter: "decrypt", exit: "entropy" },
	rare: { enter: "glitch-lock-on", exit: "signal-loss" },
};

export type ActiveEffectHandle = {
	cancel: () => void;
};

export type EffectRendererHandle = {
	promise: Promise<void>;
	cancel: () => void;
};

export type TimeoutHandle = ReturnType<typeof globalThis.setTimeout>;
export type IntervalHandle = ReturnType<typeof globalThis.setInterval>;
