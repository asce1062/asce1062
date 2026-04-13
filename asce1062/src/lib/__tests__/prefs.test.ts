import { describe, it, expect } from "vitest";
import { PREF_KEYS } from "@/lib/prefs";

describe("PREF_KEYS", () => {
	it("has a transition key", () => {
		expect(PREF_KEYS.transition).toBe("theme-transition");
	});
});
