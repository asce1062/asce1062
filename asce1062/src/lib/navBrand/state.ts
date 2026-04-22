/**
 * Navbrand state/effect policy.
 *
 * This module is the pure decision layer for:
 * - state names and timing constants
 * - rarity/cooldown rules
 * - state priority resolution
 * - transition-effect eligibility
 *
 * It should remain browser-agnostic so it stays easy to unit test.
 */
import type { TerminalTextEffectKind } from "@/lib/textEffects/terminalTextEffect";

export type NavBrandState = "arrival" | "active" | "idle" | "return" | "system" | "hint";
export type NavBrandEffect = "none" | TerminalTextEffectKind;

export const IDLE_DELAY_MS = 45_000;
export const RETURN_SETTLE_MS = 4_000;
export const HINT_STATE_DURATION_MS = 4_500;
export const SYSTEM_MESSAGE_CHANCE = 0.05;
export const RARE_MESSAGE_CHANCE = 0.0125;
export const COLLAPSED_EVENT_NUDGE_CHANCE = 0.14;
export const COLLAPSED_NUDGE_INITIAL_DELAY_MS = 7_000;
export const COLLAPSED_NUDGE_REPEAT_DELAY_MS = 22_000;
export const COLLAPSED_NUDGE_VISIBLE_DURATION_MS = 4_000;
export const COLLAPSED_SCHEDULED_NUDGE_CHANCE = 0.15;
const TRANSITION_EFFECT_CHANCE = 0.18;
const DECRYPT_EFFECT_CHANCE = 0.08;
export const EFFECT_COOLDOWN_MS = 20_000;

export const SYSTEM_MESSAGE_COOLDOWN_MS = 5 * 60_000;
export const RARE_MESSAGE_COOLDOWN_MS = 30 * 60_000;
export const SYSTEM_STATE_DURATION_MS = 4_000;

const STATE_PRIORITY: NavBrandState[] = ["return", "system", "idle", "active", "arrival", "hint"];

/** Idle is purely time-based; the coordinator owns the timer lifecycle. */
export function shouldEnterIdle(lastActivityTs: number, now: number): boolean {
	return now - lastActivityTs >= IDLE_DELAY_MS;
}

/** Resolve competing state triggers using the priority order defined in the spec. */
export function resolveStatePriority(states: readonly NavBrandState[]): NavBrandState {
	return STATE_PRIORITY.find((state) => states.includes(state)) ?? "active";
}

/** System messages are rare interruptions, so cooldown always wins over chance. */
export function shouldShowSystemMessage(options: {
	now: number;
	lastSystemTs: number;
	randomValue: number;
	chance?: number;
	cooldownMs?: number;
}): boolean {
	const {
		now,
		lastSystemTs,
		randomValue,
		chance = SYSTEM_MESSAGE_CHANCE,
		cooldownMs = SYSTEM_MESSAGE_COOLDOWN_MS,
	} = options;

	if (lastSystemTs > 0 && now - lastSystemTs < cooldownMs) {
		return false;
	}

	return randomValue < chance;
}

/** Rare messages are even scarcer and piggyback on the same pure eligibility style. */
export function shouldShowRareMessage(options: {
	now: number;
	lastRareTs: number;
	randomValue: number;
	chance?: number;
	cooldownMs?: number;
}): boolean {
	const { now, lastRareTs, randomValue, chance = RARE_MESSAGE_CHANCE, cooldownMs = RARE_MESSAGE_COOLDOWN_MS } = options;

	if (lastRareTs > 0 && now - lastRareTs < cooldownMs) {
		return false;
	}

	return randomValue < chance;
}

/**
 * Collapsed-sidebar curiosity nudges should stay occasional.
 *
 * The coordinator in `src/scripts/navBrand.ts` already runs scheduled nudges.
 * This helper only decides whether a collapse event has earned an extra prompt
 * pulse, so the sidebar does not wink at the user every single time it closes.
 */
export function shouldShowCollapsedEventCuriosityNudge(options: { randomValue: number; chance?: number }): boolean {
	const { randomValue, chance = COLLAPSED_EVENT_NUDGE_CHANCE } = options;
	return randomValue < chance;
}

/**
 * Curiosity surfaces can optionally "earn" an earlier first pulse.
 *
 * Examples:
 * - collapsed desktop sidebar gets the early first pulse after collapse
 * - mobile header only gets the early first pulse on specific routes
 */
export function getScheduledCuriosityDelay(options: {
	scheduledCount: number;
	earlyEligible: boolean;
	initialDelayMs?: number;
	repeatDelayMs?: number;
}): number {
	const {
		scheduledCount,
		earlyEligible,
		initialDelayMs = COLLAPSED_NUDGE_INITIAL_DELAY_MS,
		repeatDelayMs = COLLAPSED_NUDGE_REPEAT_DELAY_MS,
	} = options;

	if (scheduledCount === 0) {
		return earlyEligible ? initialDelayMs : repeatDelayMs;
	}

	return repeatDelayMs;
}

/**
 * Scheduled collapsed nudges are front-loaded:
 * - pulse 1 is guaranteed after the initial wait
 * - pulse 2 is guaranteed after the first repeat wait
 * - later pulses must "earn" their appearance via chance
 */
export function shouldShowScheduledCollapsedCuriosityNudge(options: {
	scheduledCount: number;
	randomValue: number;
	chance?: number;
	guaranteedCount?: number;
}): boolean {
	const { scheduledCount, randomValue, chance = COLLAPSED_SCHEDULED_NUDGE_CHANCE, guaranteedCount = 2 } = options;
	if (scheduledCount < guaranteedCount) return true;
	return randomValue < chance;
}

/**
 * Effect chooser.
 *
 * Important constraint: this only chooses *which* effect is allowed. The
 * runtime playback is handled by:
 * - `playNavBrandEffect()` in `src/lib/navBrand/effects.ts`
 * - `renderNavBrand()` in `src/scripts/navBrand.ts`, which calls that adapter
 *
 * Keeping playback out of this file lets the state policy stay pure and unit
 * testable while the browser-only coordinator owns DOM mutation.
 */
export function chooseTransitionEffect(options: {
	fromState: NavBrandState;
	toState: NavBrandState;
	tone: "normal" | "rare";
	reducedMotion: boolean;
	lastEffectTs: number;
	now: number;
	randomValue: number;
	decryptRandomValue: number;
}): NavBrandEffect {
	const { fromState, toState, tone, reducedMotion, lastEffectTs, now, randomValue, decryptRandomValue } = options;

	if (reducedMotion) return "none";
	if (lastEffectTs > 0 && now - lastEffectTs < EFFECT_COOLDOWN_MS) return "none";

	// Only animate transitions that read as meaningful atmospheric events.
	const isMeaningfulTransition =
		(fromState === "idle" && toState === "active") ||
		toState === "return" ||
		toState === "system" ||
		(fromState === "system" && toState === "active");

	if (!isMeaningfulTransition) return "none";
	if (randomValue >= TRANSITION_EFFECT_CHANCE) return "none";

	// Decrypt is the more "special" flourish, so it is limited to rarer moments.
	const canDecrypt =
		(toState === "system" && tone === "rare") ||
		(fromState === "system" && toState === "active") ||
		toState === "return";

	if (canDecrypt && decryptRandomValue < DECRYPT_EFFECT_CHANCE) {
		return "decrypt";
	}

	return "typing";
}
