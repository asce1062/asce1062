import type { TerminalTextEffectKind, TerminalTextEffectTrigger, TimeoutHandle } from "./types";
import { TERMINAL_TEXT_EFFECTS } from "./types";
import {
	DEFAULT_RANDOM_INTERVAL_MS,
	DEFAULT_IDLE_RETURN_DELAY_MS,
	DEFAULT_ROUTE_ENTER_SETTLE_DELAY_MS,
} from "./constants";
import { resolveTerminalTextEffectKind, getPairedTerminalTextEffect } from "./utils";
import {
	normalizeTerminalTextEffectKinds,
	normalizeTerminalTextEffectTriggers,
	shouldHandleTerminalTextEffectTrigger,
} from "./config";
import {
	triggerHandlers,
	randomTimers,
	hoverReplayLocks,
	hasActiveEffect,
	clearTriggerBindings,
	registerTriggerCleanup,
	scheduleHoverReplayUnlock,
} from "./activeEffects";
import { runTerminalTextTransition, playTerminalTextEffect } from "./transition";

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
		registerTriggerCleanup(el, () => {
			el.removeEventListener("mouseenter", handlers.mouseenter);
			el.removeEventListener("mouseleave", handlers.mouseleave);
		});
	}

	if (shouldHandleTerminalTextEffectTrigger(normalizedTriggers, "focus")) {
		el.addEventListener("focusin", handlers.focusin);
		registerTriggerCleanup(el, () => el.removeEventListener("focusin", handlers.focusin));
	}

	if (shouldBindTap) {
		el.addEventListener("touchstart", handlers.touchstart, { passive: true });
		registerTriggerCleanup(el, () => el.removeEventListener("touchstart", handlers.touchstart));
	}

	if (shouldBindClick) {
		el.addEventListener("click", handlers.click);
		registerTriggerCleanup(el, () => el.removeEventListener("click", handlers.click));
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
