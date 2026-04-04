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
