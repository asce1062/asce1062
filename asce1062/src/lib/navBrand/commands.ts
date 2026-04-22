import { PROFESSIONAL, SITE, SOCIAL } from "@/config/site-config";
import { mainNavigation } from "@/data/navigation";

/**
 * Navbrand interaction-layer command catalog.
 *
 * Terminal surface is a compact terminal-like command environment,
 * not just another website nav menu. Commands normalize many aliases into a
 * small set of intents: lifecycle controls, system/profile output, identity,
 * shell-style route navigation, preference toggles, and search handoff.
 *
 * The dedicated `/search` page and floating Pagefind modal remain the site's
 * indexed-content retrieval surfaces. Terminal search commands should hand off
 * to those surfaces instead of growing a redundant local search implementation.
 *
 * Keep additions centralized here so the Sidebar command row, tests, and later
 * typed/fuzzy command slices can share one registry instead of drifting into
 * duplicated labels, routes, or search behavior.
 */
export type NavBrandCommandAction =
	| "search-handoff"
	| "navigate"
	| "hint"
	| "toggle-pref"
	| "external-link"
	| "copy"
	| "message"
	| "terminal";
export type NavBrandCommandIntentGroup =
	| "search"
	| "navigation"
	| "external"
	| "copy"
	| "toggle"
	| "help"
	| "identity"
	| "status"
	| "clear"
	| "clear-history"
	| "reset"
	| "minimize"
	| "close"
	| "history"
	| "system-profile";
export type NavBrandCommandId =
	| "search"
	| "help"
	| "email"
	| "github"
	| "copy"
	| "theme"
	| "background"
	| "sidebar"
	| "status"
	| "clear"
	| "clear-history"
	| "reset"
	| "minimize"
	| "close"
	| "history"
	| "neofetch"
	| "identity"
	| "pwd"
	| "list"
	| "open";

export type NavBrandCommandDefinition = {
	id: NavBrandCommandId;
	command: string;
	label: string;
	description: string;
	hint: string;
	action: NavBrandCommandAction;
	intent: NavBrandCommandIntentGroup;
	aliases?: readonly string[];
	keywords?: readonly string[];
	href?: string;
};

export type ResolvedNavBrandCommand = {
	command: NavBrandCommandDefinition;
	query: string | null;
	verbose: boolean;
	argv: string[];
};

export type NavBrandCommandSuggestion = {
	state: "empty" | "known" | "partial" | "unknown";
	completion: string;
};
export type NavBrandCommandCompletion = {
	value: string;
	completion: string;
};
export type NavBrandCommandCompletionResult = {
	state: NavBrandCommandSuggestion["state"];
	items: NavBrandCommandCompletion[];
};

export type NavBrandCommandIntent =
	| { type: "navigate"; href: string }
	| { type: "search-handoff"; query: string | null }
	| { type: "external-link"; href: string }
	| { type: "copy"; label: string; value: string }
	| { type: "toggle-pref"; target: string; value: string | boolean }
	| { type: "batch"; intents: readonly NavBrandCommandIntent[] }
	| { type: "message"; message: string }
	| { type: "show-status" }
	| { type: "clear-viewport" }
	| { type: "clear-history" }
	| { type: "reset-terminal" }
	| { type: "minimize-terminal" }
	| { type: "close-terminal" }
	| { type: "show-history" }
	| { type: "show-system-profile" }
	| { type: "show-working-route" }
	| { type: "list-routes" };

