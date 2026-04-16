/**
 * Browser Preference Utilities
 *
 * Thin, safe wrappers around localStorage for persistent user preferences.
 *
 * Storage choice - localStorage
 *
 * Keys are centralized here so they can be imported by both module scripts
 * and Astro frontmatter. Astro is:inline scripts cannot use ES module imports,
 *   but frontmatter can import this file and inject values via define:vars -
 *   keeping key strings in one place even across that boundary.
 */

/** All localStorage preference keys. Import instead of repeating strings. */
export const PREF_KEYS = {
	theme: "theme",
	cursorBlink: "cursor-blink",
	avatarState: "avatar-state",
	/** Set to "1" when match-device-theme mode is active; absent otherwise. */
	matchDeviceTheme: "match-device-theme",
	/** Set to "1" when animated stars GIF background is enabled; absent otherwise. */
	starsBackground: "stars-bg",
	/** Set to "1" when Matrix rain canvas background is enabled; absent otherwise. */
	matrixBackground: "matrix-bg",
	/** Active flavor name (e.g. "crt-green", "amber"). Absent = default warm void. */
	flavor: "theme-flavor",
	/** Active transition style name, e.g. "scanline". Absent or null = no explicit preference. */
	transition: "theme-transition",
	/** Set to "1" when the desktop sidebar is in collapsed (icon-only) mode; absent otherwise. */
	sidebarCollapsed: "sidebar-collapsed",
	/** Visit count integer (as string) for navbrand milestone greeting. */
	navBrandVisits: "nav-brand-visits",
	/** Unix ms timestamp (as string) of the last page visit for navbrand sub-line. */
	navBrandLastVisit: "nav-brand-last-visit",
} as const;

/** Safely read a preference. Returns null if unavailable or storage throws. */
export function getPref(key: string): string | null {
	try {
		return localStorage.getItem(key);
	} catch {
		return null;
	}
}

/** Safely write a preference. Silently no-ops if storage throws. */
export function setPref(key: string, value: string): void {
	try {
		localStorage.setItem(key, value);
	} catch {
		// Storage unavailable (private mode, quota exceeded). silently no-op
	}
}

/** Safely remove a preference. Silently no-ops if storage throws. */
export function removePref(key: string): void {
	try {
		localStorage.removeItem(key);
	} catch {
		// Storage unavailable. silently no-op
	}
}
