/**
 * Shared terminal-text flourish engine.
 *
 * This module is the reusable implementation layer for the site's
 * terminal-adjacent text flourishes.
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
 *    Best for navbrand or any feature where a coordinator/state machine such as
 *    `src/scripts/navBrand.ts` decides exactly when an effect should run and
 *    which effect should be used.
 *
 * Available effect families:
 *   - type   : `typing` enter, `backspace` exit
 *   - cipher : `decrypt` enter, `entropy` exit
 *
 * New effects should be registered in `TERMINAL_TEXT_EFFECTS` with family,
 * lifecycle role, standalone eligibility, and reduced-motion strategy before
 * adding a renderer. The transition coordinator uses that metadata to keep
 * randomization, standalone flourishes, and reduced-motion behavior coherent.
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
 *   - `manual`        : reserved for explicit external triggering
 *   - `random-effect` : randomize across the element's declared effect list
 *   - `random-time`   : replay on an interval
 *
 * Declarative markup contract:
 *   data-text-effect="typing"
 *   data-text-effect="typing, decrypt, backspace, entropy"
 *   data-text-effect-triggers="load, hover, activate, resume, route-enter, intersection, idle-return, random-effect, random-time"
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
export type TerminalTextEffectFamily = "type" | "cipher" | "rare" | "system";
export type TerminalTextEffectRole = "enter" | "exit" | "standalone";
export type TerminalTextEffectKind = "typing" | "backspace" | "decrypt" | "entropy";
export type TerminalTextEffectState = "none" | TerminalTextEffectKind;
export type TerminalTextEffectReducedMotionStrategy = "instant-target" | "instant-restore" | "instant-clear";

export type TerminalTextEffectMetadata = {
	family: TerminalTextEffectFamily;
	role: TerminalTextEffectRole;
	standaloneSafe: boolean;
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
const DEFAULT_TYPING_END_BLINK_INTERVAL_MS = 110;
const DEFAULT_TYPING_END_BLINK_COUNT = 2;
const DEFAULT_DECRYPT_DURATION_MS = 700;
const DEFAULT_DECRYPT_TOTAL_FRAMES = 40;
const DEFAULT_BACKSPACE_STEP_MS = 42;
const DEFAULT_BACKSPACE_HOLD_MS = 140;
const DEFAULT_ENTROPY_DURATION_MS = 520;
const DEFAULT_ENTROPY_TOTAL_FRAMES = 22;
const DEFAULT_TRANSITION_HOLD_MS = 80;
const TERMINAL_BLOCK_CURSOR = "█";

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
const triggerHandlers = new WeakMap<
	HTMLElement,
	{
		mouseenter: EventListener;
		focusin: EventListener;
		touchstart: EventListener;
		click: EventListener;
	}
>();
const randomTimers = new WeakMap<HTMLElement, IntervalHandle>();
const triggerCleanups = new WeakMap<HTMLElement, Array<() => void>>();

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

function renderTypingFrame(text: string, visibleLength: number, showCursor: boolean): string {
	const resolvedText = text.slice(0, visibleLength);
	return showCursor ? `${resolvedText}${TERMINAL_BLOCK_CURSOR}` : resolvedText;
}

export function resolveTerminalTextEffectKind(
	effects: TerminalTextEffectKind[],
	useRandomEffect: boolean,
	randomValue: number,
	options: { mode?: TerminalTextTransitionMode } = {}
): TerminalTextEffectKind {
	const normalizedEffects = normalizeTerminalTextEffectKinds(effects).filter((effect) => {
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
 * - `data-text-effect="typing"` or `data-text-effect="typing, decrypt"`
 * - `data-text-effect-triggers="load, hover, activate, resume, route-enter, intersection, idle-return, random-effect, random-time"`
 * - `data-text-effect-interval-ms="18000"`
 * - `data-text-effect-managed="manual"` to opt out of the declarative registry
 *
 * Parsing is intentionally strict:
 * - unknown effects are ignored; if nothing valid remains, the registry skips the element
 * - multiple effects are allowed so `random-effect` can choose from the
 *   element's declared set rather than a hardcoded global pair
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
		const scheduleTrailingBlink = () => {
			schedule(() => {
				trailingBlinkCount += 1;
				const showCursor = trailingBlinkCount % 2 === 1;
				el.textContent = renderTypingFrame(text, text.length, showCursor);

				if (trailingBlinkCount >= DEFAULT_TYPING_END_BLINK_COUNT * 2) {
					complete();
					return;
				}

				scheduleTrailingBlink();
			}, DEFAULT_TYPING_END_BLINK_INTERVAL_MS);
		};
		const scheduleNext = () => {
			const variance = Math.random() * Math.min(DEFAULT_TYPING_STEP_VARIANCE_MS, averageStepMs * 0.45);
			const punctuationPause = /[.,;:!?]/.test(text[index] ?? "") ? averageStepMs * 0.9 : 0;
			const baseDelay = averageStepMs * (0.72 + Math.random() * 0.42);
			const leadIn = index === 0 ? DEFAULT_TYPING_LEAD_IN_MS : 0;
			schedule(tick, baseDelay + variance + punctuationPause + leadIn);
		};
		const tick = () => {
			index += 1;
			el.textContent = renderTypingFrame(text, index, true);

			if (index >= text.length) {
				scheduleTrailingBlink();
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
		let index = text.length;
		el.textContent = renderTypingFrame(text, index, true);

		const tick = () => {
			index -= 1;
			el.textContent = renderTypingFrame(text, Math.max(index, 0), true);

			if (index <= 0) {
				schedule(() => {
					el.textContent = TERMINAL_BLOCK_CURSOR;
					finish();
				}, DEFAULT_BACKSPACE_HOLD_MS);
				return;
			}

			const variance = Math.random() * Math.min(DEFAULT_TYPING_STEP_VARIANCE_MS, typingStepMs * 0.6);
			schedule(tick, typingStepMs + variance);
		};

		schedule(tick, typingStepMs);
	});
}

function runDecryptEnterRenderer(el: HTMLElement, text: string, durationMs?: number): EffectRendererHandle {
	const totalFrames = DEFAULT_DECRYPT_TOTAL_FRAMES;
	const totalDuration = durationMs ?? DEFAULT_DECRYPT_DURATION_MS;
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
	const totalDuration = durationMs ?? DEFAULT_ENTROPY_DURATION_MS;
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
 * Those decisions belong to concrete callers such as:
 * - `renderNavBrand()` in `src/scripts/navBrand.ts` for state-driven playback
 * - `bindTerminalTextEffectTriggers()` in this file for trigger-driven playback
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
	const mode = metadata?.role === "exit" ? "standalone" : "enter-only";
	void runTerminalTextTransition({
		...options,
		toText: options.text,
		fromText:
			options.el.dataset.textEffectStableText ??
			options.el.dataset.greetingTarget ??
			options.el.textContent ??
			options.text,
		mode,
		effect: options.effect,
	});
	return options.effect !== "none" && !isReducedMotionRequested(options.reducedMotion);
}

/**
 * Trigger-driven binding API for generic flourish targets.
 *
 * This is intentionally separate from `playTerminalTextEffect()` so decorative
 * surfaces can opt into behavior declaratively through
 * `src/scripts/textEffectRegistry.ts`, while state machines such as
 * `src/scripts/navBrand.ts` keep full control over timing and effect choice.
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

	const play = (trigger: TerminalTextEffectTrigger) => {
		if (hasActiveEffect(el)) return;
		const text = textReader(el, trigger);
		if (!text) return;
		playTerminalTextEffect({
			el,
			effect: resolveTerminalTextEffectKind(candidateEffects, useRandomEffect, Math.random()),
			text,
			durationMs,
			typingStepMs,
		});
	};

	clearTriggerBindings(el);

	const handlers = triggerHandlers.get(el) ?? {
		mouseenter: () => play("hover"),
		focusin: () => play("focus"),
		touchstart: () => play("tap"),
		click: () => play("click"),
	};
	triggerHandlers.set(el, handlers);

	if (shouldHandleTerminalTextEffectTrigger(normalizedTriggers, "load")) {
		play("load");
	}

	el.removeEventListener("mouseenter", handlers.mouseenter);
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
		const routeEnterHandler = () => play("route-enter");
		document.addEventListener("astro:after-swap", routeEnterHandler);
		registerTriggerCleanup(el, () => document.removeEventListener("astro:after-swap", routeEnterHandler));
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

	if (shouldHandleTerminalTextEffectTrigger(normalizedTriggers, "random-time")) {
		// Random-time intentionally means "replay on a timer" rather than "random delay once".
		// The effect kind may also randomize independently via the `random-effect` trigger.
		const intervalId = globalThis.setInterval(() => {
			play("random-time");
		}, randomIntervalMs);
		randomTimers.set(el, intervalId);
	}
}
