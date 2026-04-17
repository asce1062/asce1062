import { describe, expect, it } from "vitest";
import {
	NAVBRAND_COMMANDS,
	NAVBRAND_HINT_COMMAND_IDS,
	buildNavBrandCommandIntent,
	getNavBrandCommand,
	resolveNavBrandCommandInput,
	pickNavBrandHintCommand,
} from "@/lib/navBrand/commands";

describe("NAVBRAND_COMMANDS", () => {
	it("defines the phase 3 command row against real site actions", () => {
		expect(NAVBRAND_COMMANDS.map(({ id }) => id)).toEqual([
			"search",
			"blog",
			"projects",
			"guestbook",
			"help",
			"email",
			"github",
			"theme",
			"stars",
			"matrix",
			"sidebar",
			"status",
		]);
		expect(getNavBrandCommand("blog").href).toBe("/blog");
		expect(getNavBrandCommand("search").action).toBe("search-handoff");
		expect(getNavBrandCommand("help").action).toBe("hint");
		expect(getNavBrandCommand("email").action).toBe("external-link");
		expect(getNavBrandCommand("theme").action).toBe("toggle-pref");
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

	it("resolves control and contact commands with argument payloads", () => {
		expect(resolveNavBrandCommandInput("theme dark")).toMatchObject({
			command: { id: "theme", action: "toggle-pref" },
			query: "dark",
		});
		expect(resolveNavBrandCommandInput("stars on")).toMatchObject({
			command: { id: "stars", action: "toggle-pref" },
			query: "on",
		});
		expect(resolveNavBrandCommandInput("collapse sidebar")).toMatchObject({
			command: { id: "sidebar", action: "toggle-pref" },
			query: "collapse",
		});
		expect(resolveNavBrandCommandInput("github")).toMatchObject({
			command: { id: "github", action: "external-link" },
		});
	});

	it("resolves discovery commands as local message actions", () => {
		expect(resolveNavBrandCommandInput("status")).toMatchObject({
			command: { id: "status", action: "message" },
		});
	});

	it("returns null for empty or unknown commands", () => {
		expect(resolveNavBrandCommandInput("")).toBeNull();
		expect(resolveNavBrandCommandInput("definitely-not-a-command")).toBeNull();
	});
});

describe("buildNavBrandCommandIntent", () => {
	it("builds external-link intents for contact commands", () => {
		expect(buildNavBrandCommandIntent(resolveNavBrandCommandInput("email")!)).toMatchObject({
			type: "external-link",
			href: "mailto:alex@alexmbugua.me",
		});
		expect(buildNavBrandCommandIntent(resolveNavBrandCommandInput("github")!)).toMatchObject({
			type: "external-link",
			href: "https://github.com/asce1062",
		});
	});

	it("builds toggle intents for control commands", () => {
		expect(buildNavBrandCommandIntent(resolveNavBrandCommandInput("theme dark")!)).toMatchObject({
			type: "toggle-pref",
			target: "theme",
			value: "dark",
		});
		expect(buildNavBrandCommandIntent(resolveNavBrandCommandInput("stars on")!)).toMatchObject({
			type: "toggle-pref",
			target: "stars-background-toggle",
			value: true,
		});
		expect(buildNavBrandCommandIntent(resolveNavBrandCommandInput("collapse sidebar")!)).toMatchObject({
			type: "toggle-pref",
			target: "sidebar-collapse",
			value: "collapse",
		});
	});

	it("builds message intents for local discovery commands", () => {
		expect(buildNavBrandCommandIntent(resolveNavBrandCommandInput("status")!)).toMatchObject({
			type: "message",
			message: "presence engine online",
		});
	});
});
