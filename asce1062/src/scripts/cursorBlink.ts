/**
 * Cursor Blink Preference
 *
 * Manages the user preference to pause site-wide blinking cursor animations.
 * Persists to localStorage via prefs.ts (key: PREF_KEYS.cursorBlink).
 * Value is "paused" when disabled, absent when enabled.
 *
 * Applies the preference by setting/removing data-no-blink on <html>.
 * The CSS rule lives in global.css:
 *   html[data-no-blink] .blink { animation: none; }
 *
 * TOGGLE_ID must match sidebarOptions[0].id in src/data/navigation.ts.
 *
 * Lifecycle:
 *   applyPref()           - runs at module load (covers JS-bundle-load path)
 *   astro:after-swap      - re-stamps data-no-blink before paint on soft nav
 *   astro:page-load       - re-syncs the toggle checkbox after sidebar re-render
 *   window storage event  - reflects changes made in other tabs
 *
 * The module is an ES module; all document/window listeners register once
 * and persist for the session. The AbortController only guards the per-element
 * toggle listener, which re-binds on each init() call.
 */

import { getPref, setPref, removePref, PREF_KEYS } from "@/lib/prefs";

const PAUSED_VALUE = "paused";
const NO_BLINK_ATTR = "data-no-blink";
const TOGGLE_ID = "cursor-blink-toggle";

let _blinkAc: AbortController | null = null;

function isPaused(): boolean {
	return getPref(PREF_KEYS.cursorBlink) === PAUSED_VALUE;
}

function applyPref(): void {
	if (isPaused()) {
		document.documentElement.setAttribute(NO_BLINK_ATTR, "");
	} else {
		document.documentElement.removeAttribute(NO_BLINK_ATTR);
	}
}

function setPaused(paused: boolean): void {
	if (paused) {
		setPref(PREF_KEYS.cursorBlink, PAUSED_VALUE);
	} else {
		removePref(PREF_KEYS.cursorBlink);
	}
	applyPref();
}

function init(): void {
	_blinkAc?.abort();
	_blinkAc = new AbortController();
	const { signal } = _blinkAc;

	const toggle = document.getElementById(TOGGLE_ID) as HTMLInputElement | null;
	if (!toggle) return;

	// Sync visual state to stored preference
	toggle.checked = isPaused();

	toggle.addEventListener("change", () => setPaused(toggle.checked), { signal });
}

// Apply immediately on module load (the is:inline <head> script covers the
// hard-load fast path; this handles any edge cases where it didn't run).
applyPref();

// Wire toggle on first load
init();

// Re-stamp data-no-blink before paint after each soft navigation.
// astro:after-swap fires before astro:page-load and before repaint.
document.addEventListener("astro:after-swap", applyPref);

// Re-sync toggle checkbox state after each navigation (sidebar re-renders).
document.addEventListener("astro:page-load", init);

// Cross-tab sync: storage event fires in all other tabs when localStorage changes.
window.addEventListener("storage", (e) => {
	if (e.key === PREF_KEYS.cursorBlink) {
		applyPref();
		const toggle = document.getElementById(TOGGLE_ID) as HTMLInputElement | null;
		if (toggle) toggle.checked = isPaused();
	}
});
