/**
 * Declarative Haunted registry.
 *
 * Activates creature fly-out and glow effects on any element with
 * `data-haunted` in the markup. Handles Astro soft-navigation by
 * cleaning up animations before each page swap and re-initializing
 * after the new DOM lands.
 *
 * Markup contract:
 *   data-haunted                                  activate (required)
 *   data-haunted-creature="ghost"                 ghost | ghost-alt | heart | star
 *   data-haunted-disable-fun                      presence → disable all effects (glow and creatures)
 *   data-haunted-disable-glow                     presence → disable only the glow, independent of disable-fun
 *   data-haunted-disable-creatures                presence → disable only the creature fly-out, independent of disable-fun
 *   data-haunted-animation-time="1.5"             creature fly duration (s)
 *   data-haunted-number-of="6"                    number of creatures
 *   data-haunted-distance="200"                   travel distance (px)
 *   data-haunted-no-repeat                        presence → one-shot per page load
 *   data-haunted-width="44"                       creature width (px)
 *   data-haunted-height="44"                      creature height (px)
 *   data-haunted-glow-animation-time="3"          glow cycle (s)
 *   data-haunted-glow-off="0px 0px 0px rgba(…)"  box-shadow at lowest glow point
 *   data-haunted-glow-on="0px 0px 40px rgba(…)"  box-shadow at highest glow point
 *   data-haunted-creature-colors="#f00,#0f0,#00f"  creature fill colors (comma-separated CSS)
 */

import type { CreatureKind, HauntedOptions } from "@/lib/haunted";
import { bindHaunted } from "@/lib/haunted";
import { CREATURES } from "@/lib/haunted/creatures";

function readHauntedConfig(el: HTMLElement): HauntedOptions {
	const opts: HauntedOptions = {};

	// Unknown kinds fall back to the default: an unknown key used to throw inside
	// bindHaunted and abort initialisation for every later element on the page.
	const creature = el.dataset.hauntedCreature;
	if (creature && Object.hasOwn(CREATURES, creature)) {
		opts.creature = creature as CreatureKind;
	}

	if ("hauntedDisableFun" in el.dataset) {
		opts.disableFun = true;
	}

	if ("hauntedDisableGlow" in el.dataset) {
		opts.disableGlow = true;
	}

	if ("hauntedDisableCreatures" in el.dataset) {
		opts.disableCreatures = true;
	}

	const creatureOptions: NonNullable<HauntedOptions["creatureOptions"]> = {};

	const animTime = Number.parseFloat(el.dataset.hauntedAnimationTime ?? "");
	if (Number.isFinite(animTime) && animTime > 0) creatureOptions.animationTime = animTime;

	const numberOf = Number.parseInt(el.dataset.hauntedNumberOf ?? "", 10);
	if (Number.isFinite(numberOf) && numberOf > 0) creatureOptions.numberOf = numberOf;

	const distance = Number.parseFloat(el.dataset.hauntedDistance ?? "");
	if (Number.isFinite(distance) && distance > 0) creatureOptions.distance = distance;

	if ("hauntedNoRepeat" in el.dataset) creatureOptions.repeat = false;

	const width = Number.parseFloat(el.dataset.hauntedWidth ?? "");
	const height = Number.parseFloat(el.dataset.hauntedHeight ?? "");
	if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
		creatureOptions.dimensions = { width, height };
	}

	if (el.dataset.hauntedCreatureColors) {
		creatureOptions.colors = el.dataset.hauntedCreatureColors.split(",").map((c) => c.trim());
	}

	if (Object.keys(creatureOptions).length > 0) opts.creatureOptions = creatureOptions;

	const glowOptions: NonNullable<HauntedOptions["glowOptions"]> = {};

	const glowTime = Number.parseFloat(el.dataset.hauntedGlowAnimationTime ?? "");
	if (Number.isFinite(glowTime) && glowTime > 0) glowOptions.animationTime = glowTime;

	if (el.dataset.hauntedGlowOff) glowOptions.boxShadowOff = el.dataset.hauntedGlowOff;
	if (el.dataset.hauntedGlowOn) glowOptions.boxShadowOn = el.dataset.hauntedGlowOn;

	if (Object.keys(glowOptions).length > 0) opts.glowOptions = glowOptions;

	return opts;
}

const cleanupFns: (() => void)[] = [];

function initHauntedRegistry(): void {
	const elements = document.querySelectorAll<HTMLElement>("[data-haunted]");
	for (const el of elements) {
		cleanupFns.push(bindHaunted(el, readHauntedConfig(el)));
	}
}

function cleanupHauntedRegistry(): void {
	for (const fn of cleanupFns) fn();
	cleanupFns.length = 0;
}

document.addEventListener("astro:before-swap", cleanupHauntedRegistry);
document.addEventListener("astro:page-load", initHauntedRegistry);
