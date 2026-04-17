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
	href?: string;
};

export const NAVBRAND_COMMANDS: readonly NavBrandCommandDefinition[] = [
	{
		id: "search",
		command: "search",
		label: "Search",
		description: "Hand off to the real Pagefind search surface: floating search when available, otherwise /search.",
		hint: "type / to search",
		action: "search-handoff",
	},
	{
		id: "blog",
		command: "blog",
		label: "Blog",
		description: "Jump into the main writing archive.",
		hint: "try: blog",
		action: "navigate",
		href: "/blog",
	},
	{
		id: "projects",
		command: "projects",
		label: "Projects",
		description: "Open the projects index.",
		hint: "try: projects",
		action: "navigate",
		href: "/projects",
	},
	{
		id: "guestbook",
		command: "guestbook",
		label: "Guestbook",
		description: "Visit the guestbook and leave a note.",
		hint: "try: guestbook",
		action: "navigate",
		href: "/guestbook",
	},
	{
		id: "help",
		command: "help",
		label: "Help",
		description: "Reveal lightweight navbrand hints without opening a full command parser.",
		hint: "show commands",
		action: "hint",
	},
] as const;

export const NAVBRAND_VISIBLE_COMMAND_IDS: readonly NavBrandCommandId[] = NAVBRAND_COMMANDS.map(({ id }) => id);
export const NAVBRAND_HINT_COMMAND_IDS: readonly NavBrandCommandId[] = NAVBRAND_COMMANDS.filter(
	({ action }) => action !== "hint"
).map(({ id }) => id);

type RandomSource = () => number;

export function getNavBrandCommand(commandId: NavBrandCommandId): NavBrandCommandDefinition {
	const command = NAVBRAND_COMMANDS.find(({ id }) => id === commandId);
	if (!command) {
		throw new Error(`Unknown navbrand command: ${commandId}`);
	}
	return command;
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
