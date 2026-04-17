import { describe, it, expect } from "vitest";
import {
	IDLE_DELAY_MS,
	SYSTEM_MESSAGE_CHANCE,
	SYSTEM_MESSAGE_COOLDOWN_MS,
	shouldEnterIdle,
	resolveStatePriority,
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
