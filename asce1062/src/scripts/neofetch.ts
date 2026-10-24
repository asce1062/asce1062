/**
 * Neofetch Widget
 *
 * Thin wrapper around setupAsciiWidget for the neofetch widget.
 * Updates the sidebar brand name badge on dice click when present.
 */

import { setupAsciiWidget } from "@/scripts/asciiWidget";
import type { AsciiRevealTeardown } from "@/scripts/asciiWidget";

let _teardown: AsciiRevealTeardown | null = null;

function initNeofetch(): void {
	_teardown?.();
	_teardown = null;

	// The listener outlives /about (module scripts run once per session): do
	// nothing on pages without the widget, or every later page reset the brand
	// name set by the sidebar egg and re-ran the 404 page's own neofetch setup.
	const widget = document.getElementById("neofetch");
	if (!widget || widget.closest("[data-page-404]")) return; // 404 sets up its own

	const brandName = document.getElementById("nav-brand-name");
	if (brandName) brandName.textContent = "alex";

	_teardown = setupAsciiWidget("neofetch", {
		onRender: (v, isDice) => {
			if (isDice && brandName) brandName.textContent = v.text.toLowerCase();
		},
	});
}

document.addEventListener("astro:page-load", initNeofetch);
