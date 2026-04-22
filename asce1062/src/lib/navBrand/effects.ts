/**
 * Navbrand-specific effect adapter.
 *
 * The motion engine is shared in `textEffects/terminalTextEffect`. This wrapper
 * exists so navbrand can keep its own root dataset contract
 * (`data-navbrand-effect`) while delegating sequencing, cancellation, reduced
 * motion, stable text caching, and paired transitions to the generic engine.
 *
 * Navbrand still chooses only the *enter* effect through state policy
 * (`typing`, `decrypt`, etc.). If the greeting text changed, this adapter asks
 * the shared engine for the paired exit effect, so `typing` becomes:
 *
 *   previous greeting -> backspace -> next greeting -> typing
 *
 * This is why `renderNavBrand()` should not reset the greeting before calling
 * `playNavBrandEffect`; the previous stable text is needed for the exit phase.
 */
import type { NavBrandEffect } from "@/lib/navBrand/state";
import {
	getTerminalTextEffectMetadata,
	getPairedTerminalTextEffect,
	runTerminalTextTransition,
	resetTerminalTextEffect,
} from "@/lib/textEffects/terminalTextEffect";

export function resetNavBrandEffect(el: HTMLElement | null, rootEl?: HTMLElement | null): void {
	resetTerminalTextEffect(el, {
		rootEl,
		rootEffectDataset: "navbrandEffect",
	});
}

/** Play a selected navbrand effect while preserving navbrand-specific root attributes. */
export function playNavBrandEffect(options: {
	el: HTMLElement | null;
	rootEl?: HTMLElement | null;
	effect: NavBrandEffect;
	text: string;
	onComplete?: () => void;
}): boolean {
	const { el, rootEl, effect, text, onComplete } = options;
	const fromText = el?.dataset.textEffectStableText ?? el?.dataset.greetingTarget ?? el?.textContent ?? text;
	const targetChanged = Boolean(el && fromText && fromText !== text);
	const metadata = effect !== "none" ? getTerminalTextEffectMetadata(effect) : null;
	const enterEffect = metadata?.role === "enter" ? effect : "none";
	const exitEffect =
		effect !== "none" && targetChanged
			? getPairedTerminalTextEffect(effect, "exit")
			: metadata?.role === "exit"
				? effect
				: "none";

	void runTerminalTextTransition({
		el,
		rootEl,
		rootEffectDataset: "navbrandEffect",
		mode:
			effect !== "none" && targetChanged ? "full-transition" : metadata?.role === "exit" ? "standalone" : "enter-only",
		enterEffect,
		exitEffect,
		fromText,
		toText: text,
		onComplete,
	});

	return effect !== "none";
}
