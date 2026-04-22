import { describe, expect, it } from "vitest";
import { PROFESSIONAL, SITE, SOCIAL } from "@/config/site-config";
import { mainNavigation } from "@/data/navigation";
import {
	NAVBRAND_COMMANDS,
	NAVBRAND_HINT_COMMAND_IDS,
	buildNavBrandHelpMessage,
	buildNavBrandHistoryMessage,
	buildNavBrandIdentityMessage,
	buildNavBrandRouteListMessage,
	buildNavBrandCommandIntent,
	buildNavBrandStatusMessage,
	buildNavBrandUnknownCommandMessage,
	getNavBrandCommand,
	resolveNavBrandCommandCompletions,
	resolveNavBrandCommandSuggestion,
	resolveNavBrandCommandInput,
	pickNavBrandHintCommand,
} from "@/lib/navBrand/commands";

describe("NAVBRAND_COMMANDS", () => {
	it("defines the command row against real site actions", () => {
		expect(NAVBRAND_COMMANDS.map(({ id }) => id)).toEqual([
			"search",
			"help",
			"email",
			"github",
			"copy",
			"theme",
			"background",
			"sidebar",
			"status",
			"clear",
			"clear-history",
			"reset",
			"minimize",
			"close",
			"history",
			"neofetch",
			"identity",
			"pwd",
			"list",
			"open",
		]);
		expect(getNavBrandCommand("search").action).toBe("search-handoff");
		expect(getNavBrandCommand("help").action).toBe("hint");
		expect(getNavBrandCommand("email").action).toBe("external-link");
		expect(getNavBrandCommand("copy").action).toBe("copy");
		expect(getNavBrandCommand("theme").action).toBe("toggle-pref");
		expect(getNavBrandCommand("clear").intent).toBe("clear");
		expect(getNavBrandCommand("open").intent).toBe("navigation");
	});
});

describe("NAVBRAND_HINT_COMMAND_IDS", () => {
	it("only includes actionable hint targets", () => {
		expect(NAVBRAND_HINT_COMMAND_IDS).toEqual(["search", "open", "help"]);
	});
});

describe("pickNavBrandHintCommand", () => {
	it("avoids repeating the last hint command when alternatives exist", () => {
		expect(
			pickNavBrandHintCommand({
				lastCommandId: "search",
				random: () => 0,
			}).id
		).toBe("open");
	});

	it("falls back to the full pool if every candidate was filtered out", () => {
		expect(
			pickNavBrandHintCommand({
				lastCommandId: null,
				random: () => 0.99,
			}).id
		).toBe("help");
	});
});