export const NAVBRAND_COMMANDS: readonly NavBrandCommandDefinition[] = [
	{
		id: "search",
		command: "search",
		label: "Search",
		description: "Hand off to the real Pagefind search surface: floating search when available, otherwise /search.",
		hint: "type / to search",
		action: "search-handoff",
		intent: "search",
		aliases: ["find", "lookup", "open search"],
		keywords: ["pagefind", "search"],
	},
	{
		id: "help",
		command: "help",
		label: "Help",
		description: "Reveal the terminal command language and common aliases.",
		hint: "show commands",
		action: "hint",
		intent: "help",
		aliases: ["?", "man", "commands", "menu", "--help", "-h", "explore"],
		keywords: ["help", "discover"],
	},
	{
		id: "email",
		command: "email",
		label: "Email",
		description: "Open a mailto link to Alex's primary email address.",
		hint: "open mail client",
		action: "external-link",
		intent: "external",
		aliases: ["contact", "mail"],
		keywords: ["reach", "write"],
		href: `mailto:${SOCIAL.email}`,
	},
	{
		id: "github",
		command: "github",
		label: "GitHub",
		description: "Open Alex's GitHub profile.",
		hint: "open github profile",
		action: "external-link",
		intent: "external",
		aliases: ["gh", "code profile"],
		keywords: ["repo", "profile"],
		href: SOCIAL.profiles.find((profile) => profile.name === "GitHub")?.url,
	},
	{
		id: "copy",
		command: "copy",
		label: "Copy",
		description: "Copy stable contact/site values to the clipboard.",
		hint: "try: copy email",
		action: "copy",
		intent: "copy",
		aliases: ["clip", "clipboard", "pbcopy"],
		keywords: ["email", "site", "url", "github", "contact"],
	},
	{
		id: "theme",
		command: "theme",
		label: "Theme",
		description: "Switch light/dark theme, toggle it, or change the color flavor.",
		hint: "try: theme dark",
		action: "toggle-pref",
		intent: "toggle",
		aliases: ["light", "dark"],
		keywords: ["mode", "appearance", "flavor", "crt-green", "amber", "synthwave", "dos", "void", "ice", "redline"],
	},
	{
		id: "background",
		command: "background",
		label: "Background",
		description: "Control the stars and matrix background flourishes.",
		hint: "try: bg matrix on",
		action: "toggle-pref",
		intent: "toggle",
		aliases: ["bg", "stars", "matrix", "stars on", "stars off", "matrix on", "matrix off"],
		keywords: ["rain", "hiragana", "space"],
	},
	{
		id: "sidebar",
		command: "sidebar",
		label: "Sidebar",
		description: "Toggle, collapse, or expand the desktop sidebar.",
		hint: "try: sidebar collapse",
		action: "toggle-pref",
		intent: "toggle",
		aliases: ["sidebar collapse", "sidebar expand", "collapse sidebar", "expand sidebar"],
		keywords: ["rail", "panel"],
	},
	{
		id: "status",
		command: "status",
		label: "Status",
		description: "Show a local terminal-style status response.",
		hint: "presence engine online",
		action: "message",
		intent: "status",
		aliases: ["signal"],
		keywords: ["system", "presence"],
	},
	{
		id: "clear",
		command: "clear",
		label: "Clear",
		description: "Push visible terminal history out of sight while keeping the session alive.",
		hint: "clear visible history",
		action: "terminal",
		intent: "clear",
		aliases: ["cls", "clr", "clean", "wipe", "c", "ctrl+l", "clear-host"],
		keywords: ["viewport"],
	},
	{
		id: "clear-history",
		command: "cmd+k",
		label: "Keyboard Clear",
		description: "Typed form of the Cmd/Ctrl+K shortcut; clears the terminal session log.",
		hint: "mirror keyboard clear",
		action: "terminal",
		intent: "clear-history",
		aliases: ["⌘k", "ctrl+k", "ctrl+shift+k"],
		keywords: ["history clear", "hard clear"],
	},
	{
		id: "reset",
		command: "reset",
		label: "Reset",
		description: "Reinitialize the terminal session and replay the boot profile.",
		hint: "reboot local terminal",
		action: "terminal",
		intent: "reset",
		aliases: ["reload", "restart", "reboot", "reinit", "refresh", "fix", "powercycle", "reconnect"],
		keywords: ["restore", "initialize"],
	},
	{
		id: "minimize",
		command: "minimize",
		label: "Minimize",
		description: "Hide the terminal into its dock tab without destroying the session.",
		hint: "hide terminal",
		action: "terminal",
		intent: "minimize",
		aliases: ["hide"],
		keywords: ["dock", "background"],
	},
	{
		id: "close",
		command: "close",
		label: "Close",
		description: "Close and destroy the current terminal session.",
		hint: "close terminal",
		action: "terminal",
		intent: "close",
		aliases: ["close terminal", "exit", "quit", "quit()", "logout", "bye", "q", ":q"],
		keywords: ["destroy", "end session"],
	},
	{
		id: "history",
		command: "history",
		label: "History",
		description: "Show commands used during the current terminal session.",
		hint: "show session history",
		action: "terminal",
		intent: "history",
		aliases: ["recent", "log"],
		keywords: ["commands", "session"],
	},
	{
		id: "neofetch",
		command: "neofetch",
		label: "Neofetch",
		description: "Print the terminal's local system profile with ASCII art.",
		hint: "show local system profile",
		action: "terminal",
		intent: "system-profile",
		aliases: ["fetch", "sysinfo"],
		keywords: ["system", "profile", "ascii"],
	},
	{
		id: "identity",
		command: "whoami",
		label: "Identity",
		description: "Print Alex's local identity line.",
		hint: "whoami",
		action: "message",
		intent: "identity",
		aliases: ["whois"],
		keywords: ["alex", "asce1062", "identity"],
	},
	{
		id: "pwd",
		command: "pwd",
		label: "PWD",
		description: "Print the current site route.",
		hint: "pwd",
		action: "terminal",
		intent: "navigation",
		keywords: ["route", "working directory"],
	},
	{
		id: "list",
		command: "ls",
		label: "List",
		description: "List the main site routes available from the terminal.",
		hint: "ls",
		action: "terminal",
		intent: "navigation",
		aliases: ["dir", "tree", "lsa", "la", "ll", "ls -a"],
		keywords: ["routes", "directory"],
	},
	{
		id: "open",
		command: "cd",
		label: "Open",
		description: "Open a known route using shell-style navigation.",
		hint: "cd blog",
		action: "terminal",
		intent: "navigation",
		aliases: ["open", "start", "xdg-open", "invoke-item", "ii"],
		keywords: ["navigate", "route"],
	},
] as const;

export const NAVBRAND_HINT_COMMAND_IDS: readonly NavBrandCommandId[] = ["search", "open", "help"];

export type NavBrandStatusContext = {
	route?: string;
	theme?: string;
	flavor?: string;
	network?: "online" | "offline" | string;
	reducedMotion?: boolean;
	platform?: string;
	timezone?: string;
	viewport?: string;
	language?: string;
};
export type NavBrandVerboseOptions = {
	verbose?: boolean;
	argv?: readonly string[];
};

type RandomSource = () => number;
type HelpSectionId = "start" | "navigation" | "search" | "preferences" | "terminal" | "identity" | "external";
type SuggestionPhraseEntry = {
	phrase: string;
	priority: number;
	order: number;
};

const HELP_COMMAND_WIDTH = 36;

const HELP_SECTION_TITLES: Record<HelpSectionId, string> = {
	start: "start here",
	navigation: "navigation",
	search: "search",
	preferences: "preferences",
	terminal: "terminal",
	identity: "identity / system",
	external: "external",
};

const HELP_SECTION_BY_INTENT: Record<NavBrandCommandIntentGroup, HelpSectionId> = {
	help: "start",
	status: "start",
	identity: "identity",
	"system-profile": "identity",
	navigation: "navigation",
	search: "search",
	toggle: "preferences",
	copy: "external",
	clear: "terminal",
	"clear-history": "terminal",
	reset: "terminal",
	minimize: "terminal",
	close: "terminal",
	history: "terminal",
	external: "external",
};

const HELP_SECTION_ORDER: readonly HelpSectionId[] = [
	"start",
	"navigation",
	"search",
	"preferences",
	"terminal",
	"identity",
	"external",
];

const HELP_COMMAND_PATTERNS: Partial<Record<NavBrandCommandId, string>> = {
	search: "search <query>",
	theme: "theme <dark|light|toggle|flavor>",
	background: "background <stars|matrix> <on|off>",
	sidebar: "sidebar <collapse|expand|toggle>",
	copy: "copy <email|site|github>",
	open: "cd <route>",
};

const HELP_COMMAND_EXAMPLES: Partial<Record<NavBrandCommandId, readonly string[]>> = {
	search: ["search astro", "find pagefind"],
	theme: ["theme dark", "theme amber"],
	background: ["bg matrix off", "background stars on"],
	sidebar: ["sidebar collapse", "sidebar"],
	copy: ["copy email", "copy site"],
	clear: ["clear"],
	"clear-history": ["cmd+k"],
	reset: ["reset"],
	open: ["cd blog", "open projects"],
};

