/**
 * The Pagefind UI and its styles, as one lazily imported chunk (see
 * pagefindSearch.ts). The styles are inlined strings rather than CSS imports:
 * Astro links every stylesheet reachable from a page's scripts into <head>,
 * dynamic imports included, which would load them on every page.
 */
import uiCss from "@pagefind/default-ui/css/ui.css?inline";
import siteCss from "@/styles/components/search.css?inline";

export { PagefindUI } from "@pagefind/default-ui";

const STYLE_ID = "pagefind-ui-styles";

/** Add the styles once per document; soft navigation replaces <head>, so call this per build. */
export function ensurePagefindStyles(): void {
	if (document.getElementById(STYLE_ID)) return;
	const style = document.createElement("style");
	style.id = STYLE_ID;
	style.textContent = `${uiCss}\n${siteCss}`;
	document.head.append(style);
}
