import { describe, expect, it } from "vitest";
import { buildTerminalPrelude } from "@/lib/navBrand/terminalPrelude";

describe("buildTerminalPrelude", () => {
	it("builds a stable four-line prelude without duplicates for returning visitors", () => {
		const prelude = buildTerminalPrelude({
			visits: 17,
			lastVisitLabel: "been 2 days",
			random: () => 0,
		});

		expect(prelude.lines).toEqual([
			"[ restoring context ]",
			"[ aligning stars ]",
			"[ incoming transmission... ]",
			"[ waking signal ]",
		]);
		expect(new Set(prelude.lines).size).toBe(prelude.lines.length);
		expect(prelude.statusLine).toBe("last seen: been 2 days · visits: 17");
	});

	it("switches to the first-contact branch when there is no prior visit label", () => {
		const prelude = buildTerminalPrelude({
			visits: 1,
			lastVisitLabel: null,
			random: () => 0.4,
		});

		expect(prelude.lines).toHaveLength(4);
		expect(prelude.lines).toContain("[ waking signal ]");
		expect(prelude.statusLine).toBe("first contact sequence · visits: 1");
	});

	it("keeps the waking signal in view even when the randomized slice would drop it", () => {
		const prelude = buildTerminalPrelude({
			visits: 5,
			lastVisitLabel: "just now",
			random: () => 0.999999,
		});

		expect(prelude.lines).toHaveLength(4);
		expect(prelude.lines).toContain("[ waking signal ]");
		expect(new Set(prelude.lines).size).toBe(prelude.lines.length);
	});

	it("clamps injected random values so out-of-range generators do not corrupt the shuffle", () => {
		const prelude = buildTerminalPrelude({
			visits: 9,
			lastVisitLabel: "moments ago",
			random: () => 1,
		});

		expect(prelude.lines).toHaveLength(4);
		expect(prelude.lines.every((line) => typeof line === "string")).toBe(true);
		expect(new Set(prelude.lines).size).toBe(prelude.lines.length);
	});
});
