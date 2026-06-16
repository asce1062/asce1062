import type {
	TextEffectKind,
	TextEffectTrigger,
	TimeoutHandle,
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
import {
	DEFAULT_RANDOM_INTERVAL_MS,
	DEFAULT_IDLE_RETURN_DELAY_MS,
	DEFAULT_ROUTE_ENTER_SETTLE_DELAY_MS,
} from "./constants";
import { resolveTextEffectKind, getPairedTextEffect } from "./utils";
import { normalizeTextEffectKinds, normalizeTextEffectTriggers, shouldHandleTextEffectTrigger } from "./config";
import {
	triggerHandlers,
	randomTimers,
	hoverReplayLocks,
	hasActiveEffect,
	clearTriggerBindings,
	registerTriggerCleanup,
	scheduleHoverReplayUnlock,
} from "./activeEffects";
import { runTextTransition, playTextEffect } from "./transition";

/**
 * Trigger-driven binding API for generic flourish targets.
 *
 * This is intentionally separate from `playTextEffect()` so decorative
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
export function bindTextEffectTriggers(options: {
	el: HTMLElement | null;
	effect?: TextEffectKind;
	effects?: TextEffectKind[];
	triggers?: TextEffectTrigger[];
	initialTrigger?: TextEffectTrigger | "none";
	initialDelayMs?: number;
	getText?: (el: HTMLElement, trigger: TextEffectTrigger) => string;
	durationMs?: number;
	typingStepMs?: number;
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
	glitchOptions?: GlitchEffectOptions;
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
	} = options;
	if (!el) return;

	const normalizedTriggers = normalizeTextEffectTriggers(triggers);
	const candidateEffects = normalizeTextEffectKinds(effects ?? (effect ? [effect] : ["typing"]));
	const textReader =
		getText ??
		((node: HTMLElement) =>
			node.dataset.textEffectStableText ?? node.dataset.greetingTarget ?? node.textContent?.trim() ?? "");
	const useRandomEffect = shouldHandleTextEffectTrigger(normalizedTriggers, "random-effect");
	const shouldBindTap =
		shouldHandleTextEffectTrigger(normalizedTriggers, "tap") ||
		shouldHandleTextEffectTrigger(normalizedTriggers, "activate");
	const shouldBindClick =
		shouldHandleTextEffectTrigger(normalizedTriggers, "click") ||
		shouldHandleTextEffectTrigger(normalizedTriggers, "activate");
	let pendingInitialPlayback = false;
	const automaticReplayTriggers = new Set<TextEffectTrigger>([
		"resume",
		"route-enter",
		"intersection",
		"idle-return",
		"random-time",
		"random-interval",
	]);

	const play = (
		trigger: TextEffectTrigger,
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
		const selectedEffect = resolveTextEffectKind(candidateEffects, useRandomEffect, Math.random());
		const metadata = TEXT_EFFECTS[selectedEffect];
		const fromText =
			options.fromText ?? el.dataset.textEffectStableText ?? el.dataset.greetingTarget ?? el.textContent ?? text;
		const shouldLoop = options.forceLoop || (trigger !== "load" && metadata.role === "enter");

		if (shouldLoop && metadata.role === "enter") {
			void runTextTransition({
				el,
				fromText,
				toText: text,
				mode: "full-transition",
				enterEffect: selectedEffect,
				exitEffect: getPairedTextEffect(selectedEffect, "exit"),
				durationMs,
				typingStepMs,
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
			});
			return;
		}

		playTextEffect({
			el,
			effect: selectedEffect,
			text,
			durationMs,
			typingStepMs,
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
		});
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

	const createDelayedPlayback = (trigger: TextEffectTrigger, delayMs: number) => {
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

	if (initialTrigger === "route-enter" && shouldHandleTextEffectTrigger(normalizedTriggers, "route-enter")) {
		const routeEnterPlayback = createDelayedPlayback(
			"route-enter",
			initialDelayMs ?? DEFAULT_ROUTE_ENTER_SETTLE_DELAY_MS
		);
		routeEnterPlayback.schedule();
		registerTriggerCleanup(el, routeEnterPlayback.cleanup);
	} else if (initialTrigger !== "none" && shouldHandleTextEffectTrigger(normalizedTriggers, "load")) {
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

	if (shouldHandleTextEffectTrigger(normalizedTriggers, "hover")) {
		el.addEventListener("mouseenter", handlers.mouseenter);
		el.addEventListener("mouseleave", handlers.mouseleave);
		registerTriggerCleanup(el, () => {
			el.removeEventListener("mouseenter", handlers.mouseenter);
			el.removeEventListener("mouseleave", handlers.mouseleave);
		});
	}

	if (shouldHandleTextEffectTrigger(normalizedTriggers, "focus")) {
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

	if (shouldHandleTextEffectTrigger(normalizedTriggers, "resume") && typeof document !== "undefined") {
		const resumeHandler = () => {
			if (document.visibilityState === "visible") play("resume");
		};
		document.addEventListener("visibilitychange", resumeHandler);
		registerTriggerCleanup(el, () => document.removeEventListener("visibilitychange", resumeHandler));
	}

	if (shouldHandleTextEffectTrigger(normalizedTriggers, "route-enter") && typeof document !== "undefined") {
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
		shouldHandleTextEffectTrigger(normalizedTriggers, "intersection") &&
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

	if (shouldHandleTextEffectTrigger(normalizedTriggers, "idle-return") && typeof document !== "undefined") {
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

	if (shouldHandleTextEffectTrigger(normalizedTriggers, "content-change") && typeof MutationObserver !== "undefined") {
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

	if (shouldHandleTextEffectTrigger(normalizedTriggers, "random-interval")) {
		// Fires at a fixed, predictable cadence — like a heartbeat.
		const intervalId = globalThis.setInterval(() => {
			play("random-interval");
		}, randomIntervalMs);
		randomTimers.set(el, intervalId);
	}

	if (shouldHandleTextEffectTrigger(normalizedTriggers, "random-time")) {
		// Fires at unpredictable times — organic liveness. Uses randomIntervalMs as the
		// center of the window (default 20 000 ms); each delay is randomized in [0.5×, 1.5×]
		// of that value. Set data-text-effect-interval-ms to tune how fast or slow it fires.
		let timeoutId: ReturnType<typeof globalThis.setTimeout> | null = null;
		let cancelled = false;

		const scheduleNext = () => {
			if (cancelled) return;
			const delay = randomIntervalMs * 0.5 + Math.random() * randomIntervalMs;
			timeoutId = globalThis.setTimeout(() => {
				if (cancelled) return;
				timeoutId = null;
				play("random-time");
				scheduleNext();
			}, delay);
		};

		scheduleNext();
		registerTriggerCleanup(el, () => {
			cancelled = true;
			if (timeoutId !== null) globalThis.clearTimeout(timeoutId);
		});
	}
}