const HELP_FEATURED_ALIASES: Partial<Record<NavBrandCommandId, readonly string[]>> = {
	search: ["find", "lookup"],
	clear: ["cls", "ctrl+l", "clear-host"],
	"clear-history": ["⌘k", "ctrl+k", "ctrl+shift+k"],
	reset: ["reload", "restart", "reboot"],
	close: ["exit", "quit", "logout", ":q"],
	copy: ["clip", "pbcopy"],
};

export function getNavBrandCommand(commandId: NavBrandCommandId): NavBrandCommandDefinition {
	const command = NAVBRAND_COMMANDS.find(({ id }) => id === commandId);
	if (!command) {
		throw new Error(`Unknown navbrand command: ${commandId}`);
	}
	return command;
}

function normalizeCommandInput(input: string): string {
	return input.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeCompletionInput(input: string): string {
	return input.toLowerCase().replace(/\s+/g, " ").trimStart();
}

const VERBOSE_TERMS = new Set(["--verbose", "-v", "verbose", "details", "more"]);

function parseVerboseInput(input: string): { normalizedInput: string; verbose: boolean; argv: string[] } {
	const argv = input.trim().split(/\s+/).filter(Boolean);
	const keptArgs = argv.filter((arg) => !VERBOSE_TERMS.has(arg.toLowerCase()));
	return {
		normalizedInput: normalizeCommandInput(keptArgs.join(" ")),
		verbose: keptArgs.length !== argv.length,
		argv,
	};
}

function getCommandTerms(command: NavBrandCommandDefinition): string[] {
	return [command.command, ...(command.aliases ?? []), ...(command.keywords ?? [])];
}

function getCommandCompletionTerms(command: NavBrandCommandDefinition): string[] {
	return getCommandTerms(command);
}

function getHelpUsage(command: NavBrandCommandDefinition): string {
	return HELP_COMMAND_PATTERNS[command.id] ?? command.command;
}

function formatArgv(argv?: readonly string[]): string {
	return (argv && argv.length > 0 ? argv : []).map((arg) => `"${arg}"`).join(" ");
}

function wrapVerboseOutput(command: string, body: string, options: NavBrandVerboseOptions = {}): string {
	if (!options.verbose) return body;

	const argvLine = options.argv?.length ? [`stellar verbose argv ${formatArgv(options.argv)}`] : [];
	return [
		"[diagnostics]",
		`stellar verbose command ${command}`,
		"stellar info using alexmbugua.me terminal@asce1062",
		...argvLine,
		body,
		"stellar verbose exit 0",
		"stellar info ok",
	].join("\n");
}

function formatOutputRow(label: string, value: string, width = 16): string {
	return `${label.padEnd(width)}${value}`;
}

function formatOutputList(label: string, values: readonly string[], separator = ", "): string {
	return formatOutputRow(label, values.length > 0 ? values.join(separator) : "none");
}

function formatCommandLine(command: NavBrandCommandDefinition): string {
	return formatOutputRow(getHelpUsage(command), command.description, HELP_COMMAND_WIDTH);
}

function getCommandsForSection(sectionId: HelpSectionId): NavBrandCommandDefinition[] {
	return NAVBRAND_COMMANDS.filter((command) => HELP_SECTION_BY_INTENT[command.intent] === sectionId);
}

function buildHelpSections(): string[] {
	return HELP_SECTION_ORDER.flatMap((sectionId) => {
		const commands = getCommandsForSection(sectionId);
		if (commands.length === 0) return [];

		return [`[${HELP_SECTION_TITLES[sectionId]}]`, ...commands.map(formatCommandLine)];
	});
}

function buildHelpPatterns(): string[] {
	return Object.entries(HELP_COMMAND_PATTERNS).map(([commandId, pattern]) => {
		const command = getNavBrandCommand(commandId as NavBrandCommandId);
		return formatOutputRow(pattern, command.description, HELP_COMMAND_WIDTH);
	});
}

function buildHelpExamples(): string {
	const examples = ["search astro", "cd blog", "theme dark", "theme amber", "bg matrix off", "clear", "reset"];
	return examples.join(" · ");
}

function buildAllCommandsLine(): string {
	return NAVBRAND_COMMANDS.map((command) => command.command).join(", ");
}

function buildFeaturedAliases(): string[] {
	return Object.entries(HELP_FEATURED_ALIASES).map(([commandId, aliases]) => {
		const command = getNavBrandCommand(commandId as NavBrandCommandId);
		return formatOutputList(command.command, aliases);
	});
}

function resolveHelpTopic(topic: string): NavBrandCommandDefinition | NavBrandCommandIntentGroup | null {
	const normalizedTopic = normalizeCommandInput(topic);
	if (!normalizedTopic) return null;

	const command = NAVBRAND_COMMANDS.find((candidate) => {
		return (
			candidate.id === normalizedTopic ||
			getCommandTerms(candidate).some((term) => normalizeCommandInput(term) === normalizedTopic)
		);
	});
	if (command) return command;

	const matchingIntent = Object.keys(HELP_SECTION_BY_INTENT).find((intent) => intent === normalizedTopic);
	if (matchingIntent) return matchingIntent as NavBrandCommandIntentGroup;

	const matchingSection = Object.entries(HELP_SECTION_TITLES).find(
		([, title]) => normalizeCommandInput(title) === normalizedTopic
	);
	if (matchingSection) {
		const [sectionId] = matchingSection;
		const command = getCommandsForSection(sectionId as HelpSectionId)[0];
		return command?.intent ?? null;
	}

	return null;
}

function buildVerboseCommandTopicHelp(
	command: NavBrandCommandDefinition,
	options: NavBrandVerboseOptions = {}
): string {
	const body = [
		"[command]",
		formatOutputRow("name", command.command),
		formatOutputRow("label", command.label),
		formatOutputRow("intent", command.intent),
		formatOutputRow("action", command.action),
		formatOutputRow("usage", getHelpUsage(command)),
		formatOutputRow("summary", command.description),
		formatOutputRow("aliases", command.aliases?.join(", ") ?? "none"),
		formatOutputRow("keywords", command.keywords?.join(", ") ?? "none"),
	].join("\n");

	return wrapVerboseOutput(`help ${command.command}`, body, options);
}

function buildCommandTopicHelp(command: NavBrandCommandDefinition, options: NavBrandVerboseOptions = {}): string {
	if (options.verbose) {
		return buildVerboseCommandTopicHelp(command, options);
	}

	const lines = [
		"[command]",
		formatOutputRow("name", command.command),
		formatOutputRow("label", command.label),
		formatOutputRow("intent", command.intent),
		formatOutputRow("action", command.action),
		formatOutputRow("usage", getHelpUsage(command)),
		formatOutputRow("summary", command.description),
	];
	if (command.aliases?.length) {
		lines.push(formatOutputList("aliases", command.aliases));
	}
	if (command.keywords?.length) {
		lines.push(formatOutputList("keywords", command.keywords));
	}
	lines.push(formatOutputList("accepted input", getCommandTerms(command)));
	const examples = HELP_COMMAND_EXAMPLES[command.id];
	if (examples?.length) {
		lines.push(formatOutputList("examples", examples, " · "));
	}
	return lines.join("\n");
}

function buildIntentTopicHelp(intent: NavBrandCommandIntentGroup, options: NavBrandVerboseOptions = {}): string {
	const section = HELP_SECTION_BY_INTENT[intent];
	const commands = NAVBRAND_COMMANDS.filter((command) => command.intent === intent);
	const sectionCommands = section ? getCommandsForSection(section) : commands;
	const commandLines = (sectionCommands.length > 0 ? sectionCommands : commands).map(formatCommandLine);
	const patternLines = (sectionCommands.length > 0 ? sectionCommands : commands)
		.filter((command) => HELP_COMMAND_PATTERNS[command.id])
		.map((command) => formatOutputRow("pattern", HELP_COMMAND_PATTERNS[command.id]!));

	const body = [`[${HELP_SECTION_TITLES[section] ?? intent}]`, ...commandLines, ...patternLines].join("\n");
	return wrapVerboseOutput(`help ${intent}`, body, options);
}

export function buildNavBrandHelpMessage(topic?: string | null, options: NavBrandVerboseOptions = {}): string {
	if (topic) {
		const resolvedTopic = resolveHelpTopic(topic);
		if (!resolvedTopic) {
			return `help: ${topic}\nunknown topic · try: help, help navigation, help clear, help search`;
		}
		return typeof resolvedTopic === "string"
			? buildIntentTopicHelp(resolvedTopic, options)
			: buildCommandTopicHelp(resolvedTopic, options);
	}

	const body = [
		"stellar console help",
		"compact command surface for alexmbugua.me · navigation, preferences, system notes, and search handoff",
		"",
		"[usage patterns]",
		...buildHelpPatterns(),
		"",
		...buildHelpSections(),
		"",
		"[examples]",
		formatOutputRow("try", buildHelpExamples()),
		"",
		"[useful aliases]",
		...buildFeaturedAliases(),
		"",
		"[all commands]",
		formatOutputRow("registered", buildAllCommandsLine()),
		"",
		formatOutputRow("topic help", "clear help · search help · navigation help"),
	].join("\n");

	return wrapVerboseOutput("help", body, options);
}

export function buildNavBrandIdentityMessage(options: NavBrandVerboseOptions = {}): string {
	const body = [
		`${SITE.author} // ${SOCIAL.github}`,
		`site: ${new URL(SITE.url).hostname}`,
		`brand: ${SITE.title}`,
		`signal: ${SITE.titleSuffix}`,
		`role: ${PROFESSIONAL.jobTitle}`,
		`field: ${SITE.description}`,
		`contact: ${SOCIAL.email}`,
	];

	if (options.verbose) {
		body.push(
			"[identity]",
			formatOutputRow("canonical", SITE.url),
			formatOutputRow("repo", SOCIAL.repo),
			formatOutputRow("profiles", String(SOCIAL.profiles.length)),
			...SOCIAL.profiles.map((profile) => formatOutputRow(profile.name, profile.url, 22))
		);
	}

	return wrapVerboseOutput("whoami", body.join("\n"), options);
}

export function buildNavBrandStatusMessage(
	context: NavBrandStatusContext = {},
	options: NavBrandVerboseOptions = {}
): string {
	const route = context.route ?? "/";
	const theme = context.theme ?? "unknown";
	const flavor = context.flavor && context.flavor !== "default" ? context.flavor : "default";
	const network = context.network ?? "unknown";
	const motion = context.reducedMotion ? "reduced" : "full";

	const body = [
		"[status]",
		formatOutputRow("presence", "online"),
		formatOutputRow("route", route),
		formatOutputRow("theme", `${theme} / ${flavor}`),
		formatOutputRow("network", network),
		formatOutputRow("motion", motion),
		formatOutputRow("commands", `${NAVBRAND_COMMANDS.length} registered`),
	];

	if (options.verbose) {
		body.push(
			formatOutputRow("platform", context.platform ?? "unknown"),
			formatOutputRow("timezone", context.timezone ?? "unknown"),
			formatOutputRow("viewport", context.viewport ?? "unknown"),
			formatOutputRow("language", context.language ?? "unknown")
		);
	}

	return wrapVerboseOutput("status", body.join("\n"), options);
}

export function buildNavBrandHistoryMessage(history: readonly string[], options: NavBrandVerboseOptions = {}): string {
	if (history.length === 0) {
		return wrapVerboseOutput("history", "[history]\nsession memory empty", options);
	}

	const body = [
		"[history]",
		`${history.length} ${history.length === 1 ? "command" : "commands"} in session memory`,
		...history.map((command, index) => `${index + 1}. ${command}`),
	];

	if (options.verbose) {
		body.push(
			formatOutputRow("recall", "ArrowUp / ArrowDown cycles history"),
			formatOutputRow("filter", "Type a prefix before ArrowUp to scope recall"),
			formatOutputRow("clear", "cmd+k clears session history")
		);
	}

	return wrapVerboseOutput("history", body.join("\n"), options);
}

const ROUTE_ALIASES: Readonly<Record<string, string>> = {
	root: "/",
	rss: "/rss.xml",
	feed: "/rss.xml",
	"atom.xml": "/rss.xml",
	sitemap: "/sitemap-index.xml",
	"sitemap.xml": "/sitemap-index.xml",
	resume: "/blog/2025-06-19-resume/",
	"public.pgp": "/downloads/public.pgp",
	"public-pgp": "/downloads/public.pgp",
	"alex-mbugua-ngugi-resume.pdf": "/downloads/Alex-Mbugua-Ngugi-Resume.pdf",
	"alex%20mbugua%20ngugi%20-%20resume.pdf": "/downloads/Alex-Mbugua-Ngugi-Resume.pdf",
	"alex mbugua ngugi - resume.pdf": "/downloads/Alex-Mbugua-Ngugi-Resume.pdf",
	why: "/notes/2026-03-12-guiding-principles",
	licensing: "/notes/2026-03-12-licensing",
	posts: "/blog",
	writing: "/blog",
	project: "/projects",
	code: "/projects",
	"guest-book": "/guestbook",
	"guest book": "/guestbook",
	signbook: "/guestbook",
};

function normalizeRouteLabel(value: string): string {
	return normalizeCommandInput(value).replace(/\s+/g, "-");
}

function getNavBrandRouteEntries(): Array<{ name: string; href: string }> {
	const seenHrefs = new Set<string>();
	return mainNavigation
		.filter((link) => !link.external && link.href.startsWith("/"))
		.flatMap((link) => {
			if (seenHrefs.has(link.href)) return [];
			seenHrefs.add(link.href);
			return [
				{
					name: normalizeRouteLabel(link.name),
					href: link.href,
				},
			];
		});
}

function getRouteTargets(): Readonly<Record<string, string>> {
	return {
		"/": "/",
		...Object.fromEntries(getNavBrandRouteEntries().map((entry) => [entry.name, entry.href])),
		...ROUTE_ALIASES,
	};
}

function getRouteAliasTargets(): string[] {
	return Object.keys(ROUTE_ALIASES).filter((alias) => !alias.includes("%"));
}

export function buildNavBrandRouteListMessage(options: NavBrandVerboseOptions = {}): string {
	const routes = getNavBrandRouteEntries();
	const body = [
		"[routes]",
		formatOutputRow("open with", "cd <route>"),
		...routes.map((entry) => formatOutputRow(entry.name, entry.href)),
	];

	if (options.verbose) {
		body.push(
			formatOutputRow("count", `${routes.length} routes`),
			formatOutputRow("source", "src/data/navigation.ts + redirect aliases"),
			formatOutputRow("examples", "cd blog · open projects · cd guestbook")
		);
	}

	return wrapVerboseOutput("ls", body.join("\n"), options);
}

function getSuggestionTermsForUnknownInput(): Array<{ term: string; priority: number }> {
	return [
		...NAVBRAND_COMMANDS.map((command) => ({ term: command.command, priority: 0 })),
		...NAVBRAND_COMMANDS.flatMap((command) => (command.aliases ?? []).map((term) => ({ term, priority: 1 }))),
		{ term: "search <query>", priority: 0 },
		{ term: "cd <route>", priority: 0 },
		{ term: "theme dark", priority: 0 },
		{ term: "bg matrix off", priority: 0 },
	];
}

function getEditDistance(a: string, b: string): number {
	const rows = a.length + 1;
	const cols = b.length + 1;
	const distances = Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0));

	for (let row = 0; row < rows; row += 1) distances[row]![0] = row;
	for (let col = 0; col < cols; col += 1) distances[0]![col] = col;

	for (let row = 1; row < rows; row += 1) {
		for (let col = 1; col < cols; col += 1) {
			const cost = a[row - 1] === b[col - 1] ? 0 : 1;
			distances[row]![col] = Math.min(
				distances[row - 1]![col]! + 1,
				distances[row]![col - 1]! + 1,
				distances[row - 1]![col - 1]! + cost
			);
		}
	}

	return distances[a.length]![b.length]!;
}

