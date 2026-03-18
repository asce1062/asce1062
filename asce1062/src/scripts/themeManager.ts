/**
 * Theme Manager
 *
 * Handles light/dark theme switching.
 *
 * Theme priority:
 *   URL param (?theme=light|dark) - highest; for embeds and screenshots only
 *   match-device mode             - live OS preference; wins over stored manual choice
 *   localStorage                  - authoritative persisted user preference
 *   data-theme attribute          - fallback; reflects what's painted on screen
 *   "dark"                        - site default
 *
 * getCurrentTheme()   — what is currently displayed, including URL overrides.
 *                       Use for icon sync and toggle display state.
 * resolveActiveTheme() — what the theme should be per stored preferences.
 *                        Does NOT consider URL params; URL overrides are
 *                        presentation-only (embed/screenshot) and not persisted.
 *
 * localStorage is the source of truth for persistence. data-theme is a derived
 * value set by our own setTheme() and by the astro-themes early-init script.
 *
 * The keyboard shortcut listener is managed via AbortController so it is
 * automatically cleaned up and re-registered on each soft navigation.
 *
 * BROWSER-ONLY: this module uses window, navigator, and document. Import only
 * from client-side <script> blocks, never from SSR code paths.
 */

import { getPref, setPref, removePref, PREF_KEYS } from "@/lib/prefs";

export type Theme = "light" | "dark";

/**
 * Dispatched on document when match-device-theme mode is programmatically
 * enabled or disabled (e.g. a manual theme toggle turns it off).
 * detail: true = enabled, false = disabled.
 */
export const MATCH_DEVICE_THEME_CHANGE_EVENT = "match-device-theme-change";

// Element ID of the theme icon. matches the <i id="toggleIcon"> in ThemeSwitcher.astro
const ICON_ELEMENT_ID = "toggleIcon";

/** Return the OS/browser preferred color scheme. */
export function getSystemTheme(): Theme {
	return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** True when match-device-theme mode is persisted as enabled. */
export function isMatchDeviceTheme(): boolean {
	return getPref(PREF_KEYS.matchDeviceTheme) === "1";
}

/**
 * Enable match-device-theme mode.
 * Immediately applies and persists the device-preferred theme, then broadcasts
 * so any sidebar toggle UI can sync its checked state.
 */
export function enableMatchDeviceTheme(): void {
	setPref(PREF_KEYS.matchDeviceTheme, "1");
	setTheme(getSystemTheme());
	document.dispatchEvent(new CustomEvent(MATCH_DEVICE_THEME_CHANGE_EVENT, { detail: true }));
}

/**
 * Disable match-device-theme mode.
 * Does not change the active theme; the current theme becomes the new manual
 * preference. Broadcasts so the sidebar toggle UI can sync.
 */
export function disableMatchDeviceTheme(): void {
	removePref(PREF_KEYS.matchDeviceTheme);
	document.dispatchEvent(new CustomEvent(MATCH_DEVICE_THEME_CHANGE_EVENT, { detail: false }));
}

/**
 * Derive the correct active theme from stored preferences.
 * Use for runtime decisions: "what should the theme be right now?"
 * Does NOT consider URL params. URL overrides are presentation-only.
 */
export function resolveActiveTheme(): Theme {
	if (isMatchDeviceTheme()) return getSystemTheme();
	const stored = getPref(PREF_KEYS.theme);
	if (stored === "light" || stored === "dark") return stored;
	return "dark";
}

/**
 * Read the URL theme override, if present.
 * Returns the theme if ?theme=light or ?theme=dark, otherwise null.
 */
export function getThemeFromUrl(): Theme | null {
	const param = new URLSearchParams(window.location.search).get("theme");
	return param === "light" || param === "dark" ? param : null;
}

/**
 * Get the currently displayed theme, including URL overrides.
 * Priority: URL param > localStorage > data-theme attribute > "dark" (default)
 * Use for icon sync and toggle display state. For theme logic use resolveActiveTheme().
 */
export function getCurrentTheme(): Theme {
	const urlTheme = getThemeFromUrl();
	if (urlTheme) return urlTheme;

	// localStorage is authoritative. The user's explicit, persisted choice.
	const stored = getPref(PREF_KEYS.theme);
	if (stored === "light" || stored === "dark") return stored;

	// data-theme is a derived fallback. Reflects what astro-themes last painted.
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
 * Removes both icon classes before adding the correct one to prevent
 * accumulation if the element starts in an unexpected state.
 */
export function updateThemeIcon(): void {
	const icon = document.getElementById(ICON_ELEMENT_ID);
	if (!icon) return;
	const isLight = getCurrentTheme() === "light";
	icon.classList.remove("icon-sun", "icon-moon");
	icon.classList.add(isLight ? "icon-moon" : "icon-sun");
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
 * A manual toggle always cancels match-device-theme mode first so the manual
 * choice becomes the new persisted preference.
 */
export function handleThemeToggle(): void {
	disableMatchDeviceTheme();
	toggleTheme();
	updateThemeIcon();
}

/**
 * Register the Ctrl/Cmd+Shift+L keyboard shortcut.
 * Tied to an AbortSignal so the caller controls the lifecycle.
 * Ignored when focus is inside an editable field (input, textarea, select,
 * contenteditable) to prevent accidental firing while the user is typing.
 */
export function setupThemeShortcut(signal: AbortSignal): void {
	// Evaluated here rather than at module scope so this module is safe to import
	// before the browser environment is fully available (e.g. test contexts).
	const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);

	document.addEventListener(
		"keydown",
		(e: KeyboardEvent) => {
			// e.key is undefined on synthetic events fired by autofill/autocomplete
			if (!e.key) return;
			const ctrlOrCmd = isMac ? e.metaKey : e.ctrlKey;
			if (!(e.key.toLowerCase() === "l" && ctrlOrCmd && e.shiftKey)) return;

			// Do not fire while the user is typing in an editable field.
			const target = e.target as HTMLElement | null;
			if (target) {
				const tag = target.tagName;
				if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable) return;
			}

			e.preventDefault();
			handleThemeToggle();
		},
		{ signal }
	);
}
