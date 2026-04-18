import { describe, expect, it } from "vitest";
import { buildTerminalPrelude } from "@/lib/navBrand/terminalPrelude";

describe("buildTerminalPrelude", () => {
	it("builds a stable four-line prelude without duplicates for returning visitors", () => {
		const prelude = buildTerminalPrelude({ random: () => 0 });

		expect(prelude.lines).toEqual([
			"[ restoring context ]",
			"[ aligning stars ]",
			"[ incoming transmission... ]",
			"[ waking signal ]",
		]);
		expect(new Set(prelude.lines).size).toBe(prelude.lines.length);
	});

	it("still builds a full prelude without visitor-memory status lines", () => {
		const prelude = buildTerminalPrelude({ random: () => 0.4 });

		expect(prelude.lines).toHaveLength(4);
		expect(prelude.lines).toContain("[ waking signal ]");
	});

	it("keeps the waking signal in view even when the randomized slice would drop it", () => {
		const prelude = buildTerminalPrelude({ random: () => 0.999999 });

		expect(prelude.lines).toHaveLength(4);
		expect(prelude.lines).toContain("[ waking signal ]");
		expect(new Set(prelude.lines).size).toBe(prelude.lines.length);
	});

	it("clamps injected random values so out-of-range generators do not corrupt the shuffle", () => {
		const prelude = buildTerminalPrelude({ random: () => 1 });

		expect(prelude.lines).toHaveLength(4);
		expect(prelude.lines.every((line) => typeof line === "string")).toBe(true);
		expect(new Set(prelude.lines).size).toBe(prelude.lines.length);
	});
});