function getUnknownInputSuggestions(input: string): string[] {
	const normalizedInput = normalizeCommandInput(input);
	if (!normalizedInput) return [];

	return getSuggestionTermsForUnknownInput()
		.map(({ term, priority }) => ({
			term,
			priority,
			score: getEditDistance(normalizedInput, normalizeCommandInput(term)),
		}))
		.filter(({ score, term }) => score <= Math.max(2, Math.floor(term.length / 3)))
		.sort(
			(a, b) =>
				a.score - b.score || a.priority - b.priority || a.term.length - b.term.length || a.term.localeCompare(b.term)
		)
		.slice(0, 3)
		.map(({ term }) => term);
}

export function buildNavBrandUnknownCommandMessage(input: string): string {
	const suggestions = getUnknownInputSuggestions(input);
	const lines = ["[unknown]", formatOutputRow("input", input)];

	if (suggestions.length > 0) {
		lines.push(formatOutputRow("did you mean", suggestions.join(" · ")));
	}

	lines.push(formatOutputRow("try", "help · ls · search <query>"));
	return lines.join("\n");
}

function resolveCopyTarget(query: string | null): { label: string; value: string } | null {
	const normalized = normalizeCommandInput(query ?? "");
	const githubUrl =
		SOCIAL.profiles.find((profile) => profile.name === "GitHub")?.url ?? `https://github.com/${SOCIAL.github}`;

	if (normalized === "email" || normalized === "mail" || normalized === "contact") {
		return { label: "email", value: SOCIAL.email };
	}

	if (normalized === "site" || normalized === "url" || normalized === "home") {
		return { label: "site", value: SITE.url };
	}

	if (normalized === "github" || normalized === "gh" || normalized === "repo") {
		return { label: "github", value: githubUrl };
	}

	return null;
}

