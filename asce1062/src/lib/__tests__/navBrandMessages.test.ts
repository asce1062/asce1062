import { describe, it, expect } from "vitest";
import {
	NAVBRAND_MESSAGE_POOLS,
	getActiveTimeBucket,
	getMessagePool,
	pickMessage,
	selectActiveGreeting,
	selectTerminalAtmosphereMessage,
} from "@/lib/navBrand/messages";

describe("getActiveTimeBucket", () => {
	it("maps hours to the expected active greeting pools", () => {
		expect(getActiveTimeBucket(5)).toBe("activeMorning");
		expect(getActiveTimeBucket(12)).toBe("activeAfternoon");
		expect(getActiveTimeBucket(17)).toBe("activeEvening");
		expect(getActiveTimeBucket(21)).toBe("activeEvening");
		expect(getActiveTimeBucket(22)).toBe("activeLate");
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

describe("getMessagePool", () => {
	it("filters terminal-only copy until the terminal is engaged", () => {
		expect(getMessagePool("activeAfternoon", { terminalEngaged: false })).not.toContain("sun still on the terminal");
		expect(getMessagePool("activeLate", { terminalEngaged: false })).not.toContain("the terminal is still warm");
		expect(getMessagePool("idle", { terminalEngaged: false })).not.toContain("terminal idle");
		expect(getMessagePool("idleEscalation", { terminalEngaged: false })).not.toContain("you left the terminal open");

		expect(getMessagePool("activeAfternoon", { terminalEngaged: true })).toContain("sun still on the terminal");
		expect(getMessagePool("activeLate", { terminalEngaged: true })).toContain("the terminal is still warm");
		expect(getMessagePool("idle", { terminalEngaged: true })).toContain("terminal idle");
		expect(getMessagePool("idleEscalation", { terminalEngaged: true })).toContain("you left the terminal open");
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

	it("only selects terminal-specific greetings when the terminal is engaged", () => {
		expect(
			selectActiveGreeting({
				hour: 14,
				terminalEngaged: false,
				random: () => 0.99,
			})
		).not.toBe("sun still on the terminal");

		expect(
			selectActiveGreeting({
				hour: 14,
				terminalEngaged: true,
				random: () => 0.99,
			})
		).toBe("sun still on the terminal");
	});
});

describe("selectTerminalAtmosphereMessage", () => {
	it("uses arrival copy on first-load for a first-time visitor", () => {
		const selection = selectTerminalAtmosphereMessage({
			reason: "load",
			hour: 9,
			visits: 1,
			random: () => 0,
		});

		expect(selection.category).toBe("arrival");
		expect(NAVBRAND_MESSAGE_POOLS.arrival).toContain(selection.message);
	});

	it("uses the correct active time bucket on load for returning visitors", () => {
		const afternoonSelection = selectTerminalAtmosphereMessage({
			reason: "load",
			hour: 14,
			visits: 8,
			random: () => 0,
		});

		expect(afternoonSelection.category).toBe("activeAfternoon");
		expect(NAVBRAND_MESSAGE_POOLS.activeAfternoon).toContain(afternoonSelection.message);
	});

	it("uses the idle escalation pool after the first idle event", () => {
		const selection = selectTerminalAtmosphereMessage({
			reason: "idle",
			hour: 18,
			visits: 12,
			idleCount: 2,
			random: () => 0,
		});

		expect(selection.category).toBe("idleEscalation");
		expect(NAVBRAND_MESSAGE_POOLS.idleEscalation).toContain(selection.message);
	});

	it("uses the return pool for resume-style triggers", () => {
		const selection = selectTerminalAtmosphereMessage({
			reason: "resume",
			hour: 18,
			visits: 12,
			random: () => 0,
		});

		expect(selection.category).toBe("return");
		expect(NAVBRAND_MESSAGE_POOLS.return).toContain(selection.message);
	});

	it("lets random-time escalate into system or rare copy when eligible", () => {
		const systemSelection = selectTerminalAtmosphereMessage({
			reason: "random-time",
			hour: 13,
			visits: 5,
			systemEligible: true,
			random: () => 0,
		});
		expect(systemSelection.category).toBe("system");
		expect(NAVBRAND_MESSAGE_POOLS.system).toContain(systemSelection.message);

		const rareSelection = selectTerminalAtmosphereMessage({
			reason: "random-time",
			hour: 13,
			visits: 5,
			rareEligible: true,
			random: () => 0,
		});
		expect(rareSelection.category).toBe("rare");
		expect(NAVBRAND_MESSAGE_POOLS.rare).toContain(rareSelection.message);
	});
});
