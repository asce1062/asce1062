/**
 * Sidebar ASCII Easter Egg
 *
 * Thin wrapper around setupAsciiWidget for the sidebar easter egg.
 * Passes .nav-easter-egg as the animation container so the sidebar-specific
 * egg-flicker CSS fires on the whole section (not just the art-wrap).
 * Updates the brand name badge on dice click.
 */

import { setupAsciiWidget } from "@/scripts/asciiWidget";
import type { AsciiRevealTeardown } from "@/scripts/asciiWidget";

let _teardown: AsciiRevealTeardown | null = null;

function initSidebarEgg(): void {
	_teardown?.();
	_teardown = null;

	const brandName = document.getElementById("nav-brand-name");
	if (brandName) brandName.textContent = "alex";

	const container = document.querySelector<HTMLElement>(".nav-easter-egg");

	_teardown = setupAsciiWidget("nav-egg", {
		container,
		onRender: (v, isDice) => {
			if (isDice && brandName) brandName.textContent = v.text.toLowerCase();
		},
	});
}

document.addEventListener("astro:page-load", initSidebarEgg);
