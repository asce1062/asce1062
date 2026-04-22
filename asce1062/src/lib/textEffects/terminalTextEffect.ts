/**
 * Shared terminal-text flourish engine.
 *
 * This module is the reusable implementation layer for terminal-adjacent text
 * motion. It supports both small decorative flourishes and full text-to-text
 * transitions where one stable string exits before the next stable string
 * enters.
 *
 * It supports two integration styles:
 *
 * 1. Trigger-driven consumers
 *    Use `readTerminalTextEffectConfig` + `bindTerminalTextEffectTriggers`
 *    through `initTextEffectRegistry()` in `src/scripts/textEffectRegistry.ts`.
 *    Best for site greeting/tagline-style embellishments that should react to
 *    load/hover/tap/click/random timing.
 *
 * 2. State-driven consumers
 *    Call `playTerminalTextEffect` / `resetTerminalTextEffect` directly.
 *    Best for features where a coordinator/state machine decides exactly when
 *    an effect should run and which effect should be used.
 *
 * Motion vocabulary:
 *   - Effect names are the public/declarative values:
 *     `typing`, `backspace`, `decrypt`, `entropy`, `glitch-lock-on`,
 *     `signal-loss`.
 *   - Families are internal pairing groups:
 *     `type` pairs `typing` with `backspace`
 *     `cipher` pairs `decrypt` with `entropy`
 *     `rare` pairs `glitch-lock-on` with `signal-loss`
 *   - Roles describe lifecycle direction:
 *     `enter` effects reveal or resolve text into place
 *     `exit` effects remove or destabilize text before handoff
 *     `standalone` is reserved for future effects that are neither directional
 *   - `standaloneSafe` means an effect may run as a flourish without changing
 *     the stable text. Example: `backspace` can delete and then restore the
 *     same text; `typing` is not used for random standalone selection because
 *     it reads more clearly as an enter/reveal phase.
 *
 * New effects should be registered in `TERMINAL_TEXT_EFFECTS` with family,
 * lifecycle role, standalone eligibility, and reduced-motion strategy before
 * adding a renderer. The transition coordinator uses that metadata to keep
 * randomization, standalone flourishes, and reduced-motion behavior coherent.
 *
 * Stable text model:
 *   - `data-text-effect-stable-text` is the generic cache of the element's
 *     settled text after an effect completes.
 *   - `data-greeting-target` is still written for backwards compatibility with
 *     older navbrand/header code, but new consumers should treat
 *     `data-text-effect-stable-text` as the generic contract.
 *   - `load` uses entry-only playback. Later replay triggers for enter effects
 *     use the full family loop against the stable text:
 *     stable text -> paired exit -> same stable text -> enter.
 *   - `content-change` is the explicit trigger for dynamic surfaces. When the
 *     element's observed content changes, playback becomes:
 *     old stable content -> paired exit -> new content -> enter.
 *
 * Trigger vocabulary:
 *   - `load`          : play immediately when bound
 *   - `hover`         : play on mouseenter
 *   - `focus`         : play when the element receives focus
 *   - `activate`      : semantic alias for tap + click activation
 *   - `tap`           : play on touchstart
 *   - `click`         : play on click (desktop-friendly activation)
 *   - `resume`        : play when the tab becomes visible again
 *   - `route-enter`   : play after Astro soft-navigation swaps in the route
 *   - `intersection`  : play when the element scrolls into view
 *   - `idle-return`   : play when the user returns after inactivity
 *   - `content-change`: play when the element's observed content changes
 *   - `manual`        : reserved for explicit external triggering
 *   - `random-effect` : randomize across the element's declared effect list
 *   - `random-time`   : replay on an interval
 *
 * Declarative markup contract:
 *   data-text-effect="typing"
 *   data-text-effect="decrypt, entropy, typing, backspace, glitch-lock-on, signal-loss"
 *   data-text-effect="glitch-lock-on, signal-loss" // rare, explicit opt-in
 *   data-text-effect-triggers="load, hover, activate, resume, route-enter, intersection, idle-return, content-change, random-effect, random-time"
 *   data-text-effect-interval-ms="18000"
 *   data-text-effect-managed="manual"         // optional registry skip hint
 *
 * Design constraints:
 *   - Keep playback logic centralized so flourish behavior stays consistent.
 *   - Keep trigger logic generic so new flourish targets do not need bespoke
 *     scripts or duplicated querySelector boilerplate.
 *   - Keep state-driven timing out of this file; navbrand-style policy belongs
 *     in coordinator/state modules such as `src/scripts/navBrand.ts` and
 *     `src/lib/navBrand/state.ts`, while this file only parses, binds, and
 *     plays effects.
 */
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

/**
 * Default trigger set for generic decorative text.
 *
 * Consumers can stack extra triggers such as `random-effect` / `random-time`
 * without losing the base load/hover/tap/click behavior.
 */
export const DEFAULT_TERMINAL_TEXT_EFFECT_TRIGGERS: TerminalTextEffectTrigger[] = ["load", "hover", "tap", "click"];
const DEFAULT_RANDOM_INTERVAL_MS = 20_000;
const DEFAULT_IDLE_RETURN_DELAY_MS = 45_000;

