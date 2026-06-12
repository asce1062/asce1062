import type {
	TerminalTextEffectKind,
	TerminalTextEffectRole,
	TerminalTextTransitionMode,
	TerminalTextEffectMetadata,
	EffectRendererHandle,
	TimeoutHandle,
} from "./types";
import { TERMINAL_TEXT_EFFECTS, TERMINAL_TEXT_EFFECT_FAMILY_PAIRS } from "./types";
import {
	EFFECT_DURATION_PROFILES,
	DEFAULT_TYPING_STEP_MS,
	DEFAULT_TYPING_LEAD_IN_MS,
	DEFAULT_TYPING_MIN_DURATION_MS,
	DEFAULT_TYPING_MAX_DURATION_MS,
	DEFAULT_TYPING_BASE_MULTIPLIER,
	DEFAULT_TYPING_SHORT_TEXT_THRESHOLD,
	DEFAULT_TYPING_SHORT_TEXT_BONUS_MULTIPLIER,
	DEFAULT_HUMAN_PAUSE_CHANCE,
	DEFAULT_HUMAN_PAUSE_MIN_MS,
	DEFAULT_HUMAN_PAUSE_MAX_MS,
	TERMINAL_BLOCK_CURSOR,
} from "./constants";

export function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

export function renderTypingFrame(text: string, visibleLength: number, showCursor: boolean): string {
	const resolvedText = text.slice(0, visibleLength);
	return showCursor ? `${resolvedText}${TERMINAL_BLOCK_CURSOR}` : resolvedText;
}

export function resolveHumanPauseMs(averageStepMs: number): number {
	if (Math.random() <= 1 - DEFAULT_HUMAN_PAUSE_CHANCE) return 0;
	const pauseWindow = DEFAULT_HUMAN_PAUSE_MAX_MS - DEFAULT_HUMAN_PAUSE_MIN_MS;
	return DEFAULT_HUMAN_PAUSE_MIN_MS + Math.random() * Math.max(pauseWindow, averageStepMs);
}

export function createTimeoutRenderer(
	run: (schedule: (callback: () => void, delay: number) => void, finish: () => void) => void
): EffectRendererHandle {
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

export function resolveTerminalTextEffectKind(
	effects: TerminalTextEffectKind[],
	useRandomEffect: boolean,
	randomValue: number,
	options: { mode?: TerminalTextTransitionMode } = {}
): TerminalTextEffectKind {
	const normalizedEffects = [...new Set(effects)].filter((effect) => {
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
