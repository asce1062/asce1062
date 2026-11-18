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

// Identifies the latest switch, so frames queued by an earlier one cannot lift
// the freeze while a newer switch is still waiting for its repaint.
let _switchId = 0;

/** Apply a theme/flavor DOM change so every element repaints in the same frame. */
export function atomicSwitch(apply: () => void): void {
	const root = document.documentElement;
	const switchId = ++_switchId;
	root.setAttribute("data-theme-switching", "");
	apply();
	requestAnimationFrame(() => {
		requestAnimationFrame(() => {
			if (switchId === _switchId) root.removeAttribute("data-theme-switching");
		});
	});
}
