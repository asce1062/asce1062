import type { NavBrandEffect } from "@/lib/navBrand/state";
import { playTerminalTextEffect, resetTerminalTextEffect } from "@/lib/textEffects/terminalTextEffect";

export function resetNavBrandEffect(el: HTMLElement | null, rootEl?: HTMLElement | null): void {
	resetTerminalTextEffect(el, {
		rootEl,
		rootEffectDataset: "navbrandEffect",
	});
}

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
