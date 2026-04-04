/**
 * Stars Background
 *
 * Wires the sidebar "Stars" toggle to the animated star field GIF background.
 *
 * When enabled: stamps data-stars-bg on <html>, which triggers CSS to apply
 * /images/stars.anim.gif as the body background, overriding the topography texture.
 * When disabled: removes data-stars-bg, reverting to the themed topography background.
 *
 * localStorage key: "stars-bg" - "1" when enabled; absent when disabled.
 *
 * Mutual exclusion with Matrix: enabling Stars dispatches "background:activate"
 * with detail "stars". matrixBackground.ts listens and fully disables itself
 * (stops RAF loop, removes canvas). The same event (detail "matrix") triggers
 * this script to fully disable itself.
 *
 * Lifecycle pattern mirrors cursorBlink.ts and matchDeviceTheme.ts:
 *   Module load      → applyPref() - immediate attribute application
 *   astro:after-swap → re-stamp before paint on soft navigation
 *   astro:page-load  → init() - sync toggle checkbox and re-attach listener
 *   storage event    → cross-tab sync
 *   background:activate (detail "matrix") → full self-disable
 *
 * BROWSER-ONLY. Import only from client-side <script> blocks.
 */

import { getPref, setPref, removePref, PREF_KEYS } from "@/lib/prefs";

const TOGGLE_ID = "stars-background-toggle";
const ACTIVE_ATTR = "data-stars-bg";

function isActive(): boolean {
	return getPref(PREF_KEYS.starsBackground) === "1";
}

function enable(): void {
	document.documentElement.setAttribute(ACTIVE_ATTR, "");
}

function disable(): void {
	document.documentElement.removeAttribute(ACTIVE_ATTR);
}

function applyPref(): void {
	if (isActive()) {
		enable();
	} else {
		disable();
	}
}

let _ac: AbortController | null = null;

function init(): void {
	// Clean up previous navigation's listeners before re-registering.
	_ac?.abort();
	_ac = new AbortController();
	const { signal } = _ac;

	const toggle = document.getElementById(TOGGLE_ID) as HTMLInputElement | null;
	if (!toggle) return;

	// Reflect persisted state in the checkbox.
	toggle.checked = isActive();

	toggle.addEventListener(
		"change",
		() => {
			if (toggle.checked) {
				setPref(PREF_KEYS.starsBackground, "1");
				// Notify matrix to fully disable itself (stop RAF + remove canvas).
				document.dispatchEvent(new CustomEvent("background:activate", { detail: "stars" }));
			} else {
				removePref(PREF_KEYS.starsBackground);
			}
			applyPref();
		},
		{ signal }
	);
}

// Apply at module load.
applyPref();
init();

// Re-stamp attribute before the new page's content becomes visible on soft nav.
document.addEventListener("astro:after-swap", applyPref);

// Re-sync toggle checkbox and re-attach listener after each navigation.
document.addEventListener("astro:page-load", init);

// Cross-tab sync: another tab changed the preference.
window.addEventListener("storage", (e) => {
	if (e.key === PREF_KEYS.starsBackground) {
		applyPref();
		const toggle = document.getElementById(TOGGLE_ID) as HTMLInputElement | null;
		if (toggle) toggle.checked = isActive();
	}
	// If matrix was enabled in another tab, disable stars here too.
	if (e.key === PREF_KEYS.matrixBackground && e.newValue === "1") {
		removePref(PREF_KEYS.starsBackground);
		disable();
		const toggle = document.getElementById(TOGGLE_ID) as HTMLInputElement | null;
		if (toggle) toggle.checked = false;
	}
});

// Mutual exclusion: matrix was activated in this tab — fully disable stars.
document.addEventListener("background:activate", (e) => {
	if ((e as CustomEvent).detail !== "matrix") return;
	removePref(PREF_KEYS.starsBackground);
	disable();
	const toggle = document.getElementById(TOGGLE_ID) as HTMLInputElement | null;
	if (toggle) toggle.checked = false;
});
