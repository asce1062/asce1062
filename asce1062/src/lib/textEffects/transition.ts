import type {
	TextEffectKind,
	TextEffectState,
	TextEffectOptions,
	TextTransitionOptions,
	ActiveEffectHandle,
	EffectRendererHandle,
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
import { DEFAULT_TRANSITION_HOLD_MS } from "./constants";
import { getPairedTextEffect } from "./utils";
import { runTypingEnterRenderer } from "./effects/typing";
import { runBackspaceExitRenderer } from "./effects/backspace";
import { runDecryptEnterRenderer } from "./effects/decrypt";
import { runEntropyExitRenderer } from "./effects/entropy";
import { runGlitchLockOnEnterRenderer } from "./effects/glitchLockOn";
import { runSignalLossExitRenderer } from "./effects/signalLoss";
import { runGlitchRenderer } from "./effects/glitch";
import { runCensorRenderer } from "./effects/censor";
import { runUncensorRenderer } from "./effects/uncensor";
import { runScrambleRenderer } from "./effects/scramble";
import { runSlowRevealRenderer } from "./effects/slowReveal";
import { runShuffleRenderer } from "./effects/shuffle";
import { activeEffects, clearActiveEffect } from "./activeEffects";

/** Optional root dataset hook so consumers can style active effects in CSS. */
function setRootEffect(
	rootEl: HTMLElement | null | undefined,
	effect: TextEffectState,
	rootEffectDataset = "navbrandEffect"
): void {
	if (!rootEl) return;
	rootEl.dataset[rootEffectDataset] = effect;
}

function runPhaseRenderer(options: {
	el: HTMLElement;
	effect: TextEffectKind;
	text: string;
	durationMs?: number;
	typingStepMs?: number;
	typingOptions?: TypingEffectOptions;
	glitchOptions?: GlitchEffectOptions;
	signalLossOptions?: SignalLossEffectOptions;
	glitchBurstOptions?: GlitchBurstEffectOptions;
	censorOptions?: CensorEffectOptions;
	uncensorOptions?: UncensorEffectOptions;
	scrambleOptions?: ScrambleEffectOptions;
	slowRevealOptions?: SlowRevealEffectOptions;
	shuffleOptions?: ShuffleEffectOptions;
}): EffectRendererHandle {
	switch (options.effect) {
		case "typing":
			return runTypingEnterRenderer(options.el, options.text, {
				stepMs: options.typingStepMs,
				...options.typingOptions,
			});
		case "backspace":
			return runBackspaceExitRenderer(options.el, options.text, {
				stepMs: options.typingStepMs,
				...options.typingOptions,
			});
		case "decrypt":
			return runDecryptEnterRenderer(options.el, options.text, options.durationMs);
		case "entropy":
			return runEntropyExitRenderer(options.el, options.text, options.durationMs);
		case "glitch-lock-on":
			return runGlitchLockOnEnterRenderer(options.el, options.text, {
				durationMs: options.durationMs,
				...options.glitchOptions,
			});
		case "signal-loss":
			return runSignalLossExitRenderer(options.el, options.text, {
				durationMs: options.durationMs,
				...options.signalLossOptions,
			});
		case "glitch":
			return runGlitchRenderer(options.el, options.text, {
				durationMs: options.durationMs,
				...options.glitchBurstOptions,
			});
		case "censor":
			return runCensorRenderer(options.el, options.text, {
				durationMs: options.durationMs,
				...options.censorOptions,
			});
		case "uncensor":
			return runUncensorRenderer(options.el, options.text, {
				durationMs: options.durationMs,
				...options.uncensorOptions,
			});
		case "scramble":
			return runScrambleRenderer(options.el, options.text, {
				durationMs: options.durationMs,
				...options.scrambleOptions,
			});
		case "slow-reveal":
			return runSlowRevealRenderer(options.el, options.text, {
				durationMs: options.durationMs,
				...options.slowRevealOptions,
			});
		case "shuffle":
			return runShuffleRenderer(options.el, options.text, {
				durationMs: options.durationMs,
				...options.shuffleOptions,
			});
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
	mode: NonNullable<TextTransitionOptions["mode"]>;
	fromText: string;
	toText: string;
	enterEffect: TextEffectKind | "none";
	exitEffect: TextEffectKind | "none";
}): string {
	const activeEffect = options.exitEffect !== "none" ? options.exitEffect : options.enterEffect;
	const strategy = activeEffect !== "none" ? TEXT_EFFECTS[activeEffect].reducedMotion : "instant-target";

	if (strategy === "instant-clear") return "";
	if (strategy === "instant-restore" && options.mode === "standalone") return options.fromText || options.toText;
	return options.toText;
}

function resolveTransitionEffects(options: TextTransitionOptions): {
	enterEffect: TextEffectKind | "none";
	exitEffect: TextEffectKind | "none";
} {
	const effect = options.effect ?? "none";
	const metadata = effect !== "none" ? TEXT_EFFECTS[effect] : null;
	return {
		enterEffect:
			options.enterEffect ?? (metadata?.role === "enter" || metadata?.role === "standalone" ? effect : "none"),
		exitEffect: options.exitEffect ?? (metadata?.role === "exit" || metadata?.role === "standalone" ? effect : "none"),
	};
}

/** Stop any in-progress effect and restore the stable text immediately. */
export function resetTextEffect(
	el: HTMLElement | null,
	options: Pick<TextEffectOptions, "rootEl" | "rootEffectDataset"> = {}
): void {
	if (!el) return;
	clearActiveEffect(el);
	setRootEffect(options.rootEl, "none", options.rootEffectDataset);

	const target = el.dataset.textEffectStableText ?? el.dataset.greetingTarget ?? el.textContent ?? "";
	el.textContent = target;
}

export async function runTextTransition(options: TextTransitionOptions): Promise<boolean> {
	const {
		el,
		rootEl,
		rootEffectDataset,
		onComplete,
		reducedMotion,
		durationMs,
		typingStepMs,
		typingOptions,
		glitchOptions,
		signalLossOptions,
		glitchBurstOptions,
		censorOptions,
		uncensorOptions,
		scrambleOptions,
		slowRevealOptions,
		shuffleOptions,
	} = options;
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
		const runPhase = async (effect: TextEffectKind | "none", text: string) => {
			if (cancelled || effect === "none") return;
			setRootEffect(rootEl, effect, rootEffectDataset);
			activeRenderer = runPhaseRenderer({
				el,
				effect,
				text,
				durationMs,
				typingStepMs,
				typingOptions,
				glitchOptions,
				signalLossOptions,
				glitchBurstOptions,
				censorOptions,
				uncensorOptions,
				scrambleOptions,
				slowRevealOptions,
				shuffleOptions,
			});
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
 *   playTextEffect({ effect: "typing", text: "engineer" })
 *   result: "alex" backspaces out, then "engineer" types in
 *
 * If the stable text has not changed, this imperative API remains enter-only.
 * Declarative replay triggers such as hover/random-time use
 * `bindTextEffectTriggers()` to run the full family loop instead.
 *
 * Those decisions belong to concrete callers. Trigger-driven surfaces should
 * prefer `bindTextEffectTriggers()` via `src/scripts/textEffectRegistry.ts`
 * so timing stays declarative in markup.
 */
export function playTextEffect(options: {
	el: HTMLElement | null;
	effect: TextEffectKind | "none";
	text: string;
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
}): boolean {
	if (!options.el) return false;
	const metadata = options.effect !== "none" ? TEXT_EFFECTS[options.effect] : null;
	const fromText =
		options.el.dataset.textEffectStableText ??
		options.el.dataset.greetingTarget ??
		options.el.textContent ??
		options.text;
	const hasChangedStableText = Boolean(metadata && metadata.role === "enter" && fromText && fromText !== options.text);
	const mode =
		metadata?.role === "exit" || metadata?.role === "standalone"
			? "standalone"
			: hasChangedStableText
				? "full-transition"
				: "enter-only";
	void runTextTransition({
		...options,
		toText: options.text,
		fromText,
		mode,
		enterEffect: metadata?.role === "enter" ? options.effect : undefined,
		exitEffect: hasChangedStableText ? getPairedTextEffect(options.effect as TextEffectKind, "exit") : undefined,
		effect: options.effect,
	});
	return options.effect !== "none" && !isReducedMotionRequested(options.reducedMotion);
}
