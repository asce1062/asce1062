/**
 * Sidebar ASCII Easter Egg
 *
 * Thin wrapper around setupAsciiWidget for the sidebar easter egg.
 * Passes .nav-easter-egg as the animation container so the sidebar-specific
 * egg-flicker CSS fires on the whole section (not just the art-wrap).
 * Updates the brand name badge on dice click.
 *
 * The egg sits at the bottom of the sidebar (and inside the closed drawer on
 * mobile), so its art is loaded and drawn only when it comes near the viewport.
 */

import { setupAsciiWidget } from "@/scripts/asciiWidget";
import type { AsciiRevealTeardown } from "@/scripts/asciiWidget";
import { loadGreetingVariants } from "@/scripts/asciiGreetings";

let _teardown: AsciiRevealTeardown | null = null;

function initSidebarEgg(): void {
	_teardown?.();
	_teardown = null;

	const brandName = document.getElementById("nav-brand-name");
	if (brandName) brandName.textContent = "alex";

	const container = document.querySelector<HTMLElement>(".nav-easter-egg");
	if (!container) return;

	let widgetTeardown: AsciiRevealTeardown | null = null;
	let active = true;
	const observer = new IntersectionObserver(
		(entries) => {
			if (!entries.some((e) => e.isIntersecting)) return;
			observer.disconnect();
			void loadGreetingVariants().then((variants) => {
				if (!active || !container.isConnected || variants.length === 0) return;
				widgetTeardown = setupAsciiWidget("nav-egg", {
					container,
					variants,
					onRender: (v, isDice) => {
						if (isDice && brandName) brandName.textContent = v.text.toLowerCase();
					},
				});
			});
		},
		{ rootMargin: "200px" }
	);
	observer.observe(container);

	_teardown = () => {
		active = false;
		observer.disconnect();
		widgetTeardown?.();
	};
}

document.addEventListener("astro:page-load", initSidebarEgg);
