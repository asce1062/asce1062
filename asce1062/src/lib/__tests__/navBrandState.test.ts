import { describe, it, expect } from "vitest";
import {
	COLLAPSED_EVENT_NUDGE_CHANCE,
	COLLAPSED_NUDGE_INITIAL_DELAY_MS,
	COLLAPSED_NUDGE_REPEAT_DELAY_MS,
	COLLAPSED_SCHEDULED_NUDGE_CHANCE,
	IDLE_DELAY_MS,
	SYSTEM_MESSAGE_CHANCE,
	SYSTEM_MESSAGE_COOLDOWN_MS,
	getScheduledCuriosityDelay,
	resolveStatePriority,
	shouldShowCollapsedEventCuriosityNudge,
	shouldShowScheduledCollapsedCuriosityNudge,
	shouldEnterIdle,
	shouldShowSystemMessage,
	type NavBrandState,
} from "@/lib/navBrand/state";

describe("shouldEnterIdle", () => {
	it("becomes eligible once the idle delay has elapsed", () => {
		const now = 1_000_000;
		expect(shouldEnterIdle(now - IDLE_DELAY_MS, now)).toBe(true);
		expect(shouldEnterIdle(now - IDLE_DELAY_MS + 1, now)).toBe(false);
	});
});

describe("resolveStatePriority", () => {
	it("prefers higher-priority states when triggers compete", () => {
		const states: NavBrandState[] = ["active", "idle", "return"];
		expect(resolveStatePriority(states)).toBe("return");
	});
});

describe("shouldShowSystemMessage", () => {
	it("blocks system messages during cooldown", () => {
		const now = 1_000_000;
		expect(
			shouldShowSystemMessage({
				now,
				lastSystemTs: now - SYSTEM_MESSAGE_COOLDOWN_MS + 1,
				randomValue: 0,
			})
		).toBe(false);
	});

	it("allows system messages after cooldown when chance passes", () => {
		const now = 1_000_000;
		expect(
			shouldShowSystemMessage({
				now,
				lastSystemTs: now - SYSTEM_MESSAGE_COOLDOWN_MS,
				randomValue: SYSTEM_MESSAGE_CHANCE / 2,
			})
		).toBe(true);
	});

	it("rejects system messages when chance fails", () => {
		expect(
			shouldShowSystemMessage({
				now: 1_000_000,
				lastSystemTs: 0,
				randomValue: SYSTEM_MESSAGE_CHANCE + 0.001,
			})
		).toBe(false);
	});
});

describe("shouldShowCollapsedEventCuriosityNudge", () => {
	it("only allows the event nudge when the chance passes", () => {
		expect(
			shouldShowCollapsedEventCuriosityNudge({
				randomValue: COLLAPSED_EVENT_NUDGE_CHANCE / 2,
			})
		).toBe(true);
	});

	it("rejects the event nudge when the chance fails", () => {
		expect(
			shouldShowCollapsedEventCuriosityNudge({
				randomValue: COLLAPSED_EVENT_NUDGE_CHANCE + 0.001,
			})
		).toBe(false);
	});
});

describe("getScheduledCuriosityDelay", () => {
	it("uses the initial delay before the first scheduled nudge when the surface earned it", () => {
		expect(
			getScheduledCuriosityDelay({
				scheduledCount: 0,
				earlyEligible: true,
			})
		).toBe(COLLAPSED_NUDGE_INITIAL_DELAY_MS);
	});

	it("uses the repeat delay for the first nudge when the surface did not earn an early pulse", () => {
		expect(
			getScheduledCuriosityDelay({
				scheduledCount: 0,
				earlyEligible: false,
			})
		).toBe(COLLAPSED_NUDGE_REPEAT_DELAY_MS);
	});

	it("uses the repeat delay after the first scheduled pulse regardless of early eligibility", () => {
		expect(
			getScheduledCuriosityDelay({
				scheduledCount: 1,
				earlyEligible: true,
			})
		).toBe(COLLAPSED_NUDGE_REPEAT_DELAY_MS);

		expect(
			getScheduledCuriosityDelay({
				scheduledCount: 1,
				earlyEligible: false,
			})
		).toBe(COLLAPSED_NUDGE_REPEAT_DELAY_MS);
	});
});

describe("shouldShowScheduledCollapsedCuriosityNudge", () => {
	it("guarantees the first scheduled nudge", () => {
		expect(
			shouldShowScheduledCollapsedCuriosityNudge({
				scheduledCount: 0,
				randomValue: 0.99,
			})
		).toBe(true);
	});

	it("guarantees the second scheduled nudge", () => {
		expect(
			shouldShowScheduledCollapsedCuriosityNudge({
				scheduledCount: 1,
				randomValue: 0.99,
			})
		).toBe(true);
	});

	it("requires later scheduled nudges to pass a single chance gate", () => {
		expect(
			shouldShowScheduledCollapsedCuriosityNudge({
				scheduledCount: 2,
				randomValue: COLLAPSED_SCHEDULED_NUDGE_CHANCE / 2,
			})
		).toBe(true);

		expect(
			shouldShowScheduledCollapsedCuriosityNudge({
				scheduledCount: 2,
				randomValue: COLLAPSED_SCHEDULED_NUDGE_CHANCE + 0.001,
			})
		).toBe(false);
	});

	it("supports surfaces that only guarantee their first scheduled nudge", () => {
		expect(
			shouldShowScheduledCollapsedCuriosityNudge({
				scheduledCount: 0,
				randomValue: 0.99,
				guaranteedCount: 1,
			})
		).toBe(true);

		expect(
			shouldShowScheduledCollapsedCuriosityNudge({
				scheduledCount: 1,
				randomValue: COLLAPSED_SCHEDULED_NUDGE_CHANCE + 0.001,
				guaranteedCount: 1,
			})
		).toBe(false);
	});
});
