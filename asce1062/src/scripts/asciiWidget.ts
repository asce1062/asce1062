/**
 * ASCII Widget Initializer
 *
 * Centralizes shared init logic for all AsciiWidget instances:
 * variant parsing, random pick (no-repeat), render (art + font label +
 * data-ascii-current), dice wiring, and asciiReveal setup.
 *
 * Usage:
 *   const teardown = setupAsciiWidget("neofetch");
 *   const teardown = setupAsciiWidget("neofetch", { replayOnDice: true });
 *   const teardown = setupAsciiWidget("nav-egg", {
 *     container: document.querySelector(".nav-easter-egg"),
 *     onRender: (v, isDice) => { if (isDice) brandEl.textContent = v.text; },
 *   });
 *
 * Options:
 *   container    Override animation container. Defaults to `{widgetId}-wrap`.
 *   replayOnDice Replay animation immediately on dice click. Default: false.
 *   onRender     Called after each render. isDice is false on initial render.
 */

import { setupAsciiReveal } from "@/scripts/asciiReveal";
import type { AsciiRevealTeardown } from "@/scripts/asciiReveal";

export type { AsciiRevealTeardown };

export interface AsciiVariant {
	text: string;
	font: string;
	art: string;
}

export interface AsciiWidgetOptions {
	/** Override animation container. Defaults to `{widgetId}-wrap`. */
	container?: HTMLElement | null;
	/** Replay animation immediately on dice click (e.g. 404 page). Default: false. */
	replayOnDice?: boolean;
	/** Called after each render. isDice is false on the initial render. */
	onRender?: (v: AsciiVariant, isDice: boolean) => void;
}

export function setupAsciiWidget(widgetId: string, opts: AsciiWidgetOptions = {}): AsciiRevealTeardown | null {
	const widgetEl = document.getElementById(widgetId) as HTMLElement | null;
	const dataEl = document.getElementById(`${widgetId}-data`) as HTMLElement | null;
	const artEl = document.getElementById(`${widgetId}-art`) as HTMLElement | null;
	const fontEl = document.getElementById(`${widgetId}-font`) as HTMLElement | null;
	const wrapEl = document.getElementById(`${widgetId}-wrap`) as HTMLElement | null;
	const btn = document.getElementById(`${widgetId}-randomize`) as HTMLElement | null;

	const container = opts.container ?? wrapEl;

	if (!widgetEl || !dataEl || !artEl || !fontEl || !container) return null;

	const variants: AsciiVariant[] = JSON.parse(dataEl.dataset.variants ?? "[]");
	if (!variants.length) return null;

	let current = -1;

	function pick(): AsciiVariant {
		let idx: number;
		do {
			idx = Math.floor(Math.random() * variants.length);
		} while (idx === current && variants.length > 1);
		current = idx;
		return variants[idx]!;
	}

	function render(v: AsciiVariant, isDice: boolean): void {
		artEl!.textContent = v.art.trimEnd();
		fontEl!.textContent = `[${v.font}]`;
		widgetEl!.dataset.asciiCurrent = JSON.stringify({ text: v.text, font: v.font, art: v.art.trimEnd() }, null, 2);
		opts.onRender?.(v, isDice);
	}

	render(pick(), false);

	// Render wired before setupAsciiReveal so it fires first on dice click.
	btn?.addEventListener("click", () => {
		const icon = btn.querySelector(".icon-dice") as HTMLElement | null;

		if (icon) {
			icon.classList.remove("spin");
			void icon.offsetWidth;
			icon.classList.add("spin");

			icon.addEventListener(
				"animationend",
				() => {
					icon.classList.remove("spin");
				},
				{ once: true }
			);
		}

		render(pick(), true);
	});

	return setupAsciiReveal(artEl, container, { diceBtn: btn, replayOnDice: opts.replayOnDice });
}
