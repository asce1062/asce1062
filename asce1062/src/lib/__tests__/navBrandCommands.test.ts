import { describe, expect, it } from "vitest";
import {
	NAVBRAND_COMMANDS,
	NAVBRAND_HINT_COMMAND_IDS,
	getNavBrandCommand,
	pickNavBrandHintCommand,
} from "@/lib/navBrand/commands";

describe("NAVBRAND_COMMANDS", () => {
	it("defines the phase 3 command row against real site actions", () => {
		expect(NAVBRAND_COMMANDS.map(({ id }) => id)).toEqual(["search", "blog", "projects", "guestbook", "help"]);
		expect(getNavBrandCommand("blog").href).toBe("/blog");
		expect(getNavBrandCommand("search").action).toBe("search-handoff");
		expect(getNavBrandCommand("help").action).toBe("hint");
	});
});

describe("NAVBRAND_HINT_COMMAND_IDS", () => {
	it("only includes actionable hint targets", () => {
		expect(NAVBRAND_HINT_COMMAND_IDS).toEqual(["search", "blog", "projects", "guestbook"]);
	});
});

describe("pickNavBrandHintCommand", () => {
	it("avoids repeating the last hint command when alternatives exist", () => {
		expect(
			pickNavBrandHintCommand({
				lastCommandId: "search",
				random: () => 0,
			}).id
		).toBe("blog");
	});

	it("falls back to the full pool if every candidate was filtered out", () => {
		expect(
			pickNavBrandHintCommand({
				lastCommandId: null,
				random: () => 0.99,
			}).id
		).toBe("guestbook");
	});
});
