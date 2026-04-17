import { describe, expect, it } from "vitest";
import {
	NAVBRAND_COMMANDS,
	NAVBRAND_HINT_COMMAND_IDS,
	getNavBrandCommand,
	resolveNavBrandCommandInput,
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

describe("resolveNavBrandCommandInput", () => {
	it("matches direct commands", () => {
		expect(resolveNavBrandCommandInput("blog")?.command.id).toBe("blog");
		expect(resolveNavBrandCommandInput("projects")?.command.id).toBe("projects");
	});

	it("matches aliases and prefix-style launcher input", () => {
		expect(resolveNavBrandCommandInput("posts")?.command.id).toBe("blog");
		expect(resolveNavBrandCommandInput("proj")?.command.id).toBe("projects");
	});

	it("resolves search handoff commands with query payloads", () => {
		const resolved = resolveNavBrandCommandInput("find auth0");
		expect(resolved?.command.id).toBe("search");
		expect(resolved?.query).toBe("auth0");
	});

	it("supports search handoff aliases without requiring terminal-local content search", () => {
		expect(resolveNavBrandCommandInput("lookup astro")?.query).toBe("astro");
		expect(resolveNavBrandCommandInput("open search")?.command.action).toBe("search-handoff");
	});

	it("returns null for empty or unknown commands", () => {
		expect(resolveNavBrandCommandInput("")).toBeNull();
		expect(resolveNavBrandCommandInput("definitely-not-a-command")).toBeNull();
	});
});