const DECRYPT_CHARS = "░▒▓█▐▌▄▀■□▪▫◆◇○●◌◍◎◉▶▷◀◁▸▹◂◃⬛⬜▬▭▮▯◥◤◣◢◿█▄▌▐▀▘▝▀▖▍▞▛▗▚▐▜▃▙▟▉";
const DEFAULT_TYPING_STEP_MS = 26;
const DEFAULT_TYPING_STEP_VARIANCE_MS = 42;
const DEFAULT_TYPING_MIN_DURATION_MS = 780;
const DEFAULT_TYPING_MAX_DURATION_MS = 2_400;
const DEFAULT_TYPING_BASE_MULTIPLIER = 2.4;
const DEFAULT_TYPING_SHORT_TEXT_THRESHOLD = 8;
const DEFAULT_TYPING_SHORT_TEXT_BONUS_MULTIPLIER = 1.4;
const DEFAULT_TYPING_LEAD_IN_MS = 120;
const DEFAULT_TYPING_END_BLINK_INTERVAL_MS = 500;
const DEFAULT_TYPING_END_BLINK_COUNT = 3;
const DEFAULT_HUMAN_PAUSE_CHANCE = 0.12;
const DEFAULT_HUMAN_PAUSE_MIN_MS = 140;
const DEFAULT_HUMAN_PAUSE_MAX_MS = 420;
const DEFAULT_DECRYPT_TOTAL_FRAMES = 40;
const DEFAULT_BACKSPACE_STEP_MS = 42;
const DEFAULT_BACKSPACE_HOLD_MS = 140;
const DEFAULT_ENTROPY_TOTAL_FRAMES = 22;
const DEFAULT_GLITCH_LOCK_TOTAL_FRAMES = 6;
const DEFAULT_SIGNAL_LOSS_TOTAL_FRAMES = 7;
const DEFAULT_SIGNAL_LOSS_BLACKOUT_HOLD_MS = 760;
const DEFAULT_TRANSITION_HOLD_MS = 80;
export const DEFAULT_ROUTE_ENTER_SETTLE_DELAY_MS = 1062;
const TERMINAL_BLOCK_CURSOR = "█";
const SIGNAL_ARTIFACTS = [" ", "_", "-", "|", "/", "\\"] as const;

const EFFECT_DURATION_PROFILES: Record<
	TerminalTextEffectKind,
	{
		minMs: number;
		maxMs: number;
		perCharMs: number;
		baseMs: number;
	}
> = {
	typing: {
		minMs: DEFAULT_TYPING_MIN_DURATION_MS,
		maxMs: DEFAULT_TYPING_MAX_DURATION_MS,
		perCharMs: DEFAULT_TYPING_STEP_MS * DEFAULT_TYPING_BASE_MULTIPLIER,
		baseMs: DEFAULT_TYPING_LEAD_IN_MS,
	},
	backspace: {
		minMs: 620,
		maxMs: 1_600,
		perCharMs: 46,
		baseMs: DEFAULT_BACKSPACE_HOLD_MS,
	},
	decrypt: {
		minMs: 760,
		maxMs: 1_400,
		perCharMs: 18,
		baseMs: 620,
	},
	entropy: {
		minMs: 620,
		maxMs: 1_200,
		perCharMs: 16,
		baseMs: 500,
	},
	"glitch-lock-on": {
		minMs: 420,
		maxMs: 760,
		perCharMs: 8,
		baseMs: 360,
	},
	"signal-loss": {
		minMs: 420,
		maxMs: 820,
		perCharMs: 10,
		baseMs: 360,
	},
};

type ActiveEffectHandle = {
	cancel: () => void;
};

type TimeoutHandle = ReturnType<typeof globalThis.setTimeout>;
type IntervalHandle = ReturnType<typeof globalThis.setInterval>;

type TerminalTextEffectOptions = {
	durationMs?: number;
	typingStepMs?: number;
	rootEl?: HTMLElement | null;
	rootEffectDataset?: string;
	onComplete?: () => void;
	reducedMotion?: boolean;
};

export type TerminalTextTransitionMode = "standalone" | "enter-only" | "exit-only" | "full-transition";

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

const activeEffects = new WeakMap<HTMLElement, ActiveEffectHandle>();
/**
 * Family pair map.
 *
 * This is what lets callers request `typing` while the coordinator infers that
 * changed stable text should first leave with `backspace`. The same rule applies
 * to `decrypt -> entropy` and `glitch-lock-on -> signal-loss`.
 */
const TERMINAL_TEXT_EFFECT_FAMILY_PAIRS: Partial<
	Record<TerminalTextEffectFamily, { enter: TerminalTextEffectKind; exit: TerminalTextEffectKind }>
> = {
	type: { enter: "typing", exit: "backspace" },
	cipher: { enter: "decrypt", exit: "entropy" },
	rare: { enter: "glitch-lock-on", exit: "signal-loss" },
};
const triggerHandlers = new WeakMap<
	HTMLElement,
	{
		mouseenter: EventListener;
		mouseleave: EventListener;
		focusin: EventListener;
		touchstart: EventListener;
		click: EventListener;
	}
>();
const randomTimers = new WeakMap<HTMLElement, IntervalHandle>();
const triggerCleanups = new WeakMap<HTMLElement, Array<() => void>>();
const hoverReplayLocks = new WeakSet<HTMLElement>();
const hoverReplayUnlockers = new WeakMap<HTMLElement, EventListener>();

function clearActiveEffect(el: HTMLElement): void {
	activeEffects.get(el)?.cancel();
	activeEffects.delete(el);
}

function hasActiveEffect(el: HTMLElement): boolean {
	return activeEffects.has(el);
}

/** Optional root dataset hook so consumers can style active effects in CSS. */
function setRootEffect(
	rootEl: HTMLElement | null | undefined,
	effect: TerminalTextEffectState,
	rootEffectDataset = "navbrandEffect"
): void {
	if (!rootEl) return;
	rootEl.dataset[rootEffectDataset] = effect;
}

export function getTerminalTextEffectMetadata(effect: TerminalTextEffectKind): TerminalTextEffectMetadata {
	return TERMINAL_TEXT_EFFECTS[effect];
}