describe("resolveNavBrandCommandInput", () => {
	it("matches direct commands", () => {
		expect(resolveNavBrandCommandInput("help")?.command.id).toBe("help");
		expect(resolveNavBrandCommandInput("status")?.command.id).toBe("status");
	});

	it("strips verbose flags before resolving commands", () => {
		expect(resolveNavBrandCommandInput("status --verbose")).toMatchObject({
			command: { id: "status" },
			verbose: true,
		});
		expect(resolveNavBrandCommandInput("whoami -v")).toMatchObject({
			command: { id: "identity" },
			verbose: true,
		});
		expect(resolveNavBrandCommandInput("history details")).toMatchObject({
			command: { id: "history" },
			verbose: true,
		});
		expect(resolveNavBrandCommandInput("ls more")).toMatchObject({
			command: { id: "list" },
			verbose: true,
		});
		expect(resolveNavBrandCommandInput("copy email --verbose")).toMatchObject({
			command: { id: "copy" },
			query: "email",
			verbose: true,
		});
	});

	it("does not treat page routes as direct commands", () => {
		expect(resolveNavBrandCommandInput("blog")).toBeNull();
		expect(resolveNavBrandCommandInput("projects")).toBeNull();
		expect(resolveNavBrandCommandInput("guestbook")).toBeNull();
		expect(resolveNavBrandCommandInput("posts")).toBeNull();
		expect(resolveNavBrandCommandInput("proj")).toBeNull();
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

	it("normalizes clear aliases into the same clear intent", () => {
		const aliases = ["clear", "cls", "clr", "clean", "wipe", "c", "ctrl+l", "Clear-Host", "clear-host"];

		for (const alias of aliases) {
			expect(buildNavBrandCommandIntent(resolveNavBrandCommandInput(alias)!)).toEqual({ type: "clear-viewport" });
		}
	});

	it("normalizes typed forms of the Cmd/Ctrl+K shortcut to the keyboard clear behavior", () => {
		for (const alias of ["cmd+k", "⌘K", "ctrl+k", "ctrl+shift+k"]) {
			expect(buildNavBrandCommandIntent(resolveNavBrandCommandInput(alias)!)).toEqual({ type: "clear-history" });
		}
	});

	it("normalizes reset, minimize, and close aliases into terminal lifecycle intents", () => {
		for (const alias of [
			"reset",
			"reload",
			"restart",
			"reboot",
			"refresh",
			"reinit",
			"fix",
			"powercycle",
			"reconnect",
		]) {
			expect(buildNavBrandCommandIntent(resolveNavBrandCommandInput(alias)!)).toEqual({ type: "reset-terminal" });
		}

		for (const alias of ["minimize", "hide"]) {
			expect(buildNavBrandCommandIntent(resolveNavBrandCommandInput(alias)!)).toEqual({ type: "minimize-terminal" });
		}

		for (const alias of ["close terminal", "close", "exit", "quit", "logout", "bye", "q", ":q"]) {
			expect(buildNavBrandCommandIntent(resolveNavBrandCommandInput(alias)!)).toEqual({ type: "close-terminal" });
		}
	});

	it("normalizes help and identity aliases into local terminal responses", () => {
		for (const alias of ["help", "?", "man", "commands", "menu", "--help", "-h"]) {
			expect(buildNavBrandCommandIntent(resolveNavBrandCommandInput(alias)!)).toMatchObject({
				type: "message",
				message: expect.stringContaining("stellar console help"),
			});
		}

		for (const alias of ["whoami", "whois"]) {
			expect(buildNavBrandCommandIntent(resolveNavBrandCommandInput(alias)!)).toMatchObject({
				type: "message",
				message: expect.stringContaining(SITE.author),
			});
			const intent = buildNavBrandCommandIntent(resolveNavBrandCommandInput(alias)!);
			expect(intent).toMatchObject({
				type: "message",
				message: expect.stringContaining(SITE.titleSuffix),
			});
			expect(intent).toMatchObject({
				type: "message",
				message: expect.stringContaining(PROFESSIONAL.jobTitle),
			});
			expect(intent).toMatchObject({
				type: "message",
				message: expect.stringContaining(SOCIAL.github),
			});
		}
	});

	it("maps shell-style navigation commands without turning search into redundant local search", () => {
		expect(buildNavBrandCommandIntent(resolveNavBrandCommandInput("pwd")!)).toEqual({ type: "show-working-route" });
		expect(buildNavBrandCommandIntent(resolveNavBrandCommandInput("ls")!)).toEqual({ type: "list-routes" });
		expect(buildNavBrandCommandIntent(resolveNavBrandCommandInput("dir")!)).toEqual({ type: "list-routes" });
		expect(buildNavBrandCommandIntent(resolveNavBrandCommandInput("tree")!)).toEqual({ type: "list-routes" });
		expect(buildNavBrandCommandIntent(resolveNavBrandCommandInput("lsa")!)).toEqual({ type: "list-routes" });
		expect(buildNavBrandCommandIntent(resolveNavBrandCommandInput("la")!)).toEqual({ type: "list-routes" });
		expect(buildNavBrandCommandIntent(resolveNavBrandCommandInput("ll")!)).toEqual({ type: "list-routes" });
		expect(buildNavBrandCommandIntent(resolveNavBrandCommandInput("cd blog")!)).toEqual({
			type: "navigate",
			href: "/blog",
		});
		expect(buildNavBrandCommandIntent(resolveNavBrandCommandInput("open projects")!)).toEqual({
			type: "navigate",
			href: "/projects",
		});
		expect(buildNavBrandCommandIntent(resolveNavBrandCommandInput("Invoke-Item guestbook")!)).toEqual({
			type: "navigate",
			href: "/guestbook",
		});
		expect(buildNavBrandCommandIntent(resolveNavBrandCommandInput("cd notebook")!)).toEqual({
			type: "navigate",
			href: "/notes",
		});
		expect(buildNavBrandCommandIntent(resolveNavBrandCommandInput("cd now")!)).toEqual({
			type: "navigate",
			href: "/now",
		});
		expect(buildNavBrandCommandIntent(resolveNavBrandCommandInput("cd feed")!)).toEqual({
			type: "navigate",
			href: "/rss.xml",
		});
		expect(buildNavBrandCommandIntent(resolveNavBrandCommandInput("cd rss")!)).toEqual({
			type: "navigate",
			href: "/rss.xml",
		});
		expect(buildNavBrandCommandIntent(resolveNavBrandCommandInput("cd atom.xml")!)).toEqual({
			type: "navigate",
			href: "/rss.xml",
		});
		expect(buildNavBrandCommandIntent(resolveNavBrandCommandInput("cd sitemap")!)).toEqual({
			type: "navigate",
			href: "/sitemap-index.xml",
		});
		expect(buildNavBrandCommandIntent(resolveNavBrandCommandInput("cd public.pgp")!)).toEqual({
			type: "navigate",
			href: "/downloads/public.pgp",
		});
		expect(buildNavBrandCommandIntent(resolveNavBrandCommandInput("cd licensing")!)).toEqual({
			type: "navigate",
			href: "/notes/2026-03-12-licensing",
		});
		expect(buildNavBrandCommandIntent(resolveNavBrandCommandInput("open search")!)).toEqual({
			type: "search-handoff",
			query: null,
		});
	});

	it("derives terminal route listing from main navigation data", () => {
		const routeList = buildNavBrandRouteListMessage();
		const internalNavRoutes = mainNavigation.filter((link) => !link.external && link.href.startsWith("/"));

		for (const link of internalNavRoutes) {
			expect(routeList).toContain(`${link.name.toLowerCase().replace(/\s+/g, "-").padEnd(16)}${link.href}`);
		}
		expect(routeList).toContain("notebook        /notes");
		expect(routeList).toContain("now             /now");
		expect(routeList).not.toContain("github");
	});

	it("resolves postfix help topics before fuzzy command matching", () => {
		expect(resolveNavBrandCommandInput("clear help")).toMatchObject({
			command: { id: "help" },
			query: "clear",
		});
		expect(resolveNavBrandCommandInput("navigation man")).toMatchObject({
			command: { id: "help" },
			query: "navigation",
		});
		expect(resolveNavBrandCommandInput("cls ?")).toMatchObject({
			command: { id: "help" },
			query: "cls",
		});
		expect(resolveNavBrandCommandInput("clear --help")).toMatchObject({
			command: { id: "help" },
			query: "clear",
		});
		expect(resolveNavBrandCommandInput("cls menu")).toMatchObject({
			command: { id: "help" },
			query: "cls",
		});
		expect(resolveNavBrandCommandInput("lsa --help")).toMatchObject({
			command: { id: "help" },
			query: "lsa",
		});
		expect(buildNavBrandHelpMessage("lsa")).toContain("name            ls");
	});

	it("resolves control and contact commands with argument payloads", () => {
		expect(resolveNavBrandCommandInput("theme dark")).toMatchObject({
			command: { id: "theme", action: "toggle-pref" },
			query: "dark",
		});
		expect(resolveNavBrandCommandInput("theme amber")).toMatchObject({
			command: { id: "theme", action: "toggle-pref" },
			query: "flavor:amber",
		});
		expect(resolveNavBrandCommandInput("theme flavor crt-green")).toMatchObject({
			command: { id: "theme", action: "toggle-pref" },
			query: "flavor:crt-green",
		});
		expect(resolveNavBrandCommandInput("theme light dos")).toMatchObject({
			command: { id: "theme", action: "toggle-pref" },
			query: "light flavor:dos",
		});
		expect(resolveNavBrandCommandInput("background stars on")).toMatchObject({
			command: { id: "background", action: "toggle-pref" },
			query: "stars:on",
		});
		expect(resolveNavBrandCommandInput("bg matrix off")).toMatchObject({
			command: { id: "background", action: "toggle-pref" },
			query: "matrix:off",
		});
		expect(resolveNavBrandCommandInput("rain")).toMatchObject({
			command: { id: "background", action: "toggle-pref" },
			query: "matrix:on",
		});
		expect(resolveNavBrandCommandInput("sidebar collapse")).toMatchObject({
			command: { id: "sidebar", action: "toggle-pref" },
			query: "collapse",
		});
		expect(resolveNavBrandCommandInput("sidebar")).toMatchObject({
			command: { id: "sidebar", action: "toggle-pref" },
			query: "toggle",
		});
		expect(resolveNavBrandCommandInput("panel")).toMatchObject({
			command: { id: "sidebar", action: "toggle-pref" },
			query: "toggle",
		});
		expect(resolveNavBrandCommandInput("github")).toMatchObject({
			command: { id: "github", action: "external-link" },
		});
		expect(resolveNavBrandCommandInput("copy email")).toMatchObject({
			command: { id: "copy", action: "copy" },
			query: "email",
		});
		expect(resolveNavBrandCommandInput("copy site")).toMatchObject({
			command: { id: "copy", action: "copy" },
			query: "site",
		});
		expect(resolveNavBrandCommandInput("copy github")).toMatchObject({
			command: { id: "copy", action: "copy" },
			query: "github",
		});
	});

	it("resolves discovery commands as local message actions", () => {
		expect(resolveNavBrandCommandInput("status")).toMatchObject({
			command: { id: "status", action: "message" },
		});
		expect(resolveNavBrandCommandInput("clear")).toMatchObject({
			command: { id: "clear", action: "terminal" },
		});
		expect(resolveNavBrandCommandInput("history")).toMatchObject({
			command: { id: "history", action: "terminal" },
		});
		expect(resolveNavBrandCommandInput("neofetch")).toMatchObject({
			command: { id: "neofetch", action: "terminal" },
		});
	});

	it("returns null for empty or unknown commands", () => {
		expect(resolveNavBrandCommandInput("")).toBeNull();
		expect(resolveNavBrandCommandInput("definitely-not-a-command")).toBeNull();
		expect(resolveNavBrandCommandInput("helpx")).toBeNull();
	});
});

describe("buildNavBrandHelpMessage", () => {
	it("builds structured help from the command registry", () => {
		const help = buildNavBrandHelpMessage();
		const clear = getNavBrandCommand("clear");

		expect(help).toContain("stellar console help");
		expect(help).toContain("compact command surface for alexmbugua.me");
		expect(help).toContain("start here");
		expect(help).toContain("navigation");
		expect(help).toContain("preferences");
		expect(help).toContain("terminal");
		expect(help).toContain(`${clear.command.padEnd(36)}${clear.description}`);
		expect(help).toContain("\n\n[usage patterns]\n");
		expect(help).toContain("\n\n[start here]\n");
		expect(help.indexOf("[all commands]")).toBeGreaterThan(help.indexOf("[useful aliases]"));
		expect(help).not.toContain("Jump into the main writing archive.");
		expect(help).not.toContain("Open the projects index.");
		expect(help).not.toContain("Visit the guestbook and leave a note.");
	});

	it("lists all available canonical commands in one comma-separated section", () => {
		const help = buildNavBrandHelpMessage();
		const allCommandsLine = NAVBRAND_COMMANDS.map((command) => command.command).join(", ");

		expect(help).toContain("[all commands]");
		expect(help).toContain(allCommandsLine);
		expect(allCommandsLine).toContain("search, help, email");
		expect(allCommandsLine).toContain("clear, cmd+k, reset");
	});

	it("shows supported patterns, examples, and high-value aliases", () => {
		const help = buildNavBrandHelpMessage();

		expect(help).toContain("search <query>");
		expect(help).toContain("cd <route>");
		expect(help).toContain("theme <dark|light|toggle|flavor>");
		expect(help).toContain("background <stars|matrix> <on|off>");
		expect(help).toContain("sidebar <collapse|expand|toggle>");
		expect(help).toContain("copy <email|site|github>");
		expect(help).toContain("search astro");
		expect(help).toContain("cd blog");
		expect(help).toContain("theme dark");
		expect(help).toContain("theme amber");
		expect(help).toContain("bg matrix off");
		expect(help).toContain("clear           cls, ctrl+l, clear-host");
		expect(help).toContain("cmd+k           ⌘k, ctrl+k, ctrl+shift+k");
		expect(help).toContain("reset           reload, restart, reboot");
		expect(help).toContain("close           exit, quit, logout, :q");
		expect(help).toContain("search          find, lookup");
	});

	it("builds compact topic help by command, alias, or intent group", () => {
		expect(buildNavBrandHelpMessage("clear")).toContain("[command]");
		expect(buildNavBrandHelpMessage("clear")).toContain("name            clear");
		expect(buildNavBrandHelpMessage("clear")).toContain("aliases         cls, clr, clean, wipe, c, ctrl+l, clear-host");
		expect(buildNavBrandHelpMessage("cmd+k")).toContain("Keyboard Clear");
		expect(buildNavBrandHelpMessage("cmd+k")).toContain("Typed form of the Cmd/Ctrl+K shortcut");
		expect(buildNavBrandHelpMessage("cls")).toContain("clear");
		expect(buildNavBrandHelpMessage("search")).toContain("search <query>");
		expect(buildNavBrandHelpMessage("navigation")).toContain("navigation");
		expect(buildNavBrandHelpMessage("navigation")).toContain("cd <route>");
	});

	it("builds verbose topic help with semantic command metadata instead of raw registry shape", () => {
		const help = buildNavBrandHelpMessage("pwd", { verbose: true, argv: ["help", "pwd", "--verbose"] });

		expect(help).toContain("stellar verbose command help pwd");
		expect(help).toContain("[diagnostics]");
		expect(help).toContain("[command]");
		expect(help).toContain("name            pwd");
		expect(help).toContain("intent          navigation");
		expect(help).toContain("summary         Print the current site route.");
		expect(help).toContain("keywords        route, working directory");
		expect(help).not.toContain('id: "pwd"');
	});
});

describe("polished terminal command output helpers", () => {
	it("builds a concise structured status response from live terminal context", () => {
		const status = buildNavBrandStatusMessage({
			route: "/notes",
			theme: "dark",
			flavor: "crt-green",
			network: "online",
			reducedMotion: false,
		});

		expect(status).toContain("[status]");
		expect(status).toContain("presence        online");
		expect(status).toContain("route           /notes");
		expect(status).toContain("theme           dark / crt-green");
		expect(status).toContain("network         online");
		expect(status).toContain("motion          full");
		expect(status).toContain(`commands        ${NAVBRAND_COMMANDS.length} registered`);
	});

	it("builds verbose status output with diagnostic framing and expanded context", () => {
		const status = buildNavBrandStatusMessage(
			{
				route: "/about",
				theme: "dark",
				flavor: "crt-green",
				network: "online",
				reducedMotion: false,
				platform: "macOS",
				timezone: "Africa/Nairobi",
				viewport: "1680×1050",
				language: "en-US",
			},
			{ verbose: true, argv: ["status", "--verbose"] }
		);

		expect(status).toContain("stellar verbose command status");
		expect(status).toContain('stellar verbose argv "status" "--verbose"');
		expect(status).toContain("[status]");
		expect(status).toContain("platform        macOS");
		expect(status).toContain("timezone        Africa/Nairobi");
		expect(status).toContain("viewport        1680×1050");
		expect(status).toContain("language        en-US");
		expect(status).toContain("stellar verbose exit 0");
		expect(status).toContain("stellar info ok");
	});

	it("builds history output with a stable empty state and numbered command memory", () => {
		expect(buildNavBrandHistoryMessage([])).toBe("[history]\nsession memory empty");
		expect(buildNavBrandHistoryMessage(["help", "theme dark", "cd blog"])).toBe(
			"[history]\n3 commands in session memory\n1. help\n2. theme dark\n3. cd blog"
		);
		expect(buildNavBrandHistoryMessage(["help"], { verbose: true, argv: ["history", "--verbose"] })).toContain(
			"recall          ArrowUp / ArrowDown cycles history"
		);
	});

	it("builds unknown-command output with useful suggestions instead of a dead end", () => {
		const message = buildNavBrandUnknownCommandMessage("hlep");

		expect(message).toContain("[unknown]");
		expect(message).toContain("input           hlep");
		expect(message).toContain("did you mean    help");
		expect(message).toContain("try             help · ls · search <query>");
	});

	it("keeps route listing readable with a heading and command hint", () => {
		const routeList = buildNavBrandRouteListMessage();

		expect(routeList).toContain("[routes]");
		expect(routeList).toContain("open with       cd <route>");
		expect(routeList).toContain("blog            /blog");
		expect(routeList).toContain("guestbook       /guestbook");
		expect(buildNavBrandRouteListMessage({ verbose: true, argv: ["ls", "--verbose"] })).toContain(
			"source          src/data/navigation.ts + redirect aliases"
		);
	});
});

describe("resolveNavBrandCommandSuggestion", () => {
	it("marks empty prompt state without a suggestion", () => {
		expect(resolveNavBrandCommandSuggestion("")).toEqual({
			state: "empty",
			completion: "",
		});
	});

	it("suggests command and route completions for valid partial input", () => {
		expect(resolveNavBrandCommandSuggestion("sea")).toEqual({
			state: "partial",
			completion: "rch",
		});
		expect(resolveNavBrandCommandSuggestion("cd b")).toEqual({
			state: "partial",
			completion: "log",
		});
		expect(resolveNavBrandCommandSuggestion("cd n")).toEqual({
			state: "partial",
			completion: "otebook",
		});
		expect(resolveNavBrandCommandSuggestion("cd guest b")).toEqual({
			state: "partial",
			completion: "ook",
		});
		expect(resolveNavBrandCommandSuggestion("cd guest bo")).toEqual({
			state: "partial",
			completion: "ok",
		});
		expect(resolveNavBrandCommandSuggestion("theme d")).toEqual({
			state: "partial",
			completion: "ark",
		});
		expect(resolveNavBrandCommandSuggestion("theme a")).toEqual({
			state: "partial",
			completion: "mber",
		});
		expect(resolveNavBrandCommandSuggestion("theme light dos")).toEqual({
			state: "known",
			completion: "",
		});
		expect(resolveNavBrandCommandSuggestion("theme light d")).toEqual({
			state: "partial",
			completion: "os",
		});
		expect(resolveNavBrandCommandSuggestion("bg m")).toEqual({
			state: "partial",
			completion: "atrix on",
		});
		expect(resolveNavBrandCommandSuggestion("sidebar c")).toEqual({
			state: "partial",
			completion: "ollapse",
		});
		expect(resolveNavBrandCommandSuggestion("cmd+")).toEqual({
			state: "partial",
			completion: "k",
		});
		expect(resolveNavBrandCommandSuggestion("copy e")).toEqual({
			state: "partial",
			completion: "mail",
		});
		expect(resolveNavBrandCommandSuggestion("lsa")).toEqual({
			state: "known",
			completion: "",
		});
	});

	it("keeps supported dynamic patterns known once they have required arguments", () => {
		expect(resolveNavBrandCommandSuggestion("search astro")).toEqual({
			state: "known",
			completion: "",
		});
		expect(resolveNavBrandCommandSuggestion("find auth0")).toEqual({
			state: "known",
			completion: "",
		});
		expect(resolveNavBrandCommandSuggestion("background --help")).toEqual({
			state: "known",
			completion: "",
		});
		expect(resolveNavBrandCommandSuggestion("whoami -v")).toEqual({
			state: "known",
			completion: "",
		});
		expect(resolveNavBrandCommandSuggestion("status --verbose")).toEqual({
			state: "known",
			completion: "",
		});
	});

	it("marks exact commands and aliases known", () => {
		expect(resolveNavBrandCommandSuggestion("clear")).toEqual({
			state: "known",
			completion: "",
		});
		expect(resolveNavBrandCommandSuggestion("cls")).toEqual({
			state: "known",
			completion: "",
		});
	});

	it("only marks input unknown when no supported command can continue from it", () => {
		expect(resolveNavBrandCommandSuggestion("zz")).toEqual({
			state: "unknown",
			completion: "",
		});
		expect(resolveNavBrandCommandSuggestion("theme z")).toEqual({
			state: "unknown",
			completion: "",
		});
	});
});

describe("resolveNavBrandCommandCompletions", () => {
	it("returns all matching completions for the current input", () => {
		const result = resolveNavBrandCommandCompletions("h");

		expect(result.state).toBe("partial");
		expect(result.items.map((item) => item.value)).toEqual(
			expect.arrayContaining(["help", "history", "hide", "hiragana"])
		);
	});

	it("ranks canonical commands before aliases and keyword-only matches", () => {
		const values = resolveNavBrandCommandCompletions("c").items.map((item) => item.value);

		expect(values.indexOf("copy")).toBeLessThan(values.indexOf("clip"));
		expect(values.indexOf("clear")).toBeLessThan(values.indexOf("clean"));
		expect(values.indexOf("close")).toBeLessThan(values.indexOf("close terminal"));
		expect(values.indexOf("copy")).toBeLessThan(values.indexOf("contact"));
	});

	it("keeps command-family patterns ahead of aliases once a command prefix is established", () => {
		expect(resolveNavBrandCommandCompletions("copy ").items.map((item) => item.value)).toEqual([
			"copy email",
			"copy site",
			"copy github",
		]);
	});

	it("keeps trailing-space patterns available for tab completion", () => {
		const result = resolveNavBrandCommandCompletions("theme ");

		expect(result.state).toBe("partial");
		expect(result.items.map((item) => item.value)).toEqual([
			"theme dark",
			"theme light",
			"theme toggle",
			"theme default",
			"theme crt-green",
			"theme amber",
			"theme synthwave",
			"theme dos",
			"theme void",
			"theme ice",
			"theme redline",
			"theme flavor default",
			"theme flavor crt-green",
			"theme flavor amber",
			"theme flavor synthwave",
			"theme flavor dos",
			"theme flavor void",
			"theme flavor ice",
			"theme flavor redline",
			"theme dark crt-green",
			"theme dark amber",
			"theme dark synthwave",
			"theme dark dos",
			"theme dark void",
			"theme dark ice",
			"theme dark redline",
			"theme dark default",
			"theme light crt-green",
			"theme light amber",
			"theme light synthwave",
			"theme light dos",
			"theme light void",
			"theme light ice",
			"theme light redline",
			"theme light default",
		]);
	});

	it("returns route completions for shell-style navigation", () => {
		expect(resolveNavBrandCommandCompletions("cd b").items).toEqual([
			{
				value: "cd blog",
				completion: "log",
			},
		]);
		expect(resolveNavBrandCommandCompletions("cd guest bo").items).toEqual([
			{
				value: "cd guest book",
				completion: "ok",
			},
		]);
	});

	it("suggests postfix help without flagging chained commands as unavailable", () => {
		expect(resolveNavBrandCommandCompletions("background --").items).toEqual([
			{
				value: "background --help",
				completion: "help",
			},
		]);
		expect(resolveNavBrandCommandCompletions("background --help")).toEqual({
			state: "known",
			items: [],
		});
	});

	it("suggests command flags after complete commands", () => {
		expect(resolveNavBrandCommandCompletions("whoami ").items).toEqual(
			expect.arrayContaining([
				{
					value: "whoami --help",
					completion: "--help",
				},
				{
					value: "whoami --verbose",
					completion: "--verbose",
				},
				{
					value: "whoami -v",
					completion: "-v",
				},
			])
		);
		expect(resolveNavBrandCommandCompletions("whoami -").items.map((item) => item.value)).toEqual(
			expect.arrayContaining(["whoami -h", "whoami --help", "whoami -v", "whoami --verbose"])
		);
		expect(resolveNavBrandCommandCompletions("whoami -v")).toEqual({
			state: "known",
			items: [],
		});
		expect(resolveNavBrandCommandSuggestion("clear -v")).toEqual({
			state: "unknown",
			completion: "",
		});
		expect(resolveNavBrandCommandCompletions("clear -").items.map((item) => item.value)).toEqual(
			expect.arrayContaining(["clear -h", "clear --help"])
		);
		expect(resolveNavBrandCommandCompletions("clear -").items.map((item) => item.value)).not.toContain("clear -v");
	});

	it("returns no items for truly unknown input", () => {
		expect(resolveNavBrandCommandCompletions("zz")).toEqual({
			state: "unknown",
			items: [],
		});
	});
});

describe("targeted command help", () => {
	it("shows aliases, keywords, examples, and accepted patterns for command topics", () => {
		const help = buildNavBrandHelpMessage("background");

		expect(help).toContain("[command]");
		expect(help).toContain("name            background");
		expect(help).toContain("usage           background <stars|matrix> <on|off>");
		expect(help).toContain("aliases         bg, stars, matrix, stars on, stars off, matrix on, matrix off");
		expect(help).toContain("keywords        rain, hiragana, space");
		expect(help).toContain(
			"accepted input  background, bg, stars, matrix, stars on, stars off, matrix on, matrix off, rain, hiragana, space"
		);
		expect(help).toContain("examples        bg matrix off");
	});

	it("resolves keyword topics back to their owning command help", () => {
		const help = buildNavBrandHelpMessage("hiragana");

		expect(help).toContain("[command]");
		expect(help).toContain("name            background");
		expect(help).toContain("keywords        rain, hiragana, space");
	});
});

describe("buildNavBrandIdentityMessage", () => {
	it("builds verbose identity output with site config social and contact information", () => {
		const identity = buildNavBrandIdentityMessage({ verbose: true, argv: ["whoami", "--verbose"] });

		expect(identity).toContain("stellar verbose command whoami");
		expect(identity).toContain("[identity]");
		expect(identity).toContain(SITE.author);
		expect(identity).toContain(PROFESSIONAL.jobTitle);
		expect(identity).toContain(SOCIAL.email);
		expect(identity).toContain("profiles        ");
		expect(identity).toContain("GitHub                https://github.com/asce1062");
		expect(identity).toContain("LinkedIn              https://www.linkedin.com/in/alex-mbugua");
		expect(identity).toContain("stellar info ok");
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

	it("builds copy intents for stable contact values", () => {
		expect(buildNavBrandCommandIntent(resolveNavBrandCommandInput("copy email")!)).toEqual({
			type: "copy",
			label: "email",
			value: SOCIAL.email,
		});
		expect(buildNavBrandCommandIntent(resolveNavBrandCommandInput("copy site")!)).toEqual({
			type: "copy",
			label: "site",
			value: SITE.url,
		});
		expect(buildNavBrandCommandIntent(resolveNavBrandCommandInput("copy github")!)).toEqual({
			type: "copy",
			label: "github",
			value: "https://github.com/asce1062",
		});
	});

	it("builds toggle intents for control commands", () => {
		expect(buildNavBrandCommandIntent(resolveNavBrandCommandInput("theme dark")!)).toMatchObject({
			type: "toggle-pref",
			target: "theme",
			value: "dark",
		});
		expect(buildNavBrandCommandIntent(resolveNavBrandCommandInput("theme amber")!)).toMatchObject({
			type: "toggle-pref",
			target: "flavor",
			value: "amber",
		});
		expect(buildNavBrandCommandIntent(resolveNavBrandCommandInput("theme light dos")!)).toMatchObject({
			type: "batch",
			intents: [
				{ type: "toggle-pref", target: "theme", value: "light" },
				{ type: "toggle-pref", target: "flavor", value: "dos" },
			],
		});
		expect(buildNavBrandCommandIntent(resolveNavBrandCommandInput("background stars on")!)).toMatchObject({
			type: "toggle-pref",
			target: "stars-background-toggle",
			value: true,
		});
		expect(buildNavBrandCommandIntent(resolveNavBrandCommandInput("bg matrix off")!)).toMatchObject({
			type: "toggle-pref",
			target: "matrix-background-toggle",
			value: false,
		});
		expect(buildNavBrandCommandIntent(resolveNavBrandCommandInput("sidebar collapse")!)).toMatchObject({
			type: "toggle-pref",
			target: "sidebar-collapse",
			value: "collapse",
		});
		expect(buildNavBrandCommandIntent(resolveNavBrandCommandInput("sidebar")!)).toMatchObject({
			type: "toggle-pref",
			target: "sidebar-collapse",
			value: "toggle",
		});
	});

	it("builds message intents for local discovery commands", () => {
		expect(buildNavBrandCommandIntent(resolveNavBrandCommandInput("status")!)).toMatchObject({
			type: "show-status",
		});
	});

	it("builds terminal-local intents for history controls", () => {
		expect(buildNavBrandCommandIntent(resolveNavBrandCommandInput("clear")!)).toEqual({
			type: "clear-viewport",
		});
		expect(buildNavBrandCommandIntent(resolveNavBrandCommandInput("cmd+k")!)).toEqual({
			type: "clear-history",
		});
		expect(buildNavBrandCommandIntent(resolveNavBrandCommandInput("reset")!)).toEqual({
			type: "reset-terminal",
		});
		expect(buildNavBrandCommandIntent(resolveNavBrandCommandInput("history")!)).toEqual({
			type: "show-history",
		});
		expect(buildNavBrandCommandIntent(resolveNavBrandCommandInput("neofetch")!)).toEqual({
			type: "show-system-profile",
		});
	});
});
