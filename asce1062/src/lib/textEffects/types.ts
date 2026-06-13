export type TextEffectFamily = "type" | "cipher" | "rare";
export type TextEffectRole = "enter" | "exit" | "standalone";
export type TextEffectKind =
	| "typing"
	| "backspace"
	| "decrypt"
	| "entropy"
	| "glitch-lock-on"
	| "signal-loss"
	| "glitch"
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
	glitch: {
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
	| "random-time";

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
export type GlitchEffectOptions = {
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

/** Per-effect customization for standalone glitch burst renderer. */
export type GlitchBurstEffectOptions = {
	/** 0–1 fraction of chars corrupted per frame. Default 0.5. */
	intensity?: number;
	/** Number of glitch frames. Default 10. */
	frameCount?: number;
	/** Noise charset. Default "blocks". */
	charset?: GlitchCharset;
	durationMs?: number;
};

/** Per-effect customization for censor (L-to-R fill) renderer. */
export type CensorEffectOptions = {
	/** Masking character or array of chars to pick randomly. Default "█". */
	fillChar?: string | string[];
	/** Restore original text after censoring. Default true. */
	restore?: boolean;
	durationMs?: number;
};

/** Per-effect customization for uncensor (reveal from fully censored) renderer. */
export type UncensorEffectOptions = {
	/** Masking character. Default "█". */
	fillChar?: string;
	durationMs?: number;
};

/** Per-effect customization for scramble (progressive random noise accumulation) renderer. */
export type ScrambleEffectOptions = {
	/** Number of scramble iterations. Default 20. */
	count?: number;
	/** Noise charset. Default "blocks". */
	charset?: GlitchCharset;
	durationMs?: number;
};

/** Per-effect customization for slow-reveal (per-char slot-machine lock-in) renderer. */
export type SlowRevealEffectOptions = {
	/** Number of noise cycles each char spins through before locking in. Default 3. */
	cyclesPerChar?: number;
	/** Noise charset. Default "blocks". */
	charset?: GlitchCharset;
	durationMs?: number;
};

/** Per-effect customization for shuffle (anagram frame) renderer. */
export type ShuffleEffectOptions = {
	/** Number of shuffle frames. Default 20. */
	count?: number;
	durationMs?: number;
};

export type TextEffectConfig = {
	effects: TextEffectKind[];
	triggers: TextEffectTrigger[];
	randomIntervalMs?: number;
	typingOptions?: TypingEffectOptions;
	glitchOptions?: GlitchEffectOptions;
	signalLossOptions?: SignalLossEffectOptions;
	glitchBurstOptions?: GlitchBurstEffectOptions;
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
	glitchOptions?: GlitchEffectOptions;
	signalLossOptions?: SignalLossEffectOptions;
	glitchBurstOptions?: GlitchBurstEffectOptions;
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
