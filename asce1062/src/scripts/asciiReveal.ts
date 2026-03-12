/**
 * ASCII Phosphor Reveal Animation
 *
 * Shared module for the phosphor "wake-up" animation used on ASCII art <pre> elements.
 *
 * Triggers when the container enters the viewport; resets when it leaves so
 * re-entry replays the animation.
 *
 * Usage:
 *   const teardown = setupAsciiReveal(artEl, container, { diceBtn? })
 *
 *   artEl     — <pre> with ASCII art text (rendered by caller before calling setup)
 *   container — wrapping element that receives art-reveal-* classes;
 *               promoted to position:relative if static (for the scan overlay)
 *   diceBtn   — optional; clicking clears storedArt so the next scroll-in play()
 *               reads the freshly rendered text. Caller renders new art first,
 *               this module clears the cache second (add render listener before
 *               calling setupAsciiReveal to guarantee listener order).
 *
 * Always call the returned teardown() before re-initializing on the same or a
 * replaced container to prevent observer, timer, and listener leaks.
 *
 * Respects prefers-reduced-motion: instant reveal, lands in art-reveal-done.
 */

export type AsciiRevealTeardown = () => void;

type SetupOpts = {
	diceBtn?: HTMLElement | null;
	/**
	 * When true, a dice click immediately resets and replays the animation
	 * (useful when the art is always visible, e.g. top of a page).
	 * When false (default), dice swaps art silently; animation plays on next scroll-in.
	 */
	replayOnDice?: boolean;
};

function escapeHTML(s: string): string {
	return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function setupAsciiReveal(
	artEl: HTMLElement,
	container: HTMLElement,
	opts: SetupOpts = {}
): AsciiRevealTeardown {
	// Anchor the absolute-positioned scan overlay.
	if (getComputedStyle(container).position === "static") {
		container.style.position = "relative";
	}

	// Mark art element so CSS can hide it in idle state (.art-reveal-idle .art-target).
	artEl.classList.add("art-target");

	let animated = false;
	let storedArt: string | null = null;
	let timer: ReturnType<typeof setTimeout> | null = null;
	const ac = new AbortController();

	function clearTimer(): void {
		if (timer !== null) {
			clearTimeout(timer);
			timer = null;
		}
	}

	function removeScan(): void {
		container.querySelector<HTMLElement>(".art-scan")?.remove();
	}

	function toIdle(): void {
		clearTimer();
		removeScan();
		container.classList.remove("art-reveal-playing", "art-reveal-done");
		container.classList.add("art-reveal-idle");
		// Restore plain textContent — removes injected spans from a previous play.
		if (storedArt !== null) {
			artEl.textContent = storedArt;
		}
	}

	function play(): void {
		if (animated) return;
		animated = true;

		// Capture text on first play; preserved across scroll-out/in cycles.
		if (storedArt === null) {
			storedArt = artEl.textContent ?? "";
		}

		// Reduced motion: instant reveal, settle into done state.
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
			container.classList.remove("art-reveal-idle");
			container.classList.add("art-reveal-done");
			return;
		}

		removeScan(); // clear any stale overlay from an interrupted animation

		// Split art into per-line spans for the staggered phosphor reveal.
		// Joined with "" — no separator — to avoid whitespace nodes inside <pre>.
		const lines = storedArt.split("\n");
		artEl.innerHTML = lines.map((line) => `<span class="art-line">${escapeHTML(line) || "\u200b"}</span>`).join("");

		const scan = document.createElement("div");
		scan.className = "art-scan";
		container.appendChild(scan);

		const FLICKER_MS = 480;
		const LINE_MS = 35; // ms between consecutive lines
		const lineEls = artEl.querySelectorAll<HTMLElement>(".art-line");
		lineEls.forEach((el, i) => {
			el.style.animationDelay = `${FLICKER_MS + i * LINE_MS}ms`;
		});

		// Total duration: flicker burst + last line's delay + line animation.
		const totalMs = FLICKER_MS + lineEls.length * LINE_MS + 620;

		container.classList.remove("art-reveal-idle");
		container.classList.add("art-reveal-playing");

		timer = setTimeout(() => {
			timer = null;
			scan.remove();
			container.classList.replace("art-reveal-playing", "art-reveal-done");
		}, totalMs);
	}

	function reset(): void {
		animated = false;
		toIdle();
	}

	// Dice: caller's render listener fires first (added before setupAsciiReveal call),
	// then this handler fires second to clear storedArt and optionally replay.
	if (opts.diceBtn) {
		opts.diceBtn.addEventListener(
			"click",
			() => {
				storedArt = null;
				if (opts.replayOnDice) {
					// Reset to idle then replay. rAF lets the idle class apply
					// (brief hidden flash) before the animation fires.
					reset();
					requestAnimationFrame(() => play());
				}
				// else: art swaps silently; animation replays on next scroll-in.
			},
			{ signal: ac.signal }
		);
	}

	toIdle();

	const observer = new IntersectionObserver(
		(entries) => {
			if (entries.some((e) => e.isIntersecting)) {
				play();
			} else {
				reset();
			}
		},
		{ threshold: 0.3 }
	);

	observer.observe(container);

	return function teardown(): void {
		observer.disconnect();
		ac.abort(); // removes dice click listener
		clearTimer();
		removeScan();
	};
}
