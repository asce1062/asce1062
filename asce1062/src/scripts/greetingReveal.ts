/**
 * Greeting Reveal
 * Terminal glyph decrypt effect.
 *
 * Content is always visible in the DOM. JS enhances with a decrypt
 * animation: CRT-authentic block drawing characters resolve to the
 * real text one character at a time, left-to-right. Uses block and
 * box-drawing glyphs rather than alphanumeric characters.
 *
 * Degrades gracefully: if JS is unavailable or fails, the greeting
 * renders as-is. Reduced motion: animation is skipped entirely.
 *
 * Triggers: page load, mouseenter, touchstart (re-scrambles each time).
 * Timing: ~700ms total, matching --duration-crawl atmosphere.
 */

// Terminal block and box-drawing characters
const CHARS = "░▒▓█▐▌▄▀■□▪▫◆◇○●◌◍◎◉▶▷◀◁▸▹◂◃⬛⬜▬▭▮▯◥◤◣◢◿█▄▌▐▀▘▝▀▖▍▞▛▗▚▐▜▃▙▟▉";
const TOTAL_FRAMES = 40;
const DURATION_MS = 700;

// Active interval handle (prevents overlapping animations on rapid re-trigger)
let _activeTick: ReturnType<typeof setInterval> | null = null;

function scramble(el: HTMLElement): void {
	const target = el.dataset.greetingTarget ?? el.textContent?.trim() ?? "";
	if (!target) return;

	// Store original text for re-runs
	if (!el.dataset.greetingTarget) {
		el.dataset.greetingTarget = target;
	}

	// Respect reduced motion preference
	if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
		el.textContent = target;
		return;
	}

	// Cancel any in-progress animation before starting a new one
	if (_activeTick !== null) {
		clearInterval(_activeTick);
		_activeTick = null;
	}

	let frame = 0;
	const frameInterval = DURATION_MS / TOTAL_FRAMES;

	_activeTick = setInterval(() => {
		const resolved = Math.floor((frame / TOTAL_FRAMES) * target.length);

		el.textContent = target
			.split("")
			.map((char, i) => {
				// Spaces pass through immediately (preserve word rhythm)
				if (char === " ") return char;
				// Characters to the left of the resolution front are locked in
				if (i < resolved) return char;
				// Characters ahead of the front are still scrambling through CRT glyphs
				return CHARS[Math.floor(Math.random() * CHARS.length)];
			})
			.join("");

		frame++;

		if (frame >= TOTAL_FRAMES) {
			clearInterval(_activeTick!);
			_activeTick = null;
			// Ensure final state is exactly correct
			el.textContent = target;
		}
	}, frameInterval);
}

function initGreetingReveal(): void {
	const el = document.querySelector<HTMLElement>(".site-greeting");
	if (!el) return;

	// Trigger on page load
	scramble(el);

	// Re-trigger on hover (desktop) and tap (touch devices)
	// Using once-then-rebind approach so the element doesn't accumulate
	// duplicate listeners across view transitions
	el.removeEventListener("mouseenter", _onMouseEnter);
	el.removeEventListener("touchstart", _onTouchStart);
	el.addEventListener("mouseenter", _onMouseEnter);
	el.addEventListener("touchstart", _onTouchStart, { passive: true });
}

function _onMouseEnter(e: Event): void {
	scramble(e.currentTarget as HTMLElement);
}

function _onTouchStart(e: Event): void {
	scramble(e.currentTarget as HTMLElement);
}

document.addEventListener("astro:page-load", initGreetingReveal);
