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
export type NavBrandCommandAction = "search-handoff" | "navigate" | "hint";
export type NavBrandCommandId = "search" | "blog" | "projects" | "guestbook" | "help";

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
] as const;

export const NAVBRAND_VISIBLE_COMMAND_IDS: readonly NavBrandCommandId[] = NAVBRAND_COMMANDS.map(({ id }) => id);
export const NAVBRAND_HINT_COMMAND_IDS: readonly NavBrandCommandId[] = NAVBRAND_COMMANDS.filter(
	({ action }) => action !== "hint"
).map(({ id }) => id);
export const NAVBRAND_COMMAND_PROMPT_HINT = "try: blog · find auth0";
export const NAVBRAND_UNKNOWN_COMMAND_HINT = "unknown command · try: help";
export const NAVBRAND_HELP_MESSAGE = "commands: search, blog, projects, guestbook";

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
