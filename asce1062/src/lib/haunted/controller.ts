import type { HauntedOptions } from "./types";
import { CREATURES } from "./creatures";

const DEFAULT_CREATURE_OPTIONS = {
	animationTime: 1.5,
	numberOf: 6,
	distance: 200,
	repeat: true,
	dimensions: { width: 44, height: 44 },
} as const;

const DEFAULT_GLOW_OPTIONS = {
	animationTime: 3,
	boxShadowOff: "0px 0px 0px rgba(255,0,0,0)",
	boxShadowOn: "0px 0px 40px rgba(255,0,0,1)",
} as const;

function randomBetween(min: number, max: number): number {
	return Math.random() * (max - min) + min;
}

function randomIntFromInterval(min: number, max: number): number {
	return Math.floor(Math.random() * (max - min + 1) + min);
}

interface CreatureEl {
	wrap: HTMLElement;
	fly: HTMLElement;
	wave: HTMLElement;
}

/**
 * Mount Haunted effects on a container element.
 *
 * On mouseenter: creatures fly out from the container centre in evenly-spaced
 * directions and the container pulses with a box-shadow glow.
 * On mouseleave: glow fades back to off.
 *
 * Respects `prefers-reduced-motion` — both effects are skipped when the user
 * has requested reduced motion.
 *
 * Returns a cleanup function. Call it before unmounting or on page transitions
 * to remove listeners, cancel animations, and restore the DOM.
 */