function normalizeFlavorTarget(value: string): string | null {
	const normalized = normalizeCommandInput(value);
	return THEME_FLAVOR_TARGETS.includes(normalized as (typeof THEME_FLAVOR_TARGETS)[number])
		? normalized === "default"
			? ""
			: normalized
		: null;
}

function normalizeBackgroundTarget(value: string): "stars" | "matrix" | null {
	const normalized = normalizeCommandInput(value);
	if (normalized === "stars" || normalized === "space") return "stars";
	if (normalized === "matrix" || normalized === "rain" || normalized === "hiragana") return "matrix";
	return null;
}

function normalizeBackgroundAction(value: string | null | undefined): "on" | "off" | "toggle" {
	const normalized = value ? normalizeCommandInput(value) : "";
	if (normalized === "off") return "off";
	if (normalized === "toggle") return "toggle";
	return "on";
}

function resolveRouteTarget(query: string | null): string | null {
	if (!query) return null;
	const normalizedTarget = normalizeCommandInput(query).replace(/^\/+/, "");
	if (!normalizedTarget) return "/";
	return getRouteTargets()[normalizeRouteLabel(normalizedTarget)] ?? null;
}

function getSuggestionRouteTargets(): string[] {
	return [...new Set([...getNavBrandRouteEntries().map((entry) => entry.name), ...getRouteAliasTargets()])];
}

