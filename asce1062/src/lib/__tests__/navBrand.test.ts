import { describe, it, expect } from "vitest";
import { getMilestoneGreeting, getFeltDuration, getTerminalPresenceSummary } from "@/lib/navBrand/messages";

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

describe("getFeltDuration", () => {
	const NOW = 1_000_000_000_000;

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

describe("getTerminalPresenceSummary", () => {
	const NOW = 1_000_000_000_000;

	it("uses a first-contact badge when there is no prior visit timestamp", () => {
		expect(getTerminalPresenceSummary({ visits: 0, lastVisitTs: null, now: NOW })).toEqual({
			lastSeenBadge: "first contact",
			lastSeenText: "new to the signal",
			visits: 1,
		});
	});

	it("reuses felt-duration phrasing for returning visitors", () => {
		expect(getTerminalPresenceSummary({ visits: 17, lastVisitTs: NOW - 86_400_000, now: NOW })).toEqual({
			lastSeenBadge: "last seen",
			lastSeenText: "been 1 day",
			visits: 17,
		});
	});
});