/** Resolve the opposite directional phase inside an effect's family. */
export function getPairedTerminalTextEffect(
	effect: TerminalTextEffectKind,
	role: TerminalTextEffectRole
): TerminalTextEffectKind | "none" {
	const metadata = TERMINAL_TEXT_EFFECTS[effect];
	const pair = TERMINAL_TEXT_EFFECT_FAMILY_PAIRS[metadata.family];
	if (!pair || role === "standalone") return "none";
	return pair[role];
}

export function normalizeTerminalTextEffectTriggers(
	triggers: TerminalTextEffectTrigger[] = DEFAULT_TERMINAL_TEXT_EFFECT_TRIGGERS
): TerminalTextEffectTrigger[] {
	return [...new Set(triggers)];
}

export function shouldHandleTerminalTextEffectTrigger(
	triggers: readonly TerminalTextEffectTrigger[],
	trigger: TerminalTextEffectTrigger
): boolean {
	return triggers.includes(trigger);
}

function normalizeTerminalTextEffectKinds(effects: TerminalTextEffectKind[]): TerminalTextEffectKind[] {
	return [...new Set(effects)];
}

function clearTriggerBindings(el: HTMLElement): void {
	const cleanups = triggerCleanups.get(el) ?? [];
	for (const cleanup of cleanups) cleanup();
	triggerCleanups.delete(el);
}

function clearHoverReplayLock(el: HTMLElement): void {
	hoverReplayLocks.delete(el);
	const unlock = hoverReplayUnlockers.get(el);
	if (unlock && typeof document !== "undefined") {
		document.removeEventListener("mousemove", unlock);
		document.removeEventListener("pointerdown", unlock);
		document.removeEventListener("touchstart", unlock);
	}
	hoverReplayUnlockers.delete(el);
}

function scheduleHoverReplayUnlock(el: HTMLElement): void {
	if (!hoverReplayLocks.has(el) || hoverReplayUnlockers.has(el)) return;
	if (typeof document === "undefined") {
		clearHoverReplayLock(el);
		return;
	}

	const unlock = () => clearHoverReplayLock(el);
	hoverReplayUnlockers.set(el, unlock);
	document.addEventListener("mousemove", unlock, { once: true });
	document.addEventListener("pointerdown", unlock, { once: true });
	document.addEventListener("touchstart", unlock, { once: true });
	registerTriggerCleanup(el, () => clearHoverReplayLock(el));
}

