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

	const brandName = document.getElementById("nav-brand-name");
	if (brandName) brandName.textContent = "alex";

	_teardown = setupAsciiWidget("neofetch", {
		onRender: (v, isDice) => {
			if (isDice && brandName) brandName.textContent = v.text.toLowerCase();
		},
	});
}

document.addEventListener("astro:page-load", initNeofetch);
