import { describe, expect, it } from "vitest";
import { buildTerminalPrelude } from "@/lib/navBrand/terminalPrelude";

describe("buildTerminalPrelude", () => {
	it("builds a personal prelude with randomized init lines and visitor memory", () => {
		const prelude = buildTerminalPrelude({
			visits: 17,
			lastVisitLabel: "been 2 days",
			random: () => 0,
		});

		expect(prelude.lines).toContain("[ waking signal ]");
		expect(prelude.lines.length).toBeGreaterThanOrEqual(4);
		expect(prelude.statusLine).toContain("last seen");
	});
});
