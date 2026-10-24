/**
 * Iframe Theme Manager
 * Single source of truth for iframe theming across the site
 * Handles theme synchronization for iframes to match light/dark mode
 */

import type { IframeThemeConfig } from "@/types";

/**
 * Get the current theme from the document
 */
function getCurrentTheme(): "dark" | "light" {
	const theme = document.documentElement.getAttribute("data-theme");
	return theme === "dark" ? "dark" : "light";
}

/**
 * Update iframe theme based on configuration
 */
function updateIframeTheme(config: IframeThemeConfig): void {
	const iframe = document.getElementById(config.id) as HTMLIFrameElement;
	if (!iframe) return;

	const currentTheme = getCurrentTheme();

	switch (config.updateMethod) {
		case "src-query": {
			if (!config.queryParam || !config.queryValues) {
				console.warn(`IframeTheme: src-query method requires queryParam and queryValues for iframe ${config.id}`);
				return;
			}

			const queryValue = config.queryValues[currentTheme];
			const regex = new RegExp(`${config.queryParam}=(dark|light)`, "g");
			const nextSrc = iframe.src.replace(regex, `${config.queryParam}=${queryValue}`);
			// Assigning src always restarts navigation, even to the same URL.
			if (nextSrc !== iframe.src) iframe.src = nextSrc;
			break;
		}

		case "color-scheme": {
			// Update the color-scheme CSS property to match the theme
			// This helps the iframe's scrollbars and form controls match the theme
			iframe.style.colorScheme = currentTheme;
			break;
		}
	}
}

/**
 * Initialize iframe theme management for a single iframe.
 * Called once from a module script; follows soft navigations and every change
 * to data-theme (toggle, match-device, URL theme, after-swap restamp).
 */
export function initIframeTheme(config: IframeThemeConfig): void {
	const updateFn = () => updateIframeTheme(config);

	// Module scripts are deferred, so the document is already parsed here.
	updateFn();
	document.addEventListener("astro:page-load", updateFn);
	new MutationObserver(updateFn).observe(document.documentElement, {
		attributes: true,
		attributeFilter: ["data-theme"],
	});
}