function registerTriggerCleanup(el: HTMLElement, cleanup: () => void): void {
	const cleanups = triggerCleanups.get(el) ?? [];
	cleanups.push(cleanup);
	triggerCleanups.set(el, cleanups);
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

/**
 * Resolve a bounded total typing duration for the provided text.
 *
 * Short labels such as "Alex" or ">_" need extra dwell time so they still read
 * as a deliberate typewriter flourish. Longer strings naturally earn more time,
 * but stay capped so decorative copy does not drag.
 */
export function resolveTypingDurationMs(text: string, typingStepMs = DEFAULT_TYPING_STEP_MS): number {
	const length = Math.max(text.trim().length, 1);
	const shortTextBonus = Math.max(0, DEFAULT_TYPING_SHORT_TEXT_THRESHOLD - length);
	const duration =
		DEFAULT_TYPING_LEAD_IN_MS +
		length * typingStepMs * DEFAULT_TYPING_BASE_MULTIPLIER +
		shortTextBonus * typingStepMs * DEFAULT_TYPING_SHORT_TEXT_BONUS_MULTIPLIER;

	return clamp(duration, DEFAULT_TYPING_MIN_DURATION_MS, DEFAULT_TYPING_MAX_DURATION_MS);
}

export function resolveTerminalTextEffectDurationMs(effect: TerminalTextEffectKind, text: string): number {
	if (effect === "typing") return resolveTypingDurationMs(text);

	const profile = EFFECT_DURATION_PROFILES[effect];
	const length = Math.max(text.trim().length, 1);
	return clamp(profile.baseMs + length * profile.perCharMs, profile.minMs, profile.maxMs);
}

function renderTypingFrame(text: string, visibleLength: number, showCursor: boolean): string {
	const resolvedText = text.slice(0, visibleLength);
	return showCursor ? `${resolvedText}${TERMINAL_BLOCK_CURSOR}` : resolvedText;
}

function resolveHumanPauseMs(averageStepMs: number): number {
	if (Math.random() <= 1 - DEFAULT_HUMAN_PAUSE_CHANCE) return 0;
	const pauseWindow = DEFAULT_HUMAN_PAUSE_MAX_MS - DEFAULT_HUMAN_PAUSE_MIN_MS;
	return DEFAULT_HUMAN_PAUSE_MIN_MS + Math.random() * Math.max(pauseWindow, averageStepMs);
}

export function resolveTerminalTextEffectKind(
	effects: TerminalTextEffectKind[],
	useRandomEffect: boolean,
	randomValue: number,
	options: { mode?: TerminalTextTransitionMode } = {}
): TerminalTextEffectKind {
	const normalizedEffects = normalizeTerminalTextEffectKinds(effects).filter((effect) => {
		// Standalone randomization should only choose effects that make sense
		// without changing the element's stable text.
		if (options.mode === "standalone") return TERMINAL_TEXT_EFFECTS[effect].standaloneSafe;
		return true;
	});
	const fallbackEffect = normalizedEffects[0] ?? "typing";

	if (!useRandomEffect || normalizedEffects.length <= 1) return fallbackEffect;

	const index = Math.min(normalizedEffects.length - 1, Math.floor(randomValue * normalizedEffects.length));
	return normalizedEffects[index] ?? fallbackEffect;
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
export function readTerminalTextEffectConfig(el: HTMLElement): TerminalTextEffectConfig | null {
	const effects = el.dataset.textEffect
		?.split(",")
		.map((value) => value.trim())
		.filter((value): value is TerminalTextEffectKind => value in TERMINAL_TEXT_EFFECTS);

	if (!effects || effects.length === 0) {
		return null;
	}

	const rawTriggers = el.dataset.textEffectTriggers
		?.split(",")
		.map((value) => value.trim())
		.filter(Boolean) as TerminalTextEffectTrigger[] | undefined;

	const intervalValue = el.dataset.textEffectIntervalMs
		? Number.parseInt(el.dataset.textEffectIntervalMs, 10)
		: undefined;

	return {
		effects: normalizeTerminalTextEffectKinds(effects),
		triggers: normalizeTerminalTextEffectTriggers(rawTriggers),
		randomIntervalMs: Number.isFinite(intervalValue) ? intervalValue : undefined,
	};
}

/** Stop any in-progress effect and restore the stable text immediately. */
export function resetTerminalTextEffect(
	el: HTMLElement | null,
	options: Pick<TerminalTextEffectOptions, "rootEl" | "rootEffectDataset"> = {}
): void {
	if (!el) return;
	clearActiveEffect(el);
	setRootEffect(options.rootEl, "none", options.rootEffectDataset);

	const target = el.dataset.textEffectStableText ?? el.dataset.greetingTarget ?? el.textContent ?? "";
	el.textContent = target;
}

type EffectRendererHandle = {
	promise: Promise<void>;
	cancel: () => void;
};

function createTimeoutRenderer(
	run: (schedule: (callback: () => void, delay: number) => void, finish: () => void) => void
) {
	const timers = new Set<TimeoutHandle>();
	let settled = false;
	let resolvePromise: () => void = () => {};
	const promise = new Promise<void>((resolve) => {
		resolvePromise = resolve;
	});
	const finish = () => {
		if (settled) return;
		settled = true;
		for (const timer of timers) globalThis.clearTimeout(timer);
		timers.clear();
		resolvePromise();
	};
	const schedule = (callback: () => void, delay: number) => {
		const timer = globalThis.setTimeout(() => {
			timers.delete(timer);
			callback();
		}, delay);
		timers.add(timer);
	};

	run(schedule, finish);

	return {
		promise,
		cancel: finish,
	};
}

function runTypingEnterRenderer(
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

function runBackspaceExitRenderer(
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

function runDecryptEnterRenderer(el: HTMLElement, text: string, durationMs?: number): EffectRendererHandle {
	const totalFrames = DEFAULT_DECRYPT_TOTAL_FRAMES;
	const totalDuration = durationMs ?? resolveTerminalTextEffectDurationMs("decrypt", text);
	const frameInterval = totalDuration / totalFrames;
	let frame = 0;
	let resolvePromise: () => void = () => {};
	let settled = false;
	const promise = new Promise<void>((resolve) => {
		resolvePromise = resolve;
	});
	const intervalId = globalThis.setInterval(() => {
		const resolved = Math.floor((frame / totalFrames) * text.length);

		el.textContent = text
			.split("")
			.map((char, i) => {
				if (char === " ") return char;
				if (i < resolved) return char;
				return DECRYPT_CHARS[Math.floor(Math.random() * DECRYPT_CHARS.length)];
			})
			.join("");

		frame += 1;

		if (frame >= totalFrames) {
			globalThis.clearInterval(intervalId);
			if (settled) return;
			settled = true;
			el.textContent = text;
			resolvePromise();
		}
	}, frameInterval);

	return {
		promise,
		cancel: () => {
			if (settled) return;
			settled = true;
			globalThis.clearInterval(intervalId);
			resolvePromise();
		},
	};
}

function runEntropyExitRenderer(el: HTMLElement, text: string, durationMs?: number): EffectRendererHandle {
	const totalFrames = DEFAULT_ENTROPY_TOTAL_FRAMES;
	const totalDuration = durationMs ?? resolveTerminalTextEffectDurationMs("entropy", text);
	const frameInterval = totalDuration / totalFrames;
	let frame = 0;
	let resolvePromise: () => void = () => {};
	let settled = false;
	const promise = new Promise<void>((resolve) => {
		resolvePromise = resolve;
	});
	const intervalId = globalThis.setInterval(() => {
		const entropyRatio = frame / totalFrames;
		const keepCount = Math.max(0, Math.floor((1 - entropyRatio) * text.length));

		el.textContent = text
			.split("")
			.map((char, i) => {
				if (char === " ") return char;
				if (i < keepCount) return char;
				return DECRYPT_CHARS[Math.floor(Math.random() * DECRYPT_CHARS.length)];
			})
			.join("");

		frame += 1;

		if (frame >= totalFrames) {
			globalThis.clearInterval(intervalId);
			if (settled) return;
			settled = true;
			el.textContent = "";
			resolvePromise();
		}
	}, frameInterval);

	return {
		promise,
		cancel: () => {
			if (settled) return;
			settled = true;
			globalThis.clearInterval(intervalId);
			resolvePromise();
		},
	};
}

function getSignalArtifact(index: number): string {
	return SIGNAL_ARTIFACTS[index % SIGNAL_ARTIFACTS.length] ?? "_";
}

function renderGlitchLockFrame(text: string, frame: number, totalFrames: number): string {
	if (frame >= totalFrames - 1) return text;
	const chars = text.split("");
	const instability = 1 - frame / Math.max(totalFrames - 1, 1);
	const artifactEvery = Math.max(2, Math.ceil(4 - instability * 2));

	const body = chars
		.map((char, index) => {
			if (char === " ") return char;
			if ((index + frame) % artifactEvery === 0) return getSignalArtifact(index + frame);
			if (instability > 0.62 && (index + frame) % 3 === 0) return `${char}${char}`;
			return char;
		})
		.join("");

	if (frame === 0) return `${body}${chars.at(-1) ?? ""}`;
	if (frame === 1) return `${getSignalArtifact(frame)}${body}`;
	if (frame === totalFrames - 2) return body.replace(/[ _\-/\\|]/, "");
	return body;
}

function runGlitchLockOnEnterRenderer(el: HTMLElement, text: string, durationMs?: number): EffectRendererHandle {
	const totalFrames = DEFAULT_GLITCH_LOCK_TOTAL_FRAMES;
	const totalDuration = durationMs ?? resolveTerminalTextEffectDurationMs("glitch-lock-on", text);
	const frameInterval = totalDuration / totalFrames;
	let frame = 0;
	let resolvePromise: () => void = () => {};
	let settled = false;
	const promise = new Promise<void>((resolve) => {
		resolvePromise = resolve;
	});
	const intervalId = globalThis.setInterval(() => {
		el.textContent = renderGlitchLockFrame(text, frame, totalFrames);

		frame += 1;

		if (frame >= totalFrames) {
			globalThis.clearInterval(intervalId);
			if (settled) return;
			settled = true;
			el.textContent = text;
			resolvePromise();
		}
	}, frameInterval);

	return {
		promise,
		cancel: () => {
			if (settled) return;
			settled = true;
			globalThis.clearInterval(intervalId);
			resolvePromise();
		},
	};
}

function renderSignalLossFrame(text: string, frame: number, totalFrames: number): string {
	if (frame === 0) return text;
	if (frame >= totalFrames - 1) return renderSignalLossDropoutText(text);

	const chars = text.split("");
	const lossRatio = frame / Math.max(totalFrames - 1, 1);
	const shouldFalseRecover = totalFrames > 5 && frame === Math.floor(totalFrames * 0.45);
	if (shouldFalseRecover) return text;

	const dropoutCount = Math.max(1, Math.ceil(chars.length * lossRatio * 0.72));
	const start = Math.min(chars.length - 1, (frame * 2) % Math.max(chars.length, 1));
	const rendered = chars.map((char, index) => {
		if (char === " ") return char;
		const inPrimaryDropout = index >= start && index < start + dropoutCount;
		const inWrappedDropout = start + dropoutCount > chars.length && index < (start + dropoutCount) % chars.length;
		const shouldDrop = inPrimaryDropout || inWrappedDropout || (lossRatio > 0.58 && (index + frame) % 3 === 0);
		if (!shouldDrop) return char;
		return frame % 2 === 0 ? "_" : " ";
	});

	if (lossRatio > 0.72) {
		return rendered
			.map((char, index) => {
				if (/\s/.test(chars[index] ?? "")) return chars[index] ?? char;
				return index < Math.floor(chars.length * (1 - lossRatio)) ? char : "_";
			})
			.join("");
	}

	return rendered.join("");
}

function renderSignalLossDropoutText(text: string): string {
	return text
		.split("")
		.map((char) => (/\s/.test(char) ? char : "_"))
		.join("");
}

function runSignalLossExitRenderer(el: HTMLElement, text: string, durationMs?: number): EffectRendererHandle {
	const totalFrames = DEFAULT_SIGNAL_LOSS_TOTAL_FRAMES;
	const totalDuration = durationMs ?? resolveTerminalTextEffectDurationMs("signal-loss", text);
	const frameInterval = totalDuration / totalFrames;
	let timeoutId: TimeoutHandle | null = null;
	let frame = 0;
	let resolvePromise: () => void = () => {};
	let settled = false;
	const promise = new Promise<void>((resolve) => {
		resolvePromise = resolve;
	});
	const intervalId = globalThis.setInterval(() => {
		el.textContent = renderSignalLossFrame(text, frame, totalFrames);

		frame += 1;

		if (frame >= totalFrames) {
			globalThis.clearInterval(intervalId);
			if (settled) return;
			settled = true;
			el.textContent = renderSignalLossDropoutText(text);
			timeoutId = globalThis.setTimeout(resolvePromise, DEFAULT_SIGNAL_LOSS_BLACKOUT_HOLD_MS);
		}
	}, frameInterval);

	return {
		promise,
		cancel: () => {
			if (settled && timeoutId === null) return;
			settled = true;
			globalThis.clearInterval(intervalId);
			if (timeoutId !== null) {
				globalThis.clearTimeout(timeoutId);
				timeoutId = null;
			}
			resolvePromise();
		},
	};
}

function runPhaseRenderer(options: {
	el: HTMLElement;
	effect: TerminalTextEffectKind;
	text: string;
	durationMs?: number;
	typingStepMs?: number;
}): EffectRendererHandle {
	switch (options.effect) {
		case "typing":
			return runTypingEnterRenderer(options.el, options.text, options.typingStepMs ?? DEFAULT_TYPING_STEP_MS);
		case "backspace":
			return runBackspaceExitRenderer(options.el, options.text, options.typingStepMs ?? DEFAULT_BACKSPACE_STEP_MS);
		case "decrypt":
			return runDecryptEnterRenderer(options.el, options.text, options.durationMs);
		case "entropy":
			return runEntropyExitRenderer(options.el, options.text, options.durationMs);
		case "glitch-lock-on":
			return runGlitchLockOnEnterRenderer(options.el, options.text, options.durationMs);
		case "signal-loss":
			return runSignalLossExitRenderer(options.el, options.text, options.durationMs);
	}
}

function isReducedMotionRequested(explicit?: boolean): boolean {
	if (typeof explicit === "boolean") return explicit;
	return (
		typeof window !== "undefined" &&
		typeof window.matchMedia === "function" &&
		window.matchMedia("(prefers-reduced-motion: reduce)").matches
	);
}

function applyReducedMotionFallback(el: HTMLElement, stableText: string): void {
	el.textContent = stableText;
	el.dataset.textEffectStableText = stableText;
	el.dataset.greetingTarget = stableText;
}

function resolveReducedMotionText(options: {
	mode: TerminalTextTransitionMode;
	fromText: string;
	toText: string;
	enterEffect: TerminalTextEffectKind | "none";
	exitEffect: TerminalTextEffectKind | "none";
}): string {
	const activeEffect = options.exitEffect !== "none" ? options.exitEffect : options.enterEffect;
	const strategy = activeEffect !== "none" ? TERMINAL_TEXT_EFFECTS[activeEffect].reducedMotion : "instant-target";

	if (strategy === "instant-clear") return "";
	if (strategy === "instant-restore" && options.mode === "standalone") return options.fromText || options.toText;
	return options.toText;
}

function resolveTransitionEffects(options: TerminalTextTransitionOptions): {
	enterEffect: TerminalTextEffectKind | "none";
	exitEffect: TerminalTextEffectKind | "none";
} {
	const effect = options.effect ?? "none";
	const metadata = effect !== "none" ? TERMINAL_TEXT_EFFECTS[effect] : null;
	return {
		enterEffect:
			options.enterEffect ?? (metadata?.role === "enter" || metadata?.role === "standalone" ? effect : "none"),
		exitEffect: options.exitEffect ?? (metadata?.role === "exit" || metadata?.role === "standalone" ? effect : "none"),
	};
}

export async function runTerminalTextTransition(options: TerminalTextTransitionOptions): Promise<boolean> {
	const { el, rootEl, rootEffectDataset, onComplete, reducedMotion, durationMs, typingStepMs } = options;
	if (!el) return false;

	clearActiveEffect(el);

	const fromText =
		options.fromText ?? el.dataset.textEffectStableText ?? el.dataset.greetingTarget ?? el.textContent ?? "";
	const toText = options.toText;
	const mode = options.mode ?? "enter-only";
	const { enterEffect, exitEffect } = resolveTransitionEffects(options);
	const targetStableText = toText;
	const reducedMotionText = resolveReducedMotionText({ mode, fromText, toText, enterEffect, exitEffect });

	el.dataset.textEffectStableText = targetStableText;
	el.dataset.greetingTarget = targetStableText;

	if (enterEffect === "none" && exitEffect === "none") {
		applyReducedMotionFallback(el, reducedMotionText);
		setRootEffect(rootEl, "none", rootEffectDataset);
		onComplete?.();
		return false;
	}

	if (isReducedMotionRequested(reducedMotion)) {
		applyReducedMotionFallback(el, reducedMotionText);
		setRootEffect(rootEl, "none", rootEffectDataset);
		onComplete?.();
		return false;
	}

	let cancelled = false;
	let activeRenderer: EffectRendererHandle | null = null;
	const transitionHandle: ActiveEffectHandle = {
		cancel: () => {
			cancelled = true;
			activeRenderer?.cancel();
			applyReducedMotionFallback(el, targetStableText);
			setRootEffect(rootEl, "none", rootEffectDataset);
		},
	};
	const transitionDone = (async () => {
		const runPhase = async (effect: TerminalTextEffectKind | "none", text: string) => {
			if (cancelled || effect === "none") return;
			setRootEffect(rootEl, effect, rootEffectDataset);
			activeRenderer = runPhaseRenderer({ el, effect, text, durationMs, typingStepMs });
			await activeRenderer.promise;
			activeRenderer = null;
		};

		if (mode === "standalone") {
			const standaloneEffect = exitEffect !== "none" ? exitEffect : enterEffect;
			await runPhase(standaloneEffect, fromText || toText);
			if (!cancelled) el.textContent = targetStableText;
			return;
		}

		if (mode === "exit-only" || mode === "full-transition") {
			await runPhase(exitEffect, fromText);
		}

		if (!cancelled && mode === "full-transition" && (options.holdMs ?? DEFAULT_TRANSITION_HOLD_MS) > 0) {
			await new Promise<void>((resolve) => {
				const timeoutId = globalThis.setTimeout(resolve, options.holdMs ?? DEFAULT_TRANSITION_HOLD_MS);
				activeRenderer = {
					promise: Promise.resolve(),
					cancel: () => {
						globalThis.clearTimeout(timeoutId);
						resolve();
					},
				};
			});
			activeRenderer = null;
		}

		if (mode === "enter-only" || mode === "full-transition") {
			await runPhase(enterEffect, toText);
		}

		if (!cancelled) el.textContent = targetStableText;
	})();

	activeEffects.set(el, transitionHandle);

	await transitionDone;
	if (activeEffects.get(el) === transitionHandle) {
		activeEffects.delete(el);
		setRootEffect(rootEl, "none", rootEffectDataset);
		el.textContent = targetStableText;
		onComplete?.();
	}
	return true;
}

/**
 * Imperative playback API for consumers that already know *when* an effect
 * should run. This is what navbrand uses after its state machine makes a
 * transition decision.
 *
 * Important:
 * - this function performs playback only
 * - it does not decide if an effect is eligible
 * - it does not attach triggers
 * - it does promote changed stable text into a paired full transition
 *
 * Example:
 *   current stable text: "alex"
 *   playTerminalTextEffect({ effect: "typing", text: "engineer" })
 *   result: "alex" backspaces out, then "engineer" types in
 *
 * If the stable text has not changed, this imperative API remains enter-only.
 * Declarative replay triggers such as hover/random-time use
 * `bindTerminalTextEffectTriggers()` to run the full family loop instead.
 *
 * Those decisions belong to concrete callers. Trigger-driven surfaces should
 * prefer `bindTerminalTextEffectTriggers()` via `src/scripts/textEffectRegistry.ts`
 * so timing stays declarative in markup.
 */
export function playTerminalTextEffect(options: {
	el: HTMLElement | null;
	effect: TerminalTextEffectKind | "none";
	text: string;
	durationMs?: number;
	typingStepMs?: number;
	rootEl?: HTMLElement | null;
	rootEffectDataset?: string;
	onComplete?: () => void;
	reducedMotion?: boolean;
}): boolean {
	if (!options.el) return false;
	const metadata = options.effect !== "none" ? TERMINAL_TEXT_EFFECTS[options.effect] : null;
	const fromText =
		options.el.dataset.textEffectStableText ??
		options.el.dataset.greetingTarget ??
		options.el.textContent ??
		options.text;
	const hasChangedStableText = Boolean(metadata && metadata.role === "enter" && fromText && fromText !== options.text);
	const mode = metadata?.role === "exit" ? "standalone" : hasChangedStableText ? "full-transition" : "enter-only";
	void runTerminalTextTransition({
		...options,
		toText: options.text,
		fromText,
		mode,
		enterEffect: metadata?.role === "enter" ? options.effect : undefined,
		exitEffect: hasChangedStableText
			? getPairedTerminalTextEffect(options.effect as TerminalTextEffectKind, "exit")
			: undefined,
		effect: options.effect,
	});
	return options.effect !== "none" && !isReducedMotionRequested(options.reducedMotion);
}

/**
 * Trigger-driven binding API for generic flourish targets.
 *
 * This is intentionally separate from `playTerminalTextEffect()` so decorative
 * surfaces can opt into behavior declaratively through
 * `src/scripts/textEffectRegistry.ts`. State machines should only use this API
 * directly when effect timing cannot be expressed with declarative triggers.
 *
 * Stacking behavior:
 * - triggers are additive, not exclusive
 * - one element may declare one or many effects
 * - `random-effect` modifies *which declared effect* is played
 * - `random-time` modifies *when* playback occurs
 * - an element can use both along with load/hover/tap/click
 *
 * Rebinding behavior:
 * - existing listeners are removed before re-adding
 * - existing random timers are cleared before re-registering
 * This keeps Astro soft navigations from stacking duplicate handlers.
 */
export function bindTerminalTextEffectTriggers(options: {
	el: HTMLElement | null;
	effect?: TerminalTextEffectKind;
	effects?: TerminalTextEffectKind[];
	triggers?: TerminalTextEffectTrigger[];
	initialTrigger?: TerminalTextEffectTrigger | "none";
	initialDelayMs?: number;
	getText?: (el: HTMLElement, trigger: TerminalTextEffectTrigger) => string;
	durationMs?: number;
	typingStepMs?: number;
	randomIntervalMs?: number;
}): void {
	const {
		el,
		effect,
		effects,
		triggers,
		initialTrigger = "load",
		initialDelayMs,
		getText,
		durationMs,
		typingStepMs,
		randomIntervalMs = DEFAULT_RANDOM_INTERVAL_MS,
	} = options;
	if (!el) return;

	const normalizedTriggers = normalizeTerminalTextEffectTriggers(triggers);
	const candidateEffects = normalizeTerminalTextEffectKinds(effects ?? (effect ? [effect] : ["typing"]));
	const textReader =
		getText ??
		((node: HTMLElement) =>
			node.dataset.textEffectStableText ?? node.dataset.greetingTarget ?? node.textContent?.trim() ?? "");
	const useRandomEffect = shouldHandleTerminalTextEffectTrigger(normalizedTriggers, "random-effect");
	const shouldBindTap =
		shouldHandleTerminalTextEffectTrigger(normalizedTriggers, "tap") ||
		shouldHandleTerminalTextEffectTrigger(normalizedTriggers, "activate");
	const shouldBindClick =
		shouldHandleTerminalTextEffectTrigger(normalizedTriggers, "click") ||
		shouldHandleTerminalTextEffectTrigger(normalizedTriggers, "activate");
	let pendingInitialPlayback = false;
	const automaticReplayTriggers = new Set<TerminalTextEffectTrigger>([
		"resume",
		"route-enter",
		"intersection",
		"idle-return",
		"random-time",
	]);

	const play = (
		trigger: TerminalTextEffectTrigger,
		options: {
			fromText?: string;
			toText?: string;
			forceLoop?: boolean;
		} = {}
	) => {
		if (pendingInitialPlayback && automaticReplayTriggers.has(trigger)) return;
		if (hasActiveEffect(el)) return;
		const text = options.toText ?? textReader(el, trigger);
		if (!text) return;
		const selectedEffect = resolveTerminalTextEffectKind(candidateEffects, useRandomEffect, Math.random());
		const metadata = TERMINAL_TEXT_EFFECTS[selectedEffect];
		const fromText =
			options.fromText ?? el.dataset.textEffectStableText ?? el.dataset.greetingTarget ?? el.textContent ?? text;
		const shouldLoop = options.forceLoop || (trigger !== "load" && metadata.role === "enter");

		if (shouldLoop && metadata.role === "enter") {
			void runTerminalTextTransition({
				el,
				fromText,
				toText: text,
				mode: "full-transition",
				enterEffect: selectedEffect,
				exitEffect: getPairedTerminalTextEffect(selectedEffect, "exit"),
				durationMs,
				typingStepMs,
			});
			return;
		}

		playTerminalTextEffect({ el, effect: selectedEffect, text, durationMs, typingStepMs });
	};

	clearTriggerBindings(el);

	const handlers = triggerHandlers.get(el) ?? {
		mouseenter: () => {
			if (hoverReplayLocks.has(el)) return;
			hoverReplayLocks.add(el);
			play("hover");
		},
		mouseleave: () => scheduleHoverReplayUnlock(el),
		focusin: () => play("focus"),
		touchstart: () => play("tap"),
		click: () => play("click"),
	};
	triggerHandlers.set(el, handlers);

	const createDelayedPlayback = (trigger: TerminalTextEffectTrigger, delayMs: number) => {
		let timer: TimeoutHandle | undefined;
		const schedule = () => {
			if (timer !== undefined) globalThis.clearTimeout(timer);
			pendingInitialPlayback = true;
			timer = globalThis.setTimeout(() => {
				timer = undefined;
				pendingInitialPlayback = false;
				play(trigger);
			}, delayMs);
		};
		const cleanup = () => {
			if (timer !== undefined) {
				globalThis.clearTimeout(timer);
				timer = undefined;
			}
			pendingInitialPlayback = false;
		};
		return { schedule, cleanup };
	};

	if (initialTrigger === "route-enter" && shouldHandleTerminalTextEffectTrigger(normalizedTriggers, "route-enter")) {
		const routeEnterPlayback = createDelayedPlayback(
			"route-enter",
			initialDelayMs ?? DEFAULT_ROUTE_ENTER_SETTLE_DELAY_MS
		);
		routeEnterPlayback.schedule();
		registerTriggerCleanup(el, routeEnterPlayback.cleanup);
	} else if (initialTrigger !== "none" && shouldHandleTerminalTextEffectTrigger(normalizedTriggers, "load")) {
		if (initialDelayMs !== undefined && initialDelayMs > 0) {
			const loadPlayback = createDelayedPlayback("load", initialDelayMs);
			loadPlayback.schedule();
			registerTriggerCleanup(el, loadPlayback.cleanup);
		} else {
			play("load");
		}
	}

	el.removeEventListener("mouseenter", handlers.mouseenter);
	el.removeEventListener("mouseleave", handlers.mouseleave);
	el.removeEventListener("focusin", handlers.focusin);
	el.removeEventListener("touchstart", handlers.touchstart);
	el.removeEventListener("click", handlers.click);

	const existingRandomTimer = randomTimers.get(el);
	if (existingRandomTimer !== undefined) {
		globalThis.clearInterval(existingRandomTimer);
		randomTimers.delete(el);
	}

	if (shouldHandleTerminalTextEffectTrigger(normalizedTriggers, "hover")) {
		el.addEventListener("mouseenter", handlers.mouseenter);
		el.addEventListener("mouseleave", handlers.mouseleave);
		registerTriggerCleanup(el, () => clearHoverReplayLock(el));
	}

	if (shouldHandleTerminalTextEffectTrigger(normalizedTriggers, "focus")) {
		el.addEventListener("focusin", handlers.focusin);
	}

	if (shouldBindTap) {
		el.addEventListener("touchstart", handlers.touchstart, { passive: true });
	}

	if (shouldBindClick) {
		el.addEventListener("click", handlers.click);
	}

	if (shouldHandleTerminalTextEffectTrigger(normalizedTriggers, "resume") && typeof document !== "undefined") {
		const resumeHandler = () => {
			if (document.visibilityState === "visible") play("resume");
		};
		document.addEventListener("visibilitychange", resumeHandler);
		registerTriggerCleanup(el, () => document.removeEventListener("visibilitychange", resumeHandler));
	}

	if (shouldHandleTerminalTextEffectTrigger(normalizedTriggers, "route-enter") && typeof document !== "undefined") {
		const routeEnterPlayback = createDelayedPlayback("route-enter", DEFAULT_ROUTE_ENTER_SETTLE_DELAY_MS);
		const routeEnterHandler = () => {
			routeEnterPlayback.schedule();
		};
		document.addEventListener("astro:after-swap", routeEnterHandler);
		registerTriggerCleanup(el, () => {
			document.removeEventListener("astro:after-swap", routeEnterHandler);
			routeEnterPlayback.cleanup();
		});
	}

	if (
		shouldHandleTerminalTextEffectTrigger(normalizedTriggers, "intersection") &&
		typeof IntersectionObserver !== "undefined"
	) {
		const observer = new IntersectionObserver((entries) => {
			for (const entry of entries) {
				if (entry.target === el && entry.isIntersecting) {
					play("intersection");
				}
			}
		});
		observer.observe(el);
		registerTriggerCleanup(el, () => observer.disconnect());
	}

	if (shouldHandleTerminalTextEffectTrigger(normalizedTriggers, "idle-return") && typeof document !== "undefined") {
		let lastActivityTs = Date.now();
		const idleReturnHandler = () => {
			const now = Date.now();
			const wasIdle = now - lastActivityTs >= DEFAULT_IDLE_RETURN_DELAY_MS;
			lastActivityTs = now;
			if (wasIdle && document.visibilityState === "visible") {
				play("idle-return");
			}
		};
		for (const eventName of ["mousemove", "keydown", "pointerdown", "touchstart", "focusin"]) {
			document.addEventListener(eventName, idleReturnHandler);
			registerTriggerCleanup(el, () => document.removeEventListener(eventName, idleReturnHandler));
		}
	}

	if (
		shouldHandleTerminalTextEffectTrigger(normalizedTriggers, "content-change") &&
		typeof MutationObserver !== "undefined"
	) {
		let lastObservedText = textReader(el, "content-change");
		const observer = new MutationObserver(() => {
			const nextText = (el.textContent ?? "").trim();
			if (!nextText || nextText === lastObservedText || hasActiveEffect(el)) return;
			const fromText = lastObservedText;
			lastObservedText = nextText;
			play("content-change", { fromText, toText: nextText, forceLoop: true });
		});
		observer.observe(el, { characterData: true, childList: true, subtree: true });
		registerTriggerCleanup(el, () => observer.disconnect());
	}

	if (shouldHandleTerminalTextEffectTrigger(normalizedTriggers, "random-time")) {
		// Random-time intentionally means "replay on a timer" rather than "random delay once".
		// The effect kind may also randomize independently via the `random-effect` trigger.
		const intervalId = globalThis.setInterval(() => {
			play("random-time");
		}, randomIntervalMs);
		randomTimers.set(el, intervalId);
	}
}
