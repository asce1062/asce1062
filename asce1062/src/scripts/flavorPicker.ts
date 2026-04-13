/**
 * Flavor Picker
 *
 * Entry script that wires the sidebar flavor swatch buttons to the flavor system.
 *
 * Lifecycle:
 *   Module load      → applyStoredFlavor() (stamp data-flavor before first paint)
 *   astro:after-swap → re-stamp data-flavor on soft navigation (before paint)
 *   astro:page-load  → initFlavorPicker() (re-attach swatch button listeners)
 *
 * Cross-tab sync is handled implicitly: each page load reads localStorage fresh.
 *
 * State management:
 *   - localStorage is the source of truth for persistence. It holds either "light", "dark", or "" (default).
 *   - data-flavor on <html> is the live DOM state that controls CSS. It is updated by setFlavor() and on astro:after-swap.
 *
 * BROWSER-ONLY. Import only from client-side <script> blocks.
 */

import { applyStoredFlavor, initFlavorPicker } from "@/scripts/flavorManager";

let _ac: AbortController | null = null;

function init(): void {
	_ac?.abort();
	_ac = new AbortController();
	initFlavorPicker(_ac.signal);
}

// Apply stored flavor at module load and on every soft navigation.
applyStoredFlavor();
init();

document.addEventListener("astro:after-swap", applyStoredFlavor);
document.addEventListener("astro:page-load", init);
