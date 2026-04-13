/**
 * Transition Manager
 *
 * Manages the user's stored transition style preference and the transitions pill UI.
 *
 * Responsibilities:
 *   getStoredTransition()    - read from localStorage; returns null if not set
 *   setStoredTransition()    - write to localStorage on explicit pill tap
 *   syncPills()              - update aria-pressed + active/mapped classes
 *   initTransitionPicker()   - attach pill click listeners
 *
 * Distinction: null = no preference (flavor mapping applies).
 *              "none" = user explicitly opted out of animations.
 *
 * BROWSER-ONLY. Import only from client-side <script> blocks.
 */

import { getPref, setPref, removePref, PREF_KEYS } from "@/lib/prefs";
import { type TransitionStyle, TRANSITION_STYLES } from "@/scripts/transitionRegistry";

// ─── Pref read/write ─────────────────────────────────────────────────────────

/** Return the stored transition preference, or null if not explicitly set. */
export function getStoredTransition(): TransitionStyle | null {
	const stored = getPref(PREF_KEYS.transition);
	if (stored && (TRANSITION_STYLES as readonly string[]).includes(stored)) {
		return stored as TransitionStyle;
	}
	return null;
}

/** Persist an explicit transition preference. Pass null to clear (revert to flavor mapping). */
export function setStoredTransition(style: TransitionStyle | null): void {
	if (style === null) {
		removePref(PREF_KEYS.transition);
	} else {
		setPref(PREF_KEYS.transition, style);
	}
}

// ─── UI sync ─────────────────────────────────────────────────────────────────

/** CSS class on the pill button that represents a mapped suggestion (not the persisted active). */
const MAPPED_CLASS = "nav-transition-pill--mapped";
/** CSS class on the pill button that is the actively persisted preference. */
const ACTIVE_CLASS = "nav-transition-pill--active";

/**
 * Sync pill buttons to reflect the stored preference and the optionally suggested mapping.
 *
 * activeStyle - the stored persisted preference (may be null).
 * mappedStyle - the flavor's mapped suggestion for the current switch (may be null).
 *
 * Only the pill matching activeStyle gets aria-pressed="true".
 * The pill matching mappedStyle (when different from activeStyle) gets the mapped glow class.
 */
export function syncPills(activeStyle: TransitionStyle | null, mappedStyle?: TransitionStyle | null): void {
	document.querySelectorAll<HTMLButtonElement>("[data-transition-btn]").forEach((btn) => {
		const btnStyle = btn.dataset.transitionBtn as TransitionStyle | undefined;
		if (!btnStyle) return;

		const isActive = btnStyle === activeStyle;
		const isMapped = !isActive && btnStyle === mappedStyle;

		btn.setAttribute("aria-pressed", String(isActive));
		btn.classList.toggle(ACTIVE_CLASS, isActive);
		btn.classList.toggle(MAPPED_CLASS, isMapped);
	});
}

// ─── Picker init ─────────────────────────────────────────────────────────────

/**
 * Wire transition pill click listeners.
 *
 * On click: persist the style to localStorage, sync all pills.
 * The click does NOT trigger a transition animation (the preference is used
 * on the next flavor/theme switch).
 *
 * Call on astro:page-load. Pass an AbortSignal for cleanup on soft navigation.
 */
export function initTransitionPicker(signal: AbortSignal): void {
	syncPills(getStoredTransition());

	document.querySelectorAll<HTMLButtonElement>("[data-transition-btn]").forEach((btn) => {
		btn.addEventListener(
			"click",
			() => {
				const raw = btn.dataset.transitionBtn ?? "";
				if (!(TRANSITION_STYLES as readonly string[]).includes(raw)) return;
				const style = raw as TransitionStyle;
				setStoredTransition(style);
				syncPills(style);
			},
			{ signal }
		);
	});
}
