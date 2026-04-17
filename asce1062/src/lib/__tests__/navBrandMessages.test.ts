import { describe, it, expect } from "vitest";
import {
	NAVBRAND_MESSAGE_POOLS,
	getActiveTimeBucket,
	pickMessage,
	selectActiveGreeting,
} from "@/lib/navBrand/messages";

describe("getActiveTimeBucket", () => {
	it("maps hours to the expected active greeting pools", () => {
		expect(getActiveTimeBucket(5)).toBe("activeMorning");
		expect(getActiveTimeBucket(12)).toBe("activeAfternoon");
		expect(getActiveTimeBucket(17)).toBe("activeEvening");
		expect(getActiveTimeBucket(2)).toBe("activeLate");
	});
});

describe("pickMessage", () => {
	it("avoids immediately repeating the previous message when alternatives exist", () => {
		const pool = ["alpha", "beta", "gamma"];
		const selected = pickMessage(pool, { lastMessage: "alpha", random: () => 0 });
		expect(selected).toBe("beta");
	});

	it("returns the same message when the pool has only one option", () => {
		expect(pickMessage(["alpha"], { lastMessage: "alpha", random: () => 0.9 })).toBe("alpha");
	});
});

describe("selectActiveGreeting", () => {
	it("chooses from the correct time-of-day pool", () => {
		const greeting = selectActiveGreeting({
			hour: 9,
			lastMessage: null,
			random: () => 0,
		});
		expect(NAVBRAND_MESSAGE_POOLS.activeMorning).toContain(greeting);
	});

	it("does not repeat the same greeting twice in a row within a category", () => {
		const previous = NAVBRAND_MESSAGE_POOLS.activeEvening[0];
		const greeting = selectActiveGreeting({
			hour: 18,
			lastMessage: previous,
			random: () => 0,
		});
		expect(greeting).not.toBe(previous);
		expect(NAVBRAND_MESSAGE_POOLS.activeEvening).toContain(greeting);
	});
});