export function bindHaunted(el: HTMLElement, opts: HauntedOptions = {}): () => void {
	const disableFun = opts.disableFun ?? false;
	const reducedMotion =
		typeof window !== "undefined" &&
		typeof window.matchMedia === "function" &&
		window.matchMedia("(prefers-reduced-motion: reduce)").matches;

	if (disableFun || reducedMotion) return () => {};

	const creature = opts.creature ?? "ghost";
	const cOpts = { ...DEFAULT_CREATURE_OPTIONS, ...opts.creatureOptions };
	if (opts.creatureOptions?.dimensions) {
		cOpts.dimensions = { ...DEFAULT_CREATURE_OPTIONS.dimensions, ...opts.creatureOptions.dimensions };
	}
	const gOpts = { ...DEFAULT_GLOW_OPTIONS, ...opts.glowOptions };

	// Ensure container is positioned so absolutely-placed creatures are contained
	let positionSet = false;
	if (typeof window !== "undefined" && window.getComputedStyle(el).position === "static") {
		el.style.position = "relative";
		positionSet = true;
	}

	// Creature layer sits behind the content (z-index 0, no pointer events)
	const creatureLayer = document.createElement("div");
	creatureLayer.className = "haunted-creatures";
	el.prepend(creatureLayer);

	const svgStr = CREATURES[creature];
	const n = Math.max(1, cOpts.numberOf);
	const creatureEls: CreatureEl[] = [];
	const canPlay: boolean[] = [];

	for (let i = 0; i < n; i++) {
		const wrap = document.createElement("div");
		wrap.className = "haunted-creature-wrap";

		const fly = document.createElement("div");
		fly.className = "haunted-creature-fly";

		const wave = document.createElement("div");
		wave.className = "haunted-creature-wave";
		wave.innerHTML = svgStr;

		const svgEl = wave.querySelector("svg");
		if (svgEl) {
			svgEl.setAttribute("width", String(cOpts.dimensions.width));
			svgEl.setAttribute("height", String(cOpts.dimensions.height));
		}

		fly.appendChild(wave);
		wrap.appendChild(fly);
		creatureLayer.appendChild(wrap);

		creatureEls.push({ wrap, fly, wave });
		canPlay.push(true);
	}

	let glowAnim: Animation | null = null;
	const pendingTimers: ReturnType<typeof setTimeout>[] = [];

	function getInitY(): number {
		const rect = el.getBoundingClientRect();
		return -Math.min(rect.width, rect.height) / 2;
	}

	function onMouseEnter(): void {
		// Looping glow pulse
		if (glowAnim) glowAnim.cancel();
		glowAnim = el.animate(
			[{ boxShadow: gOpts.boxShadowOff }, { boxShadow: gOpts.boxShadowOn }, { boxShadow: gOpts.boxShadowOff }],
			{ duration: gOpts.animationTime * 1000, iterations: Infinity, easing: "ease-in-out" }
		);

		const rect = el.getBoundingClientRect();
		const hw = cOpts.dimensions.width / 2;
		const hh = cOpts.dimensions.height / 2;
		// Center offset: position creature at container midpoint, adjusted for its own dimensions
		const cx = Math.round(rect.width / 2) - hw;
		const cy = Math.round(rect.height / 2) - hh;
		const rotStep = 360 / creatureEls.length;
		const initY = getInitY();
		const endY = cOpts.distance * -1 + initY;

		creatureEls.forEach(({ wrap, fly, wave }, i) => {
			if (!canPlay[i]) return;

			// If not repeating, retire this creature after this hover
			if (!cOpts.repeat) canPlay[i] = false;

			// Position wrapper at centre, rotated to this creature's spoke direction
			const rotation = (i + 1) * rotStep;
			wrap.style.transform = `translateX(${cx}px) translateY(${cy}px) rotate(${rotation}deg)`;
			wrap.style.display = "block";

			// Cancel any in-progress animations from a previous hover
			fly.getAnimations().forEach((a) => a.cancel());
			wave.getAnimations().forEach((a) => a.cancel());

			// Each creature gets a slightly randomized duration (like the React reference)
			const animMs = randomBetween(cOpts.animationTime / 2, cOpts.animationTime) * 1000;

			// Y travel: ease-out upward (in rotated space) — separate from opacity so timings differ
			fly.animate([{ transform: `translateY(${initY}px)` }, { transform: `translateY(${endY}px)` }], {
				duration: animMs,
				easing: "ease-out",
				fill: "forwards",
			});

			// Opacity: fade in fast (first 30%), fade out slowly (last 70%)
			fly.animate([{ opacity: 0 }, { opacity: 1, offset: 0.3 }, { opacity: 0 }], {
				duration: animMs,
				fill: "forwards",
			});

			// X oscillation (wave) on the inner div — independent of Y travel
			const waveAmt = randomIntFromInterval(5, 10);
			const waveCount = randomIntFromInterval(3, 5);
			const waveFrames: Keyframe[] = [];
			for (let w = 0; w < waveCount; w++) {
				waveFrames.push({ transform: `translateX(${waveAmt}px)` }, { transform: `translateX(${-waveAmt}px)` });
			}
			wave.animate(waveFrames, { duration: animMs });

			// Hide wrapper once animation finishes; clear fill-forwards state
			const timer = setTimeout(() => {
				wrap.style.display = "none";
				fly.getAnimations().forEach((a) => a.cancel());
				wave.getAnimations().forEach((a) => a.cancel());
			}, animMs);

			pendingTimers.push(timer);
		});
	}

	function onMouseLeave(): void {
		// Cancel the looping glow and fade box-shadow back to off
		if (glowAnim) {
			glowAnim.cancel();
			glowAnim = null;
		}
		el.animate([{ boxShadow: gOpts.boxShadowOff }], {
			duration: gOpts.animationTime * 1000,
			fill: "forwards",
		});

		// Re-arm all creatures for the next hover
		canPlay.fill(true);
	}

	el.addEventListener("mouseenter", onMouseEnter);
	el.addEventListener("mouseleave", onMouseLeave);

	return () => {
		el.removeEventListener("mouseenter", onMouseEnter);
		el.removeEventListener("mouseleave", onMouseLeave);
		if (glowAnim) glowAnim.cancel();
		el.getAnimations().forEach((a) => a.cancel());
		pendingTimers.forEach(clearTimeout);
		creatureEls.forEach(({ fly, wave }) => {
			fly.getAnimations().forEach((a) => a.cancel());
			wave.getAnimations().forEach((a) => a.cancel());
		});
		creatureLayer.remove();
		if (positionSet) el.style.removeProperty("position");
	};
}
