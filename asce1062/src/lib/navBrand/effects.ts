/**
 * Navbrand-specific effect adapter.
 *
 * The actual typing/decrypt engine is shared in `textEffects/terminalTextEffect`.
 * This wrapper exists so navbrand can keep its own dataset contract
 * (`data-navbrand-effect`) without duplicating playback logic.
 */
import type { NavBrandEffect } from "@/lib/navBrand/state";
import { playTerminalTextEffect, resetTerminalTextEffect } from "@/lib/textEffects/terminalTextEffect";

export function resetNavBrandEffect(el: HTMLElement | null, rootEl?: HTMLElement | null): void {
	resetTerminalTextEffect(el, {
		rootEl,
		rootEffectDataset: "navbrandEffect",
	});
}

/** Play a selected effect while preserving navbrand-specific root attributes. */
export function playNavBrandEffect(options: {
	el: HTMLElement | null;
	rootEl?: HTMLElement | null;
	effect: NavBrandEffect;
	text: string;
	onComplete?: () => void;
}): boolean {
	const { el, rootEl, effect, text, onComplete } = options;
	return playTerminalTextEffect({
		el,
		rootEl,
		rootEffectDataset: "navbrandEffect",
		effect,
		text,
		onComplete,
	});
}
