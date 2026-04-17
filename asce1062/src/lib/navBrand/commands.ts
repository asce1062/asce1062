import { SOCIAL } from "@/config/site-config";

/**
 * Navbrand interaction-layer command catalog.
 *
 * Phase 3's terminal surface is a lightweight command launcher, not a second
 * content-search UI. The dedicated `/search` page and floating Pagefind modal
 * remain the site's indexed-content retrieval surfaces. Commands in this file
 * should therefore do one of three things:
 * - navigate to a meaningful route quickly
 * - hand off into the real search surface
 * - reveal/help the command language itself
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
export type NavBrandCommandId =
	| "search"
	| "blog"
	| "projects"
	| "guestbook"
	| "help"
	| "email"
	| "github"
	| "theme"
	| "stars"
	| "matrix"
	| "sidebar"
	| "status"
	| "clear"
	| "history";

export type NavBrandCommandDefinition = {
	id: NavBrandCommandId;
	command: string;
	label: string;
	description: string;
	hint: string;
	action: NavBrandCommandAction;
	aliases?: readonly string[];
	keywords?: readonly string[];
	href?: string;
};

export type ResolvedNavBrandCommand = {
	command: NavBrandCommandDefinition;
	query: string | null;
};

export type NavBrandCommandIntent =
	| { type: "navigate"; href: string }
	| { type: "search-handoff"; query: string | null }
	| { type: "external-link"; href: string }
	| { type: "toggle-pref"; target: string; value: string | boolean }
	| { type: "message"; message: string }
	| { type: "clear-history" }
	| { type: "show-history" };

export const NAVBRAND_COMMANDS: readonly NavBrandCommandDefinition[] = [
	{
		id: "search",
		command: "search",
		label: "Search",
		description: "Hand off to the real Pagefind search surface: floating search when available, otherwise /search.",
		hint: "type / to search",
		action: "search-handoff",
		aliases: ["find", "lookup", "open search"],
		keywords: ["pagefind", "search"],
	},
	{
		id: "blog",
		command: "blog",
		label: "Blog",
		description: "Jump into the main writing archive.",
		hint: "try: blog",
		action: "navigate",
		aliases: ["posts", "writing"],
		keywords: ["notes", "articles"],
		href: "/blog",
	},
	{
		id: "projects",
		command: "projects",
		label: "Projects",
		description: "Open the projects index.",
		hint: "try: projects",
		action: "navigate",
		aliases: ["project", "code"],
		keywords: ["work", "builds"],
		href: "/projects",
	},
	{
		id: "guestbook",
		command: "guestbook",
		label: "Guestbook",
		description: "Visit the guestbook and leave a note.",
		hint: "try: guestbook",
		action: "navigate",
		aliases: ["guest book", "signbook"],
		keywords: ["hello", "leave a note"],
		href: "/guestbook",
	},
	{
		id: "help",
		command: "help",
		label: "Help",
		description: "Reveal lightweight navbrand hints without opening a full command parser.",
		hint: "show commands",
		action: "hint",
		aliases: ["?", "commands", "explore"],
		keywords: ["help", "discover"],
	},
	{
		id: "email",
		command: "email",
		label: "Email",
		description: "Open a mailto link to Alex's primary email address.",
		hint: "open mail client",
		action: "external-link",
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
		aliases: ["gh", "code profile"],
		keywords: ["repo", "profile"],
		href: SOCIAL.profiles.find((profile) => profile.name === "GitHub")?.url,
	},
	{
		id: "theme",
		command: "theme",
		label: "Theme",
		description: "Switch light/dark theme or toggle it.",
		hint: "try: theme dark",
		action: "toggle-pref",
		aliases: ["light", "dark"],
		keywords: ["mode", "appearance"],
	},
	{
		id: "stars",
		command: "stars",
		label: "Stars",
		description: "Toggle the stars background.",
		hint: "try: stars on",
		action: "toggle-pref",
		aliases: ["stars on", "stars off"],
		keywords: ["background", "space"],
	},
	{
		id: "matrix",
		command: "matrix",
		label: "Matrix",
		description: "Toggle the matrix background.",
		hint: "try: matrix on",
		action: "toggle-pref",
		aliases: ["matrix on", "matrix off"],
		keywords: ["rain", "hiragana"],
	},
	{
		id: "sidebar",
		command: "sidebar",
		label: "Sidebar",
		description: "Collapse or expand the desktop sidebar.",
		hint: "try: collapse sidebar",
		action: "toggle-pref",
		aliases: ["collapse sidebar", "expand sidebar"],
		keywords: ["rail", "panel"],
	},
	{
		id: "status",
		command: "status",
		label: "Status",
		description: "Show a local terminal-style status response.",
		hint: "presence engine online",
		action: "message",
		aliases: ["whoami", "signal"],
		keywords: ["system", "presence"],
	},
	{
		id: "clear",
		command: "clear",
		label: "Clear",
		description: "Push visible terminal history out of sight while keeping the session alive.",
		hint: "clear visible history",
		action: "terminal",
		aliases: ["cls", "cmd+k"],
		keywords: ["wipe", "reset view"],
	},
	{
		id: "history",
		command: "history",
		label: "History",
		description: "Show commands used during the current terminal session.",
		hint: "show session history",
		action: "terminal",
		aliases: ["recent", "log"],
		keywords: ["commands", "session"],
	},
] as const;

export const NAVBRAND_VISIBLE_COMMAND_IDS: readonly NavBrandCommandId[] = [
	"search",
	"blog",
	"projects",
	"guestbook",
	"help",
];
export const NAVBRAND_HINT_COMMAND_IDS: readonly NavBrandCommandId[] = ["search", "blog", "projects", "guestbook"];
export const NAVBRAND_COMMAND_PROMPT_HINT = "try: blog · find auth0";
export const NAVBRAND_UNKNOWN_COMMAND_HINT = "unknown command · try: help";
export const NAVBRAND_HELP_MESSAGE = "commands: search, blog, projects, guestbook, theme, status, clear, history";

type RandomSource = () => number;

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

function getCommandTerms(command: NavBrandCommandDefinition): string[] {
	return [command.command, ...(command.aliases ?? []), ...(command.keywords ?? [])];
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

	const searchCommand = getNavBrandCommand("search");
	const searchPrefixMatch = normalizedInput.match(/^(find|search|lookup)\s+(.+)$/);
	if (searchPrefixMatch) {
		return {
			command: searchCommand,
			query: searchPrefixMatch[2].trim(),
		};
	}

	const togglePrefixPatterns: Array<[NavBrandCommandId, RegExp]> = [
		["theme", /^theme\s+(dark|light|toggle)$/],
		["stars", /^stars\s+(on|off)$/],
		["matrix", /^matrix\s+(on|off)$/],
		["sidebar", /^(collapse|expand)\s+sidebar$/],
	];

	for (const [commandId, pattern] of togglePrefixPatterns) {
		const match = normalizedInput.match(pattern);
		if (match) {
			return {
				command: getNavBrandCommand(commandId),
				query: match[1].trim(),
			};
		}
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
			} else if (normalizedInput.startsWith(normalizedTerm)) {
				score = 70;
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
		const value = query === "light" || query === "dark" ? query : "toggle";
		return { type: "toggle-pref", target: "theme", value };
	}

	if (command.id === "stars") {
		return { type: "toggle-pref", target: "stars-background-toggle", value: query !== "off" };
	}

	if (command.id === "matrix") {
		return { type: "toggle-pref", target: "matrix-background-toggle", value: query !== "off" };
	}

	if (command.id === "sidebar") {
		const value = query === "expand" ? "expand" : "collapse";
		return { type: "toggle-pref", target: "sidebar-collapse", value };
	}

	if (command.id === "status") {
		return { type: "message", message: "presence engine online" };
	}

	if (command.id === "clear") {
		return { type: "clear-history" };
	}

	if (command.id === "history") {
		return { type: "show-history" };
	}

	if (command.action === "hint") {
		return { type: "message", message: NAVBRAND_HELP_MESSAGE };
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
