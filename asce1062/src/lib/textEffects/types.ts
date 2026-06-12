export type TerminalTextEffectFamily = "type" | "cipher" | "rare";
export type TerminalTextEffectRole = "enter" | "exit" | "standalone";
export type TerminalTextEffectKind = "typing" | "backspace" | "decrypt" | "entropy" | "glitch-lock-on" | "signal-loss";
export type TerminalTextEffectState = "none" | TerminalTextEffectKind;
export type TerminalTextEffectReducedMotionStrategy = "instant-target" | "instant-restore" | "instant-clear";

export type TerminalTextEffectMetadata = {
	/** Internal grouping used to infer enter/exit pairs without hardcoding pairs at callsites. */
	family: TerminalTextEffectFamily;
	/** Direction of travel for transition sequencing. */
	role: TerminalTextEffectRole;
	/** Whether this effect can run alone and restore/settle without implying a content change. */
	standaloneSafe: boolean;
	/** Central reduced-motion fallback for this effect when animation is disabled. */
	reducedMotion: TerminalTextEffectReducedMotionStrategy;
};

export const TERMINAL_TEXT_EFFECTS: Record<TerminalTextEffectKind, TerminalTextEffectMetadata> = {
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
};

export type TerminalTextEffectTrigger =
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

export type TerminalTextEffectConfig = {
	effects: TerminalTextEffectKind[];
	triggers: TerminalTextEffectTrigger[];
	randomIntervalMs?: number;
};

export type TerminalTextTransitionMode = "standalone" | "enter-only" | "exit-only" | "full-transition";

export type TerminalTextEffectOptions = {
	durationMs?: number;
	typingStepMs?: number;
	rootEl?: HTMLElement | null;
	rootEffectDataset?: string;
	onComplete?: () => void;
	reducedMotion?: boolean;
};

export type TerminalTextTransitionOptions = TerminalTextEffectOptions & {
	el: HTMLElement | null;
	fromText?: string;
	toText: string;
	mode?: TerminalTextTransitionMode;
	enterEffect?: TerminalTextEffectKind | "none";
	exitEffect?: TerminalTextEffectKind | "none";
	effect?: TerminalTextEffectKind | "none";
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
export const TERMINAL_TEXT_EFFECT_FAMILY_PAIRS: Partial<
	Record<TerminalTextEffectFamily, { enter: TerminalTextEffectKind; exit: TerminalTextEffectKind }>
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
