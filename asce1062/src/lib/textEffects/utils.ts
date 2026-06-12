import type {
	TextEffectKind,
	TextEffectRole,
	TextTransitionMode,
	TextEffectMetadata,
	EffectRendererHandle,
	TimeoutHandle,
	GlitchCharset,
} from "./types";
import { TEXT_EFFECTS, TEXT_EFFECT_FAMILY_PAIRS } from "./types";
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
	SIGNAL_ARTIFACTS,
	GLITCH_CHARSET_LETTERS,
	GLITCH_CHARSET_BINARY,
} from "./constants";

export function resolveGlitchCharsetStr(charset: GlitchCharset | undefined): string {
	switch (charset ?? "blocks") {
		case "blocks":
			return SIGNAL_ARTIFACTS.join("");
		case "letters":
			return GLITCH_CHARSET_LETTERS;
		case "binary":
			return GLITCH_CHARSET_BINARY;
		default:
			return charset as string;
	}
}

export function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

export function renderTypingFrame(
	text: string,
	visibleLength: number,
	showCursor: boolean,
	cursorChar = TERMINAL_BLOCK_CURSOR
): string {
	const resolvedText = text.slice(0, visibleLength);
	return showCursor ? `${resolvedText}${cursorChar}` : resolvedText;
}

export function resolveHumanPauseMs(
	averageStepMs: number,
	chance = DEFAULT_HUMAN_PAUSE_CHANCE,
	minMs = DEFAULT_HUMAN_PAUSE_MIN_MS,
	maxMs = DEFAULT_HUMAN_PAUSE_MAX_MS
): number {
	if (Math.random() <= 1 - chance) return 0;
	const pauseWindow = Math.max(0, maxMs - minMs);
	return minMs + Math.random() * Math.max(pauseWindow, averageStepMs);
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

export function getTextEffectMetadata(effect: TextEffectKind): TextEffectMetadata {
	return TEXT_EFFECTS[effect];
}

/** Resolve the opposite directional phase inside an effect's family. */
export function getPairedTextEffect(effect: TextEffectKind, role: TextEffectRole): TextEffectKind | "none" {
	const metadata = TEXT_EFFECTS[effect];
	const pair = TEXT_EFFECT_FAMILY_PAIRS[metadata.family];
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

export function resolveTextEffectDurationMs(effect: TextEffectKind, text: string): number {
	if (effect === "typing") return resolveTypingDurationMs(text);

	const profile = EFFECT_DURATION_PROFILES[effect];
	const length = Math.max(text.trim().length, 1);
	return clamp(profile.baseMs + length * profile.perCharMs, profile.minMs, profile.maxMs);
}

export function resolveTextEffectKind(
	effects: TextEffectKind[],
	useRandomEffect: boolean,
	randomValue: number,
	options: { mode?: TextTransitionMode } = {}
): TextEffectKind {
	const normalizedEffects = [...new Set(effects)].filter((effect) => {
		// Standalone randomization should only choose effects that make sense
		// without changing the element's stable text.
		if (options.mode === "standalone") return TEXT_EFFECTS[effect].standaloneSafe;
		return true;
	});
	const fallbackEffect = normalizedEffects[0] ?? "typing";

	if (!useRandomEffect || normalizedEffects.length <= 1) return fallbackEffect;

	const index = Math.min(normalizedEffects.length - 1, Math.floor(randomValue * normalizedEffects.length));
	return normalizedEffects[index] ?? fallbackEffect;
}
