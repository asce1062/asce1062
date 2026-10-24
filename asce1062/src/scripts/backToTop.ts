/**
 * Back to Top Button Utilities
 */

let hideTimeout: number | null = null;
const AUTO_HIDE_DELAY = 3000; // 3 seconds - standard for auto-hiding UI elements

/**
 * Scrolls the page back to the top and moves focus to the main content, so a
 * keyboard user is not left on a button that is about to hide.
 */
function scrollToTop(): void {
	const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	window.scrollTo({
		top: 0,
		behavior: reduceMotion ? "auto" : "smooth",
	});

	const main = document.getElementById("main-content");
	if (main) {
		if (!main.hasAttribute("tabindex")) main.setAttribute("tabindex", "-1");
		main.focus({ preventScroll: true });
	}
}

/** Cancel the pending auto-hide (pointer over the button, or it has focus). */
function cancelAutoHide(): void {
	if (hideTimeout !== null) {
		clearTimeout(hideTimeout);
		hideTimeout = null;
	}
}

/** Restart the auto-hide when the pointer or focus leaves, if still scrolled down. */
function resumeAutoHide(): void {
	const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
	if (winScroll > 250) {
		cancelAutoHide();
		hideTimeout = window.setTimeout(hideButton, AUTO_HIDE_DELAY);
	}
}

/**
 * Hides the back-to-top button
 */
function hideButton(): void {
	const button = document.getElementById("back-to-top");
	if (!button) return;

	button.classList.remove("opacity-100", "visible");
	button.classList.add("opacity-0", "invisible");
}

/**
 * Shows the button and sets up auto-hide timer
 */
function showButtonWithAutoHide(): void {
	const button = document.getElementById("back-to-top");
	if (!button) return;

	// Clear any existing timeout
	if (hideTimeout !== null) {
		clearTimeout(hideTimeout);
	}

	// Show button
	button.classList.remove("opacity-0", "invisible");
	button.classList.add("opacity-100", "visible");

	// Set auto-hide timer, unless the button is focused (see initBackToTop)
	if (!button.contains(document.activeElement)) {
		hideTimeout = window.setTimeout(hideButton, AUTO_HIDE_DELAY);
	}
}

/**
 * Shows or hides the back-to-top button based on scroll position
 * Button appears after scrolling down 300px and auto-hides after 3 seconds
 */
function toggleBackToTopButton(): void {
	const scrollThreshold = 250; // Show button after scrolling 200px
	const winScroll = document.body.scrollTop || document.documentElement.scrollTop;

	if (winScroll > scrollThreshold) {
		showButtonWithAutoHide();
	} else {
		const button = document.getElementById("back-to-top");
		if (!button) return;

		// Immediately hide if scrolled to top
		if (hideTimeout !== null) {
			clearTimeout(hideTimeout);
		}
		button.classList.remove("opacity-100", "visible");
		button.classList.add("opacity-0", "invisible");
	}
}

/**
 * Initializes the back-to-top button functionality
 */
export function initBackToTop(): void {
	const button = document.getElementById("back-to-top");
	if (!button) return;

	// Add click handler
	button.addEventListener("click", scrollToTop);

	// Add scroll handler to show/hide button
	document.addEventListener("scroll", toggleBackToTopButton);

	// Keep the button visible while hovered or focused (cancels auto-hide):
	// hiding a focused element would drop keyboard focus to the body.
	button.addEventListener("mouseenter", cancelAutoHide);
	button.addEventListener("focusin", cancelAutoHide);
	button.addEventListener("mouseleave", () => {
		if (!button.contains(document.activeElement)) resumeAutoHide();
	});
	button.addEventListener("focusout", resumeAutoHide);

	// Initial state check
	toggleBackToTopButton();
}
