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
 * Available effects:
 *   - `typing`  : progressive reveal
 *   - `decrypt` : glyph scramble/resolution using the terminal character set
 *   Additional effects can be added later by:
 *   1. extending `TerminalTextEffectKind`
 *   2. teaching `playTerminalTextEffect` how to render them
 *   3. declaring them in markup or direct callers
 *
 * Trigger vocabulary:
 *   - `load`          : play immediately when bound
 *   - `hover`         : play on mouseenter
 *   - `tap`           : play on touchstart
 *   - `click`         : play on click (desktop-friendly activation)
 *   - `manual`        : reserved for explicit external triggering
 *   - `random-effect` : randomize across the element's declared effect list
 *   - `random-time`   : replay on an interval
 *
 * Declarative markup contract:
 *   data-text-effect="typing"
 *   data-text-effect="typing, decrypt"
 *   data-text-effect-triggers="load, hover, tap, click, random-effect, random-time"
 *   data-text-effect-interval-ms="18000"
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
import type { NavBrandEffect } from "@/lib/navBrand/state";

export type TerminalTextEffectKind = Exclude<NavBrandEffect, "none">;
export type TerminalTextEffectTrigger = "load" | "hover" | "tap" | "click" | "manual" | "random-effect" | "random-time";

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
export const DEFAULT_RANDOM_INTERVAL_MS = 20_000;

const DECRYPT_CHARS = "░▒▓█▐▌▄▀■□▪▫◆◇○●◌◍◎◉▶▷◀◁▸▹◂◃⬛⬜▬▭▮▯◥◤◣◢◿█▄▌▐▀▘▝▀▖▍▞▛▗▚▐▜▃▙▟▉";
const DEFAULT_TYPING_STEP_MS = 26;
const DEFAULT_DECRYPT_DURATION_MS = 700;
const DEFAULT_DECRYPT_TOTAL_FRAMES = 40;

type ActiveEffectHandle = {
	cancel: () => void;
};

type TerminalTextEffectOptions = {
	durationMs?: number;
	typingStepMs?: number;
	rootEl?: HTMLElement | null;
	rootEffectDataset?: string;
	onComplete?: () => void;
};

const activeEffects = new WeakMap<HTMLElement, ActiveEffectHandle>();
const triggerHandlers = new WeakMap<
	HTMLElement,
	{
		mouseenter: EventListener;
		touchstart: EventListener;
		click: EventListener;
	}
>();
const randomTimers = new WeakMap<HTMLElement, number>();

function clearActiveEffect(el: HTMLElement): void {
	activeEffects.get(el)?.cancel();
	activeEffects.delete(el);
}

/** Optional root dataset hook so consumers can style active effects in CSS. */
function setRootEffect(
	rootEl: HTMLElement | null | undefined,
	effect: NavBrandEffect,
	rootEffectDataset = "navbrandEffect"
): void {
	if (!rootEl) return;
	rootEl.dataset[rootEffectDataset] = effect;
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

export function resolveTerminalTextEffectKind(
	effects: TerminalTextEffectKind[],
	useRandomEffect: boolean,
	randomValue: number
): TerminalTextEffectKind {
	const normalizedEffects = normalizeTerminalTextEffectKinds(effects);
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
 * - `data-text-effect-triggers="load, hover, click, random-effect, random-time"`
 * - `data-text-effect-interval-ms="18000"`
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
		.filter((value): value is TerminalTextEffectKind => value === "typing" || value === "decrypt");

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

	const target = el.dataset.greetingTarget ?? el.textContent ?? "";
	el.textContent = target;
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
}): boolean {
	const { el, effect, text, durationMs, typingStepMs, rootEl, rootEffectDataset, onComplete } = options;
	if (!el) return false;

	clearActiveEffect(el);
	el.dataset.greetingTarget = text;

	if (effect === "none") {
		setRootEffect(rootEl, "none", rootEffectDataset);
		el.textContent = text;
		onComplete?.();
		return false;
	}

	setRootEffect(rootEl, effect, rootEffectDataset);

	if (effect === "typing") {
		const stepMs = typingStepMs ?? DEFAULT_TYPING_STEP_MS;
		el.textContent = "";
		let index = 0;
		const timeoutId = window.setInterval(() => {
			index += 1;
			el.textContent = text.slice(0, index);

			if (index >= text.length) {
				window.clearInterval(timeoutId);
				activeEffects.delete(el);
				setRootEffect(rootEl, "none", rootEffectDataset);
				onComplete?.();
			}
		}, stepMs);

		activeEffects.set(el, {
			cancel: () => window.clearInterval(timeoutId),
		});
		return true;
	}

	const totalFrames = DEFAULT_DECRYPT_TOTAL_FRAMES;
	const totalDuration = durationMs ?? DEFAULT_DECRYPT_DURATION_MS;
	let frame = 0;
	const frameInterval = totalDuration / totalFrames;
	const intervalId = window.setInterval(() => {
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
			window.clearInterval(intervalId);
			activeEffects.delete(el);
			el.textContent = text;
			setRootEffect(rootEl, "none", rootEffectDataset);
			onComplete?.();
		}
	}, frameInterval);

	activeEffects.set(el, {
		cancel: () => window.clearInterval(intervalId),
	});
	return true;
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
	getText?: (el: HTMLElement) => string;
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
	const textReader = getText ?? ((node: HTMLElement) => node.dataset.greetingTarget ?? node.textContent?.trim() ?? "");
	const useRandomEffect = shouldHandleTerminalTextEffectTrigger(normalizedTriggers, "random-effect");

	const play = () => {
		const text = textReader(el);
		if (!text) return;
		playTerminalTextEffect({
			el,
			effect: resolveTerminalTextEffectKind(candidateEffects, useRandomEffect, Math.random()),
			text,
			durationMs,
			typingStepMs,
		});
	};

	const handlers = triggerHandlers.get(el) ?? {
		mouseenter: () => play(),
		touchstart: () => play(),
		click: () => play(),
	};
	triggerHandlers.set(el, handlers);

	if (shouldHandleTerminalTextEffectTrigger(normalizedTriggers, "load")) {
		play();
	}

	el.removeEventListener("mouseenter", handlers.mouseenter);
	el.removeEventListener("touchstart", handlers.touchstart);
	el.removeEventListener("click", handlers.click);

	const existingRandomTimer = randomTimers.get(el);
	if (existingRandomTimer !== undefined) {
		window.clearInterval(existingRandomTimer);
		randomTimers.delete(el);
	}

	if (shouldHandleTerminalTextEffectTrigger(normalizedTriggers, "hover")) {
		el.addEventListener("mouseenter", handlers.mouseenter);
	}

	if (shouldHandleTerminalTextEffectTrigger(normalizedTriggers, "tap")) {
		el.addEventListener("touchstart", handlers.touchstart, { passive: true });
	}

	if (shouldHandleTerminalTextEffectTrigger(normalizedTriggers, "click")) {
		el.addEventListener("click", handlers.click);
	}

	if (shouldHandleTerminalTextEffectTrigger(normalizedTriggers, "random-time")) {
		// Random-time intentionally means "replay on a timer" rather than "random delay once".
		// The effect kind may also randomize independently via the `random-effect` trigger.
		const intervalId = window.setInterval(() => {
			play();
		}, randomIntervalMs);
		randomTimers.set(el, intervalId);
	}
}