const THEME_FLAVOR_TARGETS = ["default", "crt-green", "amber", "synthwave", "dos", "void", "ice", "redline"] as const;
const THEME_CHAINED_FLAVOR_TARGETS = [
	"crt-green",
	"amber",
	"synthwave",
	"dos",
	"void",
	"ice",
	"redline",
	"default",
] as const;
const POSTFIX_HELP_TERMS = ["help", "?", "man", "commands", "menu", "--help", "-h"] as const;
const POSTFIX_VERBOSE_TERMS = ["--verbose", "-v", "verbose", "details", "more"] as const;
const VERBOSE_COMMAND_IDS = new Set<NavBrandCommandId>(["help", "status", "identity", "history", "list"]);
const SUGGESTION_PATTERN_PHRASES: readonly string[] = [
	...["search", "find", "lookup"].map((command) => `${command} `),
	...["copy", "clip", "clipboard", "pbcopy"].flatMap((command) =>
		["email", "site", "github"].map((target) => `${command} ${target}`)
	),
	...getSuggestionRouteTargets().flatMap((route) => [`cd ${route}`, `open ${route}`, `start ${route}`]),
	...["dark", "light", "toggle", ...THEME_FLAVOR_TARGETS].map((value) => `theme ${value}`),
	...THEME_FLAVOR_TARGETS.map((value) => `theme flavor ${value}`),
	...["dark", "light"].flatMap((mode) => THEME_CHAINED_FLAVOR_TARGETS.map((flavor) => `theme ${mode} ${flavor}`)),
	...["on", "off"].flatMap((value) => [
		`background stars ${value}`,
		`background matrix ${value}`,
		`bg stars ${value}`,
		`bg matrix ${value}`,
		`stars ${value}`,
		`matrix ${value}`,
	]),
	"background",
	"bg",
	"collapse sidebar",
	"expand sidebar",
	"sidebar",
	"sidebar collapse",
	"sidebar expand",
	"sidebar toggle",
];

function getPostfixHelpPhrases(): string[] {
	return NAVBRAND_COMMANDS.flatMap(getCommandCompletionTerms).flatMap((term) =>
		POSTFIX_HELP_TERMS.map((helpTerm) => `${normalizeCommandInput(term)} ${helpTerm}`)
	);
}

function getPostfixVerbosePhrases(): string[] {
	return NAVBRAND_COMMANDS.filter((command) => VERBOSE_COMMAND_IDS.has(command.id))
		.flatMap(getCommandCompletionTerms)
		.flatMap((term) => POSTFIX_VERBOSE_TERMS.map((verboseTerm) => `${normalizeCommandInput(term)} ${verboseTerm}`));
}

function getPostfixFlagPhrases(): string[] {
	return [...getPostfixHelpPhrases(), ...getPostfixVerbosePhrases()];
}

function dedupeSuggestionPhraseEntries(entries: SuggestionPhraseEntry[]): SuggestionPhraseEntry[] {
	const bestByPhrase = new Map<string, SuggestionPhraseEntry>();

	for (const entry of entries) {
		const existing = bestByPhrase.get(entry.phrase);
		if (
			!existing ||
			entry.priority < existing.priority ||
			(entry.priority === existing.priority && entry.order < existing.order)
		) {
			bestByPhrase.set(entry.phrase, entry);
		}
	}

	return [...bestByPhrase.values()].sort(
		(a, b) => a.priority - b.priority || a.order - b.order || a.phrase.localeCompare(b.phrase)
	);
}

function getBaseSuggestionPhraseEntries(): SuggestionPhraseEntry[] {
	let order = 0;
	const entries: SuggestionPhraseEntry[] = [];

	for (const command of NAVBRAND_COMMANDS) {
		entries.push({ phrase: normalizeCommandInput(command.command), priority: 0, order });
		order += 1;
	}

	for (const phrase of SUGGESTION_PATTERN_PHRASES) {
		entries.push({ phrase, priority: 1, order });
		order += 1;
	}

	for (const command of NAVBRAND_COMMANDS) {
		for (const alias of command.aliases ?? []) {
			entries.push({ phrase: normalizeCommandInput(alias), priority: 2, order });
			order += 1;
		}
	}

	for (const command of NAVBRAND_COMMANDS) {
		for (const keyword of command.keywords ?? []) {
			entries.push({ phrase: normalizeCommandInput(keyword), priority: 3, order });
			order += 1;
		}
	}

	return dedupeSuggestionPhraseEntries(entries);
}

function getBaseSuggestionPhrases(): string[] {
	return getBaseSuggestionPhraseEntries().map((entry) => entry.phrase);
}

function getSuggestionPhrases(): string[] {
	return [...new Set([...getBaseSuggestionPhrases(), ...getPostfixFlagPhrases()])];
}

function getCompletionPhrases(input: string): string[] {
	const basePhrases = getBaseSuggestionPhrases();
	const hasBaseCompletions = basePhrases.some((phrase) => phrase.startsWith(input) && phrase.length > input.length);
	const postfixFlagCandidate = input.match(/^(.+)\s+(\S*)$/);
	const shouldIncludePostfixFlags =
		postfixFlagCandidate !== null &&
		Boolean(resolveHelpTopic(postfixFlagCandidate[1])) &&
		[...POSTFIX_HELP_TERMS, ...POSTFIX_VERBOSE_TERMS].some((flagTerm) => flagTerm.startsWith(postfixFlagCandidate[2]));
	const flagFragment = postfixFlagCandidate?.[2] ?? "";

	return shouldIncludePostfixFlags && (!hasBaseCompletions || flagFragment.startsWith("-"))
		? getSuggestionPhrases()
		: basePhrases;
}

