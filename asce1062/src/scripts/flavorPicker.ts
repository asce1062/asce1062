/**
 * Flavor Picker
 *
 * Entry script that wires the sidebar flavor swatch buttons to the flavor system.
 *
 * Lifecycle:
 *   Module load      → apply URL flavor override or stored flavor before paint
 *   astro:after-swap → re-stamp URL override or stored flavor before new page paint
 *   astro:page-load  → initFlavorPicker() (re-attach swatch button listeners)
 *
 * Cross-tab sync is handled implicitly: each page load reads localStorage fresh.
 *
 * State management:
 *   - URL ?flavor= sets the current user flavor selection.
 *   - localStorage is the source of truth for persistence. It holds a flavor id; absent means default warm void.
 *   - data-flavor on <html> is the live DOM state that controls CSS. It is updated by setFlavor() and on astro:after-swap.
 *
 * BROWSER-ONLY. Import only from client-side <script> blocks.
 */

import { applyStoredFlavor, initFlavorPicker, setFlavor } from "@/scripts/flavorManager";
import { getFlavorFromUrl } from "@/scripts/themeManager";

let _ac: AbortController | null = null;

function init(): void {
	_ac?.abort();
	_ac = new AbortController();
	initFlavorPicker(_ac.signal);
}

function applyUrlOrStoredFlavor(): void {
	const urlFlavor = getFlavorFromUrl();
	if (urlFlavor !== null) {
		setFlavor(urlFlavor, { emitEvent: false });
		return;
	}

	applyStoredFlavor();
}

// Apply URL override or stored flavor at module load and on every soft navigation.
applyUrlOrStoredFlavor();
init();

document.addEventListener("astro:after-swap", applyUrlOrStoredFlavor);
document.addEventListener("astro:page-load", init);
