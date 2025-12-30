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
			iframe.src = iframe.src.replace(regex, `${config.queryParam}=${queryValue}`);
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
 * Initialize iframe theme management for a single iframe
 * Automatically sets up event listeners for theme changes
 */
export function initIframeTheme(config: IframeThemeConfig): void {
	const updateFn = () => updateIframeTheme(config);

	// Initial load
	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", updateFn);
	} else {
		updateFn();
	}

	// Reinitialize after view transitions
	document.addEventListener("astro:page-load", updateFn);

	// Theme changes
	document.addEventListener("set-theme", updateFn);
}

/**
 * Initialize iframe theme management for multiple iframes at once
 */
export function initMultipleIframeThemes(configs: IframeThemeConfig[]): void {
	configs.forEach((config) => initIframeTheme(config));
}

/**
 * Cleanup function to remove event listeners (useful for SPAs)
 */
export function cleanupIframeTheme(config: IframeThemeConfig): void {
	const updateFn = () => updateIframeTheme(config);

	document.removeEventListener("DOMContentLoaded", updateFn);
	document.removeEventListener("astro:page-load", updateFn);
	document.removeEventListener("set-theme", updateFn);
}
