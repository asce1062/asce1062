import { describe, it, expect } from "vitest";
import { getMilestoneGreeting, getTimeOfDayGreeting, getFeltDuration } from "@/scripts/navBrand";

describe("getMilestoneGreeting", () => {
	it("returns 'hello, stranger' for visit 1", () => {
		expect(getMilestoneGreeting(1)).toBe("hello, stranger");
	});

	it("returns 'welcome back' for visits 2–4", () => {
		expect(getMilestoneGreeting(2)).toBe("welcome back");
		expect(getMilestoneGreeting(4)).toBe("welcome back");
	});

	it("returns 'back again.' for visits 5–9", () => {
		expect(getMilestoneGreeting(5)).toBe("back again.");
		expect(getMilestoneGreeting(9)).toBe("back again.");
	});

	it("returns 'you keep coming back.' for visits 10–24", () => {
		expect(getMilestoneGreeting(10)).toBe("you keep coming back.");
		expect(getMilestoneGreeting(24)).toBe("you keep coming back.");
	});

	it("returns 'practically a regular' for visits 25–49", () => {
		expect(getMilestoneGreeting(25)).toBe("practically a regular");
		expect(getMilestoneGreeting(49)).toBe("practically a regular");
	});

	it("returns 'asce1062 approves.' for visit 50+", () => {
		expect(getMilestoneGreeting(50)).toBe("asce1062 approves.");
		expect(getMilestoneGreeting(999)).toBe("asce1062 approves.");
	});
});

describe("getTimeOfDayGreeting", () => {
	it("returns 'good morning' for 05:00–11:59", () => {
		expect(getTimeOfDayGreeting(5)).toBe("good morning");
		expect(getTimeOfDayGreeting(11)).toBe("good morning");
	});

	it("returns 'good afternoon' for 12:00–16:59", () => {
		expect(getTimeOfDayGreeting(12)).toBe("good afternoon");
		expect(getTimeOfDayGreeting(16)).toBe("good afternoon");
	});

	it("returns 'good evening' for 17:00–20:59", () => {
		expect(getTimeOfDayGreeting(17)).toBe("good evening");
		expect(getTimeOfDayGreeting(20)).toBe("good evening");
	});

	it("returns 'still up?' for 21:00–04:59", () => {
		expect(getTimeOfDayGreeting(21)).toBe("still up?");
		expect(getTimeOfDayGreeting(0)).toBe("still up?");
		expect(getTimeOfDayGreeting(4)).toBe("still up?");
	});
});

describe("getFeltDuration", () => {
	const NOW = 1_000_000_000_000; // fixed reference point

	it("returns 'just here a moment ago' for < 1 hour", () => {
		expect(getFeltDuration(NOW - 1_000, NOW)).toBe("just here a moment ago");
		expect(getFeltDuration(NOW - 3_599_999, NOW)).toBe("just here a moment ago");
	});

	it("returns 'back the same day' for 1h–23h59m", () => {
		expect(getFeltDuration(NOW - 3_600_000, NOW)).toBe("back the same day");
		expect(getFeltDuration(NOW - 86_399_999, NOW)).toBe("back the same day");
	});

	it("returns 'been 1 day' for exactly 1 day", () => {
		expect(getFeltDuration(NOW - 86_400_000, NOW)).toBe("been 1 day");
	});

	it("returns 'been N days' (plural) for 2–6 days", () => {
		expect(getFeltDuration(NOW - 86_400_000 * 2, NOW)).toBe("been 2 days");
		expect(getFeltDuration(NOW - 86_400_000 * 6, NOW)).toBe("been 6 days");
	});

	it("returns 'been a while' for 7+ days", () => {
		expect(getFeltDuration(NOW - 86_400_000 * 7, NOW)).toBe("been a while");
		expect(getFeltDuration(NOW - 86_400_000 * 30, NOW)).toBe("been a while");
	});
});
