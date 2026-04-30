/**
 * Navbrand cursor/root presentation helpers.
 *
 * These helpers bridge state decisions into lightweight DOM attributes/classes.
 * CSS owns the actual visual treatment so cursor behavior can stay mostly
 * declarative and reduced-motion-friendly.
 */
import type { NavBrandState } from "@/lib/navBrand/state";

export type NavBrandTone = "normal" | "rare";

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
