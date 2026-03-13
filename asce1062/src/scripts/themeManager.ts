/**
 * Theme Manager
 *
 * Handles light/dark theme switching.
 *
 * Priority for reading the current theme:
 *   URL param (?theme=light|dark) - highest; for embeds and screenshots
 *   localStorage                  - authoritative user preference
 *   data-theme attribute          - fallback; reflects what's painted on screen
 *   "dark"                        - site default
 *
 * localStorage is the source of truth. data-theme is a derived value set by
 * our own setTheme() and by the astro-themes early-init script; it is used
 * as a last-resort fallback only when storage is unavailable.
 *
 * The keyboard shortcut listener is managed via AbortController so it is
 * automatically cleaned up and re-registered on each soft navigation without
 * any manual removeEventListener bookkeeping.
 */

import { getPref, setPref, PREF_KEYS } from "@/lib/prefs";

export type Theme = "light" | "dark";

// Element ID of the theme icon. matches the <i id="toggleIcon"> in ThemeSwitcher.astro
const ICON_ELEMENT_ID = "toggleIcon";

// Computed once at module load. navigator.userAgent doesn't change per session
const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);

/**
 * Read the URL theme override, if present.
 * Returns the theme if ?theme=light or ?theme=dark, otherwise null.
 */
export function getThemeFromUrl(): Theme | null {
	const param = new URLSearchParams(window.location.search).get("theme");
	return param === "light" || param === "dark" ? param : null;
}

/**
 * Get the current theme.
 * Priority: URL param > localStorage > data-theme attribute > "dark" (default)
 */
export function getCurrentTheme(): Theme {
	const urlTheme = getThemeFromUrl();
	if (urlTheme) return urlTheme;

	// localStorage is authoritative. the user's explicit, persisted choice
	const stored = getPref(PREF_KEYS.theme);
	if (stored === "light" || stored === "dark") return stored;

	// data-theme is a derived fallback. reflects what astro-themes last painted
	const attr = document.documentElement.getAttribute("data-theme");
	if (attr === "light" || attr === "dark") return attr;

	return "dark";
}

/**
 * Apply a theme. Pass persist: false to avoid writing to localStorage
 * (e.g. when the theme is forced by a URL parameter).
 */
export function setTheme(theme: Theme, persist: boolean = true): Theme {
	if (persist) {
		setPref(PREF_KEYS.theme, theme);
	}
	document.documentElement.setAttribute("data-theme", theme);
	// astro-themes integration
	document.dispatchEvent(new CustomEvent("set-theme", { detail: theme }));
	return theme;
}

/**
 * Toggle between light and dark, persist the new value, and return it.
 */
export function toggleTheme(): Theme {
	return setTheme(getCurrentTheme() === "light" ? "dark" : "light");
}

/**
 * Update the theme icon element to reflect the current theme.
 * Uses classList.replace to avoid wiping unrelated classes.
 */
export function updateThemeIcon(): void {
	const icon = document.getElementById(ICON_ELEMENT_ID);
	if (!icon) return;
	const isLight = getCurrentTheme() === "light";
	if (!icon.classList.replace(isLight ? "icon-sun" : "icon-moon", isLight ? "icon-moon" : "icon-sun")) {
		// classList.replace returns false when the old class isn't present (first run)
		icon.classList.add(isLight ? "icon-moon" : "icon-sun");
	}
}

/**
 * If a URL theme is present, apply it without persisting.
 * Call early to avoid a flash of the wrong theme for embed/screenshot use.
 */
export function initThemeFromUrl(): void {
	const urlTheme = getThemeFromUrl();
	if (urlTheme) setTheme(urlTheme, false);
}

/**
 * Initialize the theme switcher: apply any URL override and sync the icon.
 */
export function initThemeSwitcher(): void {
	initThemeFromUrl();
	updateThemeIcon();
}

/**
 * Handle a theme toggle button click.
 */
export function handleThemeToggle(): void {
	toggleTheme();
	updateThemeIcon();
}

/**
 * Register the Ctrl/Cmd+Shift+L keyboard shortcut.
 * Tied to an AbortSignal so the caller controls the lifecycle.
 */
export function setupThemeShortcut(signal: AbortSignal): void {
	document.addEventListener(
		"keydown",
		(e: KeyboardEvent) => {
			const ctrlOrCmd = isMac ? e.metaKey : e.ctrlKey;
			if (e.key.toLowerCase() === "l" && ctrlOrCmd && e.shiftKey) {
				e.preventDefault();
				handleThemeToggle();
			}
		},
		{ signal }
	);
}
