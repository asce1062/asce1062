/**
 * Navbrand cursor/root presentation helpers.
 *
 * These helpers bridge state decisions into lightweight DOM attributes/classes.
 * CSS owns the actual visual treatment so cursor behavior can stay mostly
 * declarative and reduced-motion-friendly.
 */
import type { NavBrandState } from "@/lib/navBrand/state";

export type CursorMode = "active" | "idle" | "return" | "system" | "paused";
export type NavBrandTone = "normal" | "rare";

/** Maps state to a cursor mode without directly touching DOM. */
export function getCursorModeForState(state: NavBrandState, reducedMotion: boolean): CursorMode {
	if (reducedMotion) return "paused";
	if (state === "idle") return "idle";
	if (state === "return") return "return";
	if (state === "system") return "system";
	return "active";
}

/** Cursor playback is still CSS-driven; JS only applies the mode contract. */
export function applyCursorMode(cursorEl: HTMLElement | null, mode: CursorMode): void {
	if (!cursorEl) return;

	cursorEl.dataset.cursorMode = mode;
	if (mode === "paused") {
		cursorEl.classList.remove("blink");
	} else {
		cursorEl.classList.add("blink");
	}
}

/** Root data attributes are the public contract for navbrand CSS state styling. */
export function applyNavBrandPresentation(
	rootEl: HTMLElement | null,
	options: {
		state: NavBrandState;
		effect?: string;
		tone?: NavBrandTone;
	}
): void {
	if (!rootEl) return;

	rootEl.dataset.navbrandState = options.state;
	rootEl.dataset.navbrandEffect = options.effect ?? "none";
	rootEl.dataset.navbrandTone = options.tone ?? "normal";
}
