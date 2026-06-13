import type { MagicalTextOptions } from "./types";
import type { AdornmentKind } from "../shared/adornments";
import type { RGBColor } from "../shared/colorUtils";
import { ADORNMENTS } from "../shared/adornments";
import { multiColorFade } from "../shared/colorUtils";

const DEFAULT_COLORS = ["darkorange", "purple"];
const DEFAULT_ANIMATION_TIME = 10;
const DEFAULT_ADORNMENT_COUNT = 3;
const DEFAULT_ADORNMENT_SIZE = 16;
const DEFAULT_ADORNMENT_OPACITY = 0.7;
const DEFAULT_ADORNMENT_DURATION = 1.25;

function randomBetween(min: number, max: number): number {
	return Math.random() * (max - min) + min;
}

/**
 * Mount MagicalText on an element.
 *
 * Replaces the element's text content with a gradient-sweep span and optional
 * floating sparkle adornments. The gradient is pure CSS; sparkle lifecycle
 * (positioning, color tracking) is driven by a requestAnimationFrame loop.
 *
 * a 200-step RGB table maps each sparkle's horizontal position + current
 * gradient offset to the gradient color at that screen position.
 *
 * Returns a cleanup function. Call it before unmounting or on page transitions
 * to cancel the rAF loop and restore the original element content.
 */
export function bindMagicalText(el: HTMLElement, opts: MagicalTextOptions = {}): () => void {
	const colors = opts.colors && opts.colors.length > 0 ? opts.colors : DEFAULT_COLORS;
	const animTimeS = opts.animationTime ?? DEFAULT_ANIMATION_TIME;
	const animTimeMs = animTimeS * 1000;
	const showAdornments = opts.showAdornments !== false;
	const adornmentKind: AdornmentKind = opts.adornment ?? "star";
	const count = Math.max(1, opts.adornmentCount ?? DEFAULT_ADORNMENT_COUNT);
	const size = opts.adornmentSize ?? DEFAULT_ADORNMENT_SIZE;
	const opacity = Math.min(1, Math.max(0, opts.adornmentOpacity ?? DEFAULT_ADORNMENT_OPACITY));
	const durationS = opts.adornmentDuration ?? DEFAULT_ADORNMENT_DURATION;

	const adornmentConfig = ADORNMENTS[adornmentKind];
	const animType = opts.animationType ?? adornmentConfig.animationType;

	const reducedMotion =
		typeof window !== "undefined" &&
		typeof window.matchMedia === "function" &&
		window.matchMedia("(prefers-reduced-motion: reduce)").matches;

	const originalInnerHTML = el.innerHTML;

	el.innerHTML = "";
	el.classList.add("magical-text-container");

	const inner = document.createElement("span");
	inner.className = "magical-text-inner";
	inner.textContent = el.dataset.magicalTextOriginal ?? originalInnerHTML;
	inner.style.setProperty("--mt-colors", colors.join(", "));
	inner.style.setProperty("--mt-time", `${animTimeS}s`);
	el.appendChild(inner);

	// Store original so re-runs don't accumulate wrappers
	el.dataset.magicalTextOriginal = inner.textContent ?? "";

	let rafId: number | null = null;

	interface SparkleState {
		wrapper: HTMLElement;
		pathEl: SVGPathElement | null;
	}

	const sparkleStates: SparkleState[] = [];

	if (!reducedMotion && showAdornments) {
		const adornmentContainer = document.createElement("span");
		adornmentContainer.className = "magical-text-adornments";
		adornmentContainer.setAttribute("aria-hidden", "true");
		el.appendChild(adornmentContainer);

		let fadeTable: RGBColor[] | null = null;
		if (adornmentConfig.colorTracked) {
			fadeTable = multiColorFade(colors, 200);
		}

		for (let i = 0; i < count; i++) {
			const wrapper = document.createElement("span");
			wrapper.className = "magical-text-sparkle";
			wrapper.dataset.animation = animType;
			wrapper.style.setProperty("--mt-sparkle-duration", `${durationS}s`);
			wrapper.style.width = `${size}px`;
			wrapper.style.height = `${size}px`;
			wrapper.style.opacity = String(opacity);
			// Stagger start times so sparkles aren't synchronized
			wrapper.style.animationDelay = `${-(i / count) * durationS}s`;
			wrapper.innerHTML = adornmentConfig.svg;
			adornmentContainer.appendChild(wrapper);

			const x = randomBetween(0.05, 0.95);
			wrapper.dataset.x = String(x);
			wrapper.style.left = `${x * 100}%`;
			wrapper.style.top = `${randomBetween(-20, 110)}%`;

			const pathEl = adornmentConfig.colorTracked
				? (wrapper.querySelector("[data-sparkle-path]") as SVGPathElement | null)
				: null;

			wrapper.addEventListener("animationiteration", () => {
				const newX = randomBetween(0.05, 0.95);
				wrapper.dataset.x = String(newX);
				wrapper.style.left = `${newX * 100}%`;
				wrapper.style.top = `${randomBetween(-20, 110)}%`;
			});

			sparkleStates.push({ wrapper, pathEl });
		}

		if (fadeTable && sparkleStates.some((s) => s.pathEl !== null)) {
			const startTime = performance.now();

			const frame = (now: number) => {
				const elapsed = now - startTime;
				const animProgress = (elapsed % animTimeMs) / animTimeMs;
				const fadeOffset = animProgress * 200;

				for (const { wrapper, pathEl } of sparkleStates) {
					if (!pathEl) continue;
					const xPos = wrapper.dataset.x ? Number(wrapper.dataset.x) : 0.5;
					let tableIdx = Math.round(200 - fadeOffset + xPos * 100);
					if (tableIdx >= 200) tableIdx -= 200;
					if (tableIdx < 0) tableIdx += 200;
					const c = fadeTable![tableIdx]!;
					pathEl.setAttribute("fill", `rgb(${Math.round(c.r)},${Math.round(c.g)},${Math.round(c.b)})`);
				}

				rafId = requestAnimationFrame(frame);
			};

			rafId = requestAnimationFrame(frame);
		}
	}

	return () => {
		if (rafId !== null) {
			cancelAnimationFrame(rafId);
			rafId = null;
		}
		el.innerHTML = el.dataset.magicalTextOriginal ?? originalInnerHTML;
		el.classList.remove("magical-text-container");
		delete el.dataset.magicalTextOriginal;
	};
}