function isKnownDynamicCommand(input: string): boolean {
	const routeMatch = input.match(/^(cd|open|start|xdg-open|invoke-item|ii)\s+(.+)$/);
	const postfixHelpMatch = input.match(/^(.+)\s+(help|\?|man|commands|menu|--help|-h)$/);
	const postfixVerboseMatch = input.match(/^(.+)\s+(--verbose|-v|verbose|details|more)$/);
	return (
		(postfixHelpMatch ? Boolean(resolveHelpTopic(postfixHelpMatch[1])) : false) ||
		(postfixVerboseMatch
			? getPostfixVerbosePhrases().some((phrase) => phrase === normalizeCommandInput(input))
			: false) ||
		/^(search|find|lookup)\s+.+$/.test(input) ||
		/^(copy|clip|clipboard|pbcopy)\s+(email|mail|contact|site|url|home|github|gh|repo)$/.test(input) ||
		(routeMatch ? resolveRouteTarget(routeMatch[2]) !== null : false) ||
		/^theme\s+(dark|light|toggle|default|crt-green|amber|synthwave|dos|void|ice|redline)$/.test(input) ||
		/^theme\s+flavor\s+(default|crt-green|amber|synthwave|dos|void|ice|redline)$/.test(input) ||
		/^theme\s+(dark|light)\s+(default|crt-green|amber|synthwave|dos|void|ice|redline)$/.test(input) ||
		/^(background|bg)\s+(stars|matrix|space|rain|hiragana)(\s+(on|off|toggle))?$/.test(input) ||
		/^(stars|matrix)(\s+(on|off|toggle))?$/.test(input) ||
		/^(rain|hiragana|space)$/.test(input) ||
		/^(sidebar|rail|panel)$/.test(input) ||
		/^sidebar\s+(collapse|expand|toggle)$/.test(input) ||
		/^(collapse|expand)\s+sidebar$/.test(input)
	);
}

export function resolveNavBrandCommandSuggestion(input: string): NavBrandCommandSuggestion {
	const normalizedInput = normalizeCommandInput(input);
	if (!normalizedInput) {
		return { state: "empty", completion: "" };
	}

	if (isKnownDynamicCommand(normalizedInput)) {
		return { state: "known", completion: "" };
	}

	const phrases = getSuggestionPhrases();
	if (phrases.some((phrase) => phrase === normalizedInput)) {
		return { state: "known", completion: "" };
	}

	const match = phrases.find((phrase) => phrase.startsWith(normalizedInput));
	if (match) {
		return { state: "partial", completion: match.slice(normalizedInput.length) };
	}

	return { state: "unknown", completion: "" };
}

export function resolveNavBrandCommandCompletions(input: string): NavBrandCommandCompletionResult {
	const normalizedInput = normalizeCompletionInput(input);
	if (!normalizedInput) {
		return { state: "empty", items: [] };
	}

	const items = getCompletionPhrases(normalizedInput)
		.filter((phrase) => phrase.startsWith(normalizedInput) && phrase.length > normalizedInput.length)
		.map((phrase) => ({
			value: phrase,
			completion: phrase.slice(normalizedInput.length),
		}));

	if (items.length > 0) {
		return { state: "partial", items };
	}

	if (resolveNavBrandCommandSuggestion(input).state === "known") {
		return { state: "known", items: [] };
	}

	return { state: "unknown", items: [] };
}

/**
 * Resolve terminal input against the launcher registry.
 *
 * This stays intentionally small and deterministic for the first typed-command
 * slice. It supports:
 * - exact command/alias matches
 * - prefix matches for short launcher input
 * - `find/search/lookup <query>` search-handoff parsing
 *
 * It does not perform content retrieval itself; query-bearing results still
 * hand off to the dedicated Search surfaces.
 */
export function resolveNavBrandCommandInput(input: string): ResolvedNavBrandCommand | null {
	const { normalizedInput, verbose, argv } = parseVerboseInput(input);
	if (!normalizedInput) return null;
	const resolved = (command: NavBrandCommandDefinition, query: string | null = null): ResolvedNavBrandCommand => ({
		command,
		query,
		verbose,
		argv,
	});

	const postfixHelpMatch = normalizedInput.match(/^(.+)\s+(help|\?|man|commands|menu|--help|-h)$/);
	if (postfixHelpMatch) {
		return resolved(getNavBrandCommand("help"), postfixHelpMatch[1].trim());
	}

	const helpTopicMatch = normalizedInput.match(/^(help|\?|man|commands|menu|--help|-h)\s+(.+)$/);
	if (helpTopicMatch) {
		return resolved(getNavBrandCommand("help"), helpTopicMatch[2].trim());
	}

	const searchCommand = getNavBrandCommand("search");
	const searchPrefixMatch = normalizedInput.match(/^(find|search|lookup)\s+(.+)$/);
	if (searchPrefixMatch) {
		return resolved(searchCommand, searchPrefixMatch[2].trim());
	}

	const shellNavigationMatch = normalizedInput.match(/^(cd|open|start|xdg-open|invoke-item|ii)\s+(.+)$/);
	if (shellNavigationMatch) {
		const target = shellNavigationMatch[2].trim();
		if (normalizeCommandInput(target) === "search") {
			return resolved(searchCommand);
		}

		return resolved(getNavBrandCommand("open"), target);
	}

	const copyMatch = normalizedInput.match(/^(copy|clip|clipboard|pbcopy)\s+(.+)$/);
	if (copyMatch && resolveCopyTarget(copyMatch[2])) {
		return resolved(getNavBrandCommand("copy"), normalizeCommandInput(copyMatch[2]));
	}

	const themeMatch = normalizedInput.match(/^theme\s+(?:flavor\s+)?(.+)$/);
	if (themeMatch) {
		const themeValue = themeMatch[1].trim();
		const chainedThemeMatch = themeValue.match(/^(light|dark)\s+(.+)$/);
		if (chainedThemeMatch) {
			const flavor = normalizeFlavorTarget(chainedThemeMatch[2]);
			if (flavor !== null) {
				return resolved(getNavBrandCommand("theme"), `${chainedThemeMatch[1]} flavor:${flavor || "default"}`);
			}
		}

		const flavor = normalizeFlavorTarget(themeValue);
		if (themeValue === "light" || themeValue === "dark" || themeValue === "toggle") {
			return resolved(getNavBrandCommand("theme"), themeValue);
		}
		if (flavor !== null) {
			return resolved(getNavBrandCommand("theme"), `flavor:${flavor || "default"}`);
		}
	}

	const backgroundMatch = normalizedInput.match(
		/^(background|bg)\s+(stars|matrix|space|rain|hiragana)(?:\s+(on|off|toggle))?$/
	);
	if (backgroundMatch) {
		const target = normalizeBackgroundTarget(backgroundMatch[2]);
		if (target) {
			return resolved(getNavBrandCommand("background"), `${target}:${normalizeBackgroundAction(backgroundMatch[3])}`);
		}
	}

	const legacyBackgroundMatch = normalizedInput.match(/^(stars|matrix)(?:\s+(on|off|toggle))?$/);
	if (legacyBackgroundMatch) {
		const target = normalizeBackgroundTarget(legacyBackgroundMatch[1]);
		if (target) {
			return resolved(
				getNavBrandCommand("background"),
				`${target}:${normalizeBackgroundAction(legacyBackgroundMatch[2])}`
			);
		}
	}

	const backgroundKeywordTarget = normalizeBackgroundTarget(normalizedInput);
	if (backgroundKeywordTarget) {
		return resolved(getNavBrandCommand("background"), `${backgroundKeywordTarget}:on`);
	}

	const sidebarActionMatch = normalizedInput.match(/^sidebar\s+(collapse|expand|toggle)$/);
	if (sidebarActionMatch) {
		return resolved(getNavBrandCommand("sidebar"), sidebarActionMatch[1]);
	}

	const legacySidebarActionMatch = normalizedInput.match(/^(collapse|expand)\s+sidebar$/);
	if (legacySidebarActionMatch) {
		return resolved(getNavBrandCommand("sidebar"), legacySidebarActionMatch[1]);
	}

	if (normalizedInput === "sidebar" || normalizedInput === "rail" || normalizedInput === "panel") {
		return resolved(getNavBrandCommand("sidebar"), "toggle");
	}

	let bestMatch: { command: NavBrandCommandDefinition; score: number } | null = null;

	for (const command of NAVBRAND_COMMANDS) {
		for (const term of getCommandTerms(command)) {
			const normalizedTerm = normalizeCommandInput(term);
			let score = -1;

			if (normalizedInput === normalizedTerm) {
				score = 100;
			} else if (normalizedTerm.startsWith(normalizedInput)) {
				score = 80;
			} else if (normalizedTerm.includes(normalizedInput)) {
				score = 55;
			}

			if (score > -1 && (!bestMatch || score > bestMatch.score)) {
				bestMatch = { command, score };
			}
		}
	}

	if (!bestMatch) return null;

	return resolved(bestMatch.command);
}

