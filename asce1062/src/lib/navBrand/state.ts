export type NavBrandState = "arrival" | "active" | "idle" | "return" | "system" | "hint";

export const IDLE_DELAY_MS = 45_000;
export const RETURN_SETTLE_MS = 4_000;
export const SYSTEM_MESSAGE_CHANCE = 0.05;
export const RARE_MESSAGE_CHANCE = 0.0125;
export const TRANSITION_EFFECT_CHANCE = 0.18;
export const DECRYPT_EFFECT_CHANCE = 0.08;

export const SYSTEM_MESSAGE_COOLDOWN_MS = 5 * 60_000;
export const RARE_MESSAGE_COOLDOWN_MS = 30 * 60_000;
export const RETURN_MESSAGE_COOLDOWN_MS = 10_000;
export const SYSTEM_STATE_DURATION_MS = 4_000;

const STATE_PRIORITY: NavBrandState[] = ["return", "system", "idle", "active", "arrival", "hint"];

export function shouldEnterIdle(lastActivityTs: number, now: number): boolean {
	return now - lastActivityTs >= IDLE_DELAY_MS;
}

export function resolveStatePriority(states: readonly NavBrandState[]): NavBrandState {
	return STATE_PRIORITY.find((state) => states.includes(state)) ?? "active";
}

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
