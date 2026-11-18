import { describe, expect, it } from "vitest";
import { hasDateBegun } from "@/lib/content/publishDate";

describe("hasDateBegun", () => {
	// 01:00 on 19 Nov in Nairobi (UTC+3) is still 18 Nov for a UTC build machine.
	const now = new Date("2026-11-18T22:00:00Z");

	it("accepts past dates and today", () => {
		expect(hasDateBegun(new Date("2026-11-01"), now)).toBe(true);
		expect(hasDateBegun(new Date("2026-11-18"), now)).toBe(true);
	});

	it("accepts a date that has begun for an author ahead of UTC", () => {
		expect(hasDateBegun(new Date("2026-11-19"), now)).toBe(true);
	});

	it("rejects a date that has not begun anywhere", () => {
		expect(hasDateBegun(new Date("2026-11-20"), now)).toBe(false);
		expect(hasDateBegun(new Date("2027-11-18"), now)).toBe(false);
	});
});
