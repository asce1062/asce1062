/**
 * Shared terminal-open event contract.
 *
 * Phase 3 splits the navbrand into lightweight teaser surfaces plus a shared
 * terminal window. Teasers should never import modal code directly; they only
 * dispatch this event and report where the request came from. The modal layer
 * listens for the same event and decides how to open, focus, or restore the
 * terminal window.
 */
export const NAVBRAND_OPEN_TERMINAL_EVENT = "navbrand:open-terminal";

export type NavBrandTerminalOpenTrigger = "pointer" | "keyboard";

export type NavBrandTerminalOpenDetail = {
	source: string;
	trigger: NavBrandTerminalOpenTrigger;
};
