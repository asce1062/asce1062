/**
 * Table of Contents
 *
 * Controls scroll-based hide/show of #toc-container and closes #toc-details
 * on link click.
 *
 * Key design decisions
 * ─────────────────────────────────────────────────────────────────────────────
 * No hardcoded top-zone pixel constant.
 *   The content above #toc-container varies significantly: the header, post
 *   title, optional preview image (h-72 = 288px), tags, and hr all contribute
 *   to a natural offsetTop somewhere between ~300px and ~650px depending on the
 *   post. Any fixed TOP_ZONE_PX constant is wrong for at least some posts.
 *   Instead, we check getBoundingClientRect().top in every rAF tick:
 *     > STICKY_TOP_PX  → element is still in document flow, not yet stuck.
 *                         Skip scroll logic; always show.
 *     ≤ STICKY_TOP_PX  → element is sticky (or hidden by transform).
 *                         Apply direction-based hide/show.
 *   This is accurate regardless of content height, lazy-loaded images, or
 *   viewport size, and requires no layout measurements at init time.
 *
 * SCROLL_THRESHOLD = 50px (raised from 10px).
 *   With transition-transform duration-300 on the container, a 10px threshold
 *   is crossed and reversed within the 300ms window, causing the element to
 *   start animating one way and immediately snap back — the visible "bump".
 *   50px requires intentional, sustained directional movement before the
 *   transition fires. Sub-50px oscillations (touchpad momentum, reading
 *   micro-adjustments) are silently ignored.
 *
 * State guard in setHidden().
 *   DOM transform is only written when the target state differs from the
 *   current one. Redundant writes to the same transform value re-evaluate
 *   the CSS transition on every event; the guard eliminates this.
 *
 * rAF batching.
 *   Burst scroll events within a single paint cycle collapse into one DOM
 *   write via a single pending requestAnimationFrame.
 *
 * details toggle event.
 *   isDetailsOpen is tracked reactively via the native toggle event, not by
 *   re-querying the DOM on every scroll tick.
 *
 * AbortController lifecycle.
 *   All listeners (scroll, details toggle, link clicks) are tied to one
 *   signal. Re-initialising on Astro soft navigations cleanly tears down
 *   everything from the previous page.
 *
 * lastScrollY only advances on decisions.
 *   Sub-threshold scroll events do not update the baseline, so small back-
 *   and-forth oscillations accumulate toward the threshold rather than
 *   continuously resetting it.
 */

/**
 * Minimum net scroll distance (px) before a direction change is acted on.
 * Must be large enough that a brief reversal mid-transition (300ms window)
 * does not cancel the animation and cause a visible bump.
 */
const SCROLL_THRESHOLD = 50;

/**
 * getBoundingClientRect().top threshold for detecting sticky state.
 * #toc-container has `sticky top-1` (top: 4px). Values above this mean
 * the element is still in the document flow and has not yet stuck.
 * Using 5 to absorb sub-pixel rounding.
 */
const STICKY_TOP_PX = 5;

let _ac: AbortController | null = null;

export function init(): void {
	_ac?.abort();
	_ac = new AbortController();
	const { signal } = _ac;

	const toc = document.getElementById("toc-container") as HTMLElement | null;
	const details = document.getElementById("toc-details") as HTMLDetailsElement | null;

	if (!toc) return;

	// ── Per-init state ──
	let hidden = false;
	let isDetailsOpen = details?.open ?? false;
	let lastScrollY = Math.max(0, window.scrollY);
	let rafPending = false;

	// Only write to the DOM when state actually changes.
	// Redundant writes to the same transform value re-evaluate the CSS
	// transition and can cause jitter while the element is already in position.
	function setHidden(next: boolean): void {
		if (hidden === next) return;
		hidden = next;
		toc!.style.transform = next ? "translateY(-100%)" : "";
	}

	// ── details: track open state and close on link click ──
	if (details) {
		details.addEventListener(
			"toggle",
			() => {
				isDetailsOpen = details.open;
				if (details.open) setHidden(false);
			},
			{ signal }
		);

		details.querySelectorAll("a").forEach((link) => {
			link.addEventListener("click", () => (details.open = false), { signal });
		});
	}

	// ── scroll: sticky detection + threshold dead zone + rAF ──
	window.addEventListener(
		"scroll",
		() => {
			if (rafPending) return;
			rafPending = true;

			requestAnimationFrame(() => {
				rafPending = false;

				// getBoundingClientRect() reflects the visual position, not the
				// layout position. unaffected by whether the element is hidden
				// via transform (a hidden element reads as a negative top value,
				// which is ≤ STICKY_TOP_PX, so we correctly stay in scroll mode).
				const rectTop = toc.getBoundingClientRect().top;

				if (rectTop > STICKY_TOP_PX) {
					// Not sticky yet. element is still in document flow.
					// Show it and let the browser handle positioning naturally.
					setHidden(false);
					lastScrollY = Math.max(0, window.scrollY);
					return;
				}

				// When details is open, always stay visible.
				if (isDetailsOpen) {
					setHidden(false);
					lastScrollY = Math.max(0, window.scrollY);
					return;
				}

				const currentScrollY = Math.max(0, window.scrollY);
				const delta = currentScrollY - lastScrollY;

				// Dead zone: sub-threshold movements do not update lastScrollY,
				// so small oscillations accumulate toward the threshold rather
				// than endlessly resetting it.
				if (Math.abs(delta) < SCROLL_THRESHOLD) return;

				setHidden(delta > 0); // scrolling down → hide, up → show
				lastScrollY = currentScrollY;
			});
		},
		{ passive: true, signal }
	);

	// Ensure visible on every page init
	setHidden(false);
}
