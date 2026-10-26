/**
 * Theme Transition Utility
 *
 * When data-theme or data-flavor changes, CSS variables cascade immediately,
 * but per-element transition rules repaint at different rates (a stagger wave).
 * atomicSwitch() stamps data-theme-switching on <html>, which global.css uses to
 * freeze every transition and animation, applies the change, then lifts the
 * freeze after 2 rAFs (one repaint cycle) so the whole page repaints in one frame.
 *
 * BROWSER-ONLY. Import only from client-side <script> blocks.
 */

/** Apply a theme/flavor DOM change so every element repaints in the same frame. */
export function atomicSwitch(apply: () => void): void {
	const root = document.documentElement;
	root.setAttribute("data-theme-switching", "");
	apply();
	requestAnimationFrame(() => {
		requestAnimationFrame(() => root.removeAttribute("data-theme-switching"));
	});
}