/**
 * Convert a resolved command into a concrete runtime intent.
 *
 * The coordinator executes these intents; parsing and argument normalization
 * stay in this pure module so we can reuse the same contract.
 */
export function buildNavBrandCommandIntent(resolved: ResolvedNavBrandCommand): NavBrandCommandIntent | null {
	const { command, query } = resolved;

	if (command.action === "navigate" && command.href) {
		return { type: "navigate", href: command.href };
	}

	if (command.action === "search-handoff") {
		return { type: "search-handoff", query };
	}

	if (command.action === "external-link" && command.href) {
		return { type: "external-link", href: command.href };
	}

	if (command.action === "copy") {
		const target = resolveCopyTarget(query);
		return target
			? { type: "copy", ...target }
			: { type: "message", message: "copy target required · try: copy email" };
	}

	if (command.id === "theme") {
		const chainedThemeMatch = query?.match(/^(light|dark) flavor:(.+)$/);
		if (chainedThemeMatch) {
			const flavor = chainedThemeMatch[2] === "default" ? "" : chainedThemeMatch[2];
			return {
				type: "batch",
				intents: [
					{ type: "toggle-pref", target: "theme", value: chainedThemeMatch[1] },
					{ type: "toggle-pref", target: "flavor", value: flavor },
				],
			};
		}

		if (query?.startsWith("flavor:")) {
			const value = query.slice("flavor:".length);
			return { type: "toggle-pref", target: "flavor", value: value === "default" ? "" : value };
		}
		const value = query === "light" || query === "dark" ? query : "toggle";
		return { type: "toggle-pref", target: "theme", value };
	}

	if (command.id === "background") {
		const [backgroundTarget, backgroundAction = "on"] = (query ?? "").split(":");
		if (backgroundTarget !== "stars" && backgroundTarget !== "matrix") {
			return { type: "message", message: "background target required · try: bg stars on or bg matrix off" };
		}
		const value = backgroundAction === "toggle" ? "toggle" : backgroundAction !== "off";
		return { type: "toggle-pref", target: `${backgroundTarget}-background-toggle`, value };
	}

	if (command.id === "sidebar") {
		const value = query === "collapse" || query === "expand" ? query : "toggle";
		return { type: "toggle-pref", target: "sidebar-collapse", value };
	}

	if (command.intent === "status") {
		return { type: "show-status" };
	}

	if (command.intent === "identity") {
		return { type: "message", message: buildNavBrandIdentityMessage() };
	}

	if (command.intent === "clear") {
		return { type: "clear-viewport" };
	}

	if (command.intent === "clear-history") {
		return { type: "clear-history" };
	}

	if (command.intent === "reset") {
		return { type: "reset-terminal" };
	}

	if (command.intent === "minimize") {
		return { type: "minimize-terminal" };
	}

	if (command.intent === "close") {
		return { type: "close-terminal" };
	}

	if (command.intent === "history") {
		return { type: "show-history" };
	}

	if (command.intent === "system-profile") {
		return { type: "show-system-profile" };
	}

	if (command.id === "pwd") {
		return { type: "show-working-route" };
	}

	if (command.id === "list") {
		return { type: "list-routes" };
	}

	if (command.id === "open") {
		const href = resolveRouteTarget(query);
		return href ? { type: "navigate", href } : { type: "message", message: `unknown route: ${query ?? ""}` };
	}

	if (command.action === "hint") {
		return { type: "message", message: buildNavBrandHelpMessage(query) };
	}

	return null;
}

/**
 * Help/hint moments should rotate through real actionable commands and avoid
 * repeating the exact same hint twice in a row when multiple options exist.
 */
export function pickNavBrandHintCommand(
	options: {
		lastCommandId?: NavBrandCommandId | null;
		random?: RandomSource;
	} = {}
): NavBrandCommandDefinition {
	const { lastCommandId = null, random = Math.random } = options;
	const candidates = NAVBRAND_HINT_COMMAND_IDS.filter((id) => id !== lastCommandId);
	const effectiveIds = candidates.length > 0 ? candidates : [...NAVBRAND_HINT_COMMAND_IDS];
	const index = Math.min(effectiveIds.length - 1, Math.floor(random() * effectiveIds.length));
	return getNavBrandCommand(effectiveIds[index]);
}
