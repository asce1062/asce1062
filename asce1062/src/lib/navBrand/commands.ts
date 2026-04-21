import { PROFESSIONAL, SITE, SOCIAL } from "@/config/site-config";
import { mainNavigation } from "@/data/navigation";

/**
 * Navbrand interaction-layer command catalog.
 *
 * Phase 3's terminal surface is a compact terminal-like command environment,
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
	| "message"
	| "terminal";
export type NavBrandCommandIntentGroup =
	| "search"
	| "navigation"
	| "external"
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
	| { type: "toggle-pref"; target: string; value: string | boolean }
	| { type: "batch"; intents: readonly NavBrandCommandIntent[] }
	| { type: "message"; message: string }
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

export const NAVBRAND_VISIBLE_COMMAND_IDS: readonly NavBrandCommandId[] = ["search", "open", "help"];
export const NAVBRAND_HINT_COMMAND_IDS: readonly NavBrandCommandId[] = ["search", "open", "help"];
export const NAVBRAND_COMMAND_PROMPT_HINT = "try: cd blog · find auth0";
export const NAVBRAND_UNKNOWN_COMMAND_HINT = "unknown command · try: help";

type RandomSource = () => number;
type HelpSectionId = "start" | "navigation" | "search" | "preferences" | "terminal" | "identity" | "external";

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
	open: "cd <route>",
};

const HELP_COMMAND_EXAMPLES: Partial<Record<NavBrandCommandId, readonly string[]>> = {
	search: ["search astro", "find pagefind"],
	theme: ["theme dark", "theme amber"],
	background: ["bg matrix off", "background stars on"],
	sidebar: ["sidebar collapse", "sidebar"],
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

function getCommandTerms(command: NavBrandCommandDefinition): string[] {
	return [command.command, ...(command.aliases ?? []), ...(command.keywords ?? [])];
}

function getCommandCompletionTerms(command: NavBrandCommandDefinition): string[] {
	return getCommandTerms(command);
}

function getHelpUsage(command: NavBrandCommandDefinition): string {
	return HELP_COMMAND_PATTERNS[command.id] ?? command.command;
}

function formatCommandLine(command: NavBrandCommandDefinition): string {
	return `${getHelpUsage(command).padEnd(14)} ${command.description}`;
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
		return `${pattern.padEnd(29)} ${command.description}`;
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
		return `${command.command} -> ${aliases.join(", ")}`;
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

function buildCommandTopicHelp(command: NavBrandCommandDefinition): string {
	const lines = [
		`help: ${command.command} (${command.label})`,
		`${command.description}`,
		`usage: ${getHelpUsage(command)}`,
		`intent: ${command.intent}`,
	];
	if (command.aliases?.length) {
		lines.push(`aliases: ${command.aliases.join(", ")}`);
	}
	if (command.keywords?.length) {
		lines.push(`keywords: ${command.keywords.join(", ")}`);
	}
	lines.push(`accepted input: ${getCommandTerms(command).join(", ")}`);
	const examples = HELP_COMMAND_EXAMPLES[command.id];
	if (examples?.length) {
		lines.push(`examples: ${examples.join(" · ")}`);
	}
	return lines.join("\n");
}

function buildIntentTopicHelp(intent: NavBrandCommandIntentGroup): string {
	const section = HELP_SECTION_BY_INTENT[intent];
	const commands = NAVBRAND_COMMANDS.filter((command) => command.intent === intent);
	const sectionCommands = section ? getCommandsForSection(section) : commands;
	const commandLines = (sectionCommands.length > 0 ? sectionCommands : commands).map(formatCommandLine);
	const patternLines = (sectionCommands.length > 0 ? sectionCommands : commands)
		.filter((command) => HELP_COMMAND_PATTERNS[command.id])
		.map((command) => `pattern: ${HELP_COMMAND_PATTERNS[command.id]}`);

	return [`help: ${HELP_SECTION_TITLES[section] ?? intent}`, ...commandLines, ...patternLines].join("\n");
}

export function buildNavBrandHelpMessage(topic?: string | null): string {
	if (topic) {
		const resolvedTopic = resolveHelpTopic(topic);
		if (!resolvedTopic) {
			return `help: ${topic}\nunknown topic · try: help, help navigation, help clear, help search`;
		}
		return typeof resolvedTopic === "string"
			? buildIntentTopicHelp(resolvedTopic)
			: buildCommandTopicHelp(resolvedTopic);
	}

	return [
		"stellar console help",
		"compact command surface for alexmbugua.me · navigation, preferences, system notes, and search handoff",
		"",
		"[usage patterns]",
		...buildHelpPatterns(),
		"",
		...buildHelpSections(),
		"",
		"[examples]",
		buildHelpExamples(),
		"",
		"[useful aliases]",
		...buildFeaturedAliases(),
		"",
		"[all commands]",
		buildAllCommandsLine(),
		"",
		"topic help: clear help · search help · navigation help",
	].join("\n");
}

export const NAVBRAND_HELP_MESSAGE = buildNavBrandHelpMessage();

export function buildNavBrandIdentityMessage(): string {
	return [
		`${SITE.author} // ${SOCIAL.github}`,
		`site: ${new URL(SITE.url).hostname}`,
		`brand: ${SITE.title}`,
		`signal: ${SITE.titleSuffix}`,
		`role: ${PROFESSIONAL.jobTitle}`,
		`field: ${SITE.description}`,
		`contact: ${SOCIAL.email}`,
	].join("\n");
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

export function buildNavBrandRouteListMessage(): string {
	return getNavBrandRouteEntries()
		.map((entry) => `${entry.name}\t${entry.href}`)
		.join("\n");
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
const SUGGESTION_PATTERN_PHRASES: readonly string[] = [
	...["search", "find", "lookup"].map((command) => `${command} `),
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

function getBaseSuggestionPhrases(): string[] {
	return [
		...new Set([
			...NAVBRAND_COMMANDS.flatMap(getCommandCompletionTerms).map(normalizeCommandInput),
			...SUGGESTION_PATTERN_PHRASES,
		]),
	];
}

function getSuggestionPhrases(): string[] {
	return [...new Set([...getBaseSuggestionPhrases(), ...getPostfixHelpPhrases()])];
}

function getCompletionPhrases(input: string): string[] {
	const postfixHelpCandidate = input.match(/^(.+)\s+(\S+)$/);
	const shouldIncludePostfixHelp =
		postfixHelpCandidate !== null &&
		Boolean(resolveHelpTopic(postfixHelpCandidate[1])) &&
		POSTFIX_HELP_TERMS.some((helpTerm) => helpTerm.startsWith(postfixHelpCandidate[2]));

	return shouldIncludePostfixHelp ? getSuggestionPhrases() : getBaseSuggestionPhrases();
}

function isKnownDynamicCommand(input: string): boolean {
	const routeMatch = input.match(/^(cd|open|start|xdg-open|invoke-item|ii)\s+(.+)$/);
	const postfixHelpMatch = input.match(/^(.+)\s+(help|\?|man|commands|menu|--help|-h)$/);
	return (
		(postfixHelpMatch ? Boolean(resolveHelpTopic(postfixHelpMatch[1])) : false) ||
		/^(search|find|lookup)\s+.+$/.test(input) ||
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
	const normalizedInput = normalizeCommandInput(input);
	if (!normalizedInput) return null;

	const postfixHelpMatch = normalizedInput.match(/^(.+)\s+(help|\?|man|commands|menu|--help|-h)$/);
	if (postfixHelpMatch) {
		return {
			command: getNavBrandCommand("help"),
			query: postfixHelpMatch[1].trim(),
		};
	}

	const helpTopicMatch = normalizedInput.match(/^(help|\?|man|commands|menu|--help|-h)\s+(.+)$/);
	if (helpTopicMatch) {
		return {
			command: getNavBrandCommand("help"),
			query: helpTopicMatch[2].trim(),
		};
	}

	const searchCommand = getNavBrandCommand("search");
	const searchPrefixMatch = normalizedInput.match(/^(find|search|lookup)\s+(.+)$/);
	if (searchPrefixMatch) {
		return {
			command: searchCommand,
			query: searchPrefixMatch[2].trim(),
		};
	}

	const shellNavigationMatch = normalizedInput.match(/^(cd|open|start|xdg-open|invoke-item|ii)\s+(.+)$/);
	if (shellNavigationMatch) {
		const target = shellNavigationMatch[2].trim();
		if (normalizeCommandInput(target) === "search") {
			return {
				command: searchCommand,
				query: null,
			};
		}

		return {
			command: getNavBrandCommand("open"),
			query: target,
		};
	}

	const themeMatch = normalizedInput.match(/^theme\s+(?:flavor\s+)?(.+)$/);
	if (themeMatch) {
		const themeValue = themeMatch[1].trim();
		const chainedThemeMatch = themeValue.match(/^(light|dark)\s+(.+)$/);
		if (chainedThemeMatch) {
			const flavor = normalizeFlavorTarget(chainedThemeMatch[2]);
			if (flavor !== null) {
				return {
					command: getNavBrandCommand("theme"),
					query: `${chainedThemeMatch[1]} flavor:${flavor || "default"}`,
				};
			}
		}

		const flavor = normalizeFlavorTarget(themeValue);
		if (themeValue === "light" || themeValue === "dark" || themeValue === "toggle") {
			return {
				command: getNavBrandCommand("theme"),
				query: themeValue,
			};
		}
		if (flavor !== null) {
			return {
				command: getNavBrandCommand("theme"),
				query: `flavor:${flavor || "default"}`,
			};
		}
	}

	const backgroundMatch = normalizedInput.match(
		/^(background|bg)\s+(stars|matrix|space|rain|hiragana)(?:\s+(on|off|toggle))?$/
	);
	if (backgroundMatch) {
		const target = normalizeBackgroundTarget(backgroundMatch[2]);
		if (target) {
			return {
				command: getNavBrandCommand("background"),
				query: `${target}:${normalizeBackgroundAction(backgroundMatch[3])}`,
			};
		}
	}

	const legacyBackgroundMatch = normalizedInput.match(/^(stars|matrix)(?:\s+(on|off|toggle))?$/);
	if (legacyBackgroundMatch) {
		const target = normalizeBackgroundTarget(legacyBackgroundMatch[1]);
		if (target) {
			return {
				command: getNavBrandCommand("background"),
				query: `${target}:${normalizeBackgroundAction(legacyBackgroundMatch[2])}`,
			};
		}
	}

	const backgroundKeywordTarget = normalizeBackgroundTarget(normalizedInput);
	if (backgroundKeywordTarget) {
		return {
			command: getNavBrandCommand("background"),
			query: `${backgroundKeywordTarget}:on`,
		};
	}

	const sidebarActionMatch = normalizedInput.match(/^sidebar\s+(collapse|expand|toggle)$/);
	if (sidebarActionMatch) {
		return {
			command: getNavBrandCommand("sidebar"),
			query: sidebarActionMatch[1],
		};
	}

	const legacySidebarActionMatch = normalizedInput.match(/^(collapse|expand)\s+sidebar$/);
	if (legacySidebarActionMatch) {
		return {
			command: getNavBrandCommand("sidebar"),
			query: legacySidebarActionMatch[1],
		};
	}

	if (normalizedInput === "sidebar" || normalizedInput === "rail" || normalizedInput === "panel") {
		return {
			command: getNavBrandCommand("sidebar"),
			query: "toggle",
		};
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

	return {
		command: bestMatch.command,
		query: null,
	};
}

/**
 * Convert a resolved command into a concrete runtime intent.
 *
 * The coordinator executes these intents; parsing and argument normalization
 * stay in this pure module so later Phase 3 slices can reuse the same contract.
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
		return { type: "message", message: "presence engine online" };
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
