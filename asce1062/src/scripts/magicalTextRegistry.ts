/**
 * Declarative MagicalText registry.
 *
 * Activates gradient-sweep + sparkle effects on any element with
 * `data-magical-text` in the markup. Handles Astro soft-navigation
 * by cleaning up rAF loops before each page swap and re-initializing
 * after the new DOM lands.
 *
 * Markup contract:
 *   data-magical-text                               activate (required)
 *   data-magical-text-colors="hotpink,purple,cyan"  comma-separated CSS colors
 *   data-magical-text-animation-time="10"           gradient cycle in seconds
 *   data-magical-text-adornment="star"              star | heart | ghost | ghost-alt
 *   data-magical-text-no-adornments                 presence → disable sparkles
 *   data-magical-text-adornment-count="3"
 *   data-magical-text-adornment-size="16"           width & height in px
 *   data-magical-text-adornment-opacity="0.7"       0–1
 *   data-magical-text-adornment-duration="1.25"     sparkle cycle in seconds
 *   data-magical-text-animation-type="sparkle"      sparkle | scale
 *
 * Usage:
 *   import '@/scripts/magicalTextRegistry';
 *   — or import via MagicalText.astro which includes it automatically.
 *
 * Adding a new adornment shape:
 *   See src/lib/shared/adornments.ts for step-by-step instructions.
 */

import type { AdornmentKind, AnimationType, MagicalTextOptions } from "@/lib/magicalText";
import { bindMagicalText } from "@/lib/magicalText";

function readMagicalTextConfig(el: HTMLElement): MagicalTextOptions {
	const opts: MagicalTextOptions = {};

	if (el.dataset.magicalTextColors) {
		const parsed = el.dataset.magicalTextColors
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean);
		if (parsed.length > 0) opts.colors = parsed;
	}

	const time = el.dataset.magicalTextAnimationTime ? Number.parseFloat(el.dataset.magicalTextAnimationTime) : NaN;
	if (Number.isFinite(time) && time > 0) opts.animationTime = time;

	if ("magicalTextNoAdornments" in el.dataset) opts.showAdornments = false;

	if (el.dataset.magicalTextAdornment) {
		opts.adornment = el.dataset.magicalTextAdornment as AdornmentKind;
	}

	const count = el.dataset.magicalTextAdornmentCount ? Number.parseInt(el.dataset.magicalTextAdornmentCount, 10) : NaN;
	if (Number.isFinite(count) && count > 0) opts.adornmentCount = count;

	const size = el.dataset.magicalTextAdornmentSize ? Number.parseFloat(el.dataset.magicalTextAdornmentSize) : NaN;
	if (Number.isFinite(size) && size > 0) opts.adornmentSize = size;

	const opacity = el.dataset.magicalTextAdornmentOpacity
		? Number.parseFloat(el.dataset.magicalTextAdornmentOpacity)
		: NaN;
	if (Number.isFinite(opacity)) opts.adornmentOpacity = Math.min(1, Math.max(0, opacity));

	const duration = el.dataset.magicalTextAdornmentDuration
		? Number.parseFloat(el.dataset.magicalTextAdornmentDuration)
		: NaN;
	if (Number.isFinite(duration) && duration > 0) opts.adornmentDuration = duration;

	if (el.dataset.magicalTextAnimationType) {
		opts.animationType = el.dataset.magicalTextAnimationType as AnimationType;
	}

	return opts;
}

const cleanupFns: (() => void)[] = [];

function initMagicalTextRegistry(): void {
	const elements = document.querySelectorAll<HTMLElement>("[data-magical-text]");
	for (const el of elements) {
		const opts = readMagicalTextConfig(el);
		cleanupFns.push(bindMagicalText(el, opts));
	}
}

function cleanupMagicalTextRegistry(): void {
	for (const fn of cleanupFns) fn();
	cleanupFns.length = 0;
}

document.addEventListener("astro:before-swap", cleanupMagicalTextRegistry);
document.addEventListener("astro:page-load", initMagicalTextRegistry);
