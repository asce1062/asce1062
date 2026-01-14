/**
 * Back to Top Button Utilities
 */

let hideTimeout: number | null = null;
const AUTO_HIDE_DELAY = 3000; // 3 seconds - standard for auto-hiding UI elements

/**
 * Scrolls the page back to the top
 * Supports both Safari and other browsers
 */
function scrollToTop(): void {
	window.scrollTo({
		top: 0,
		behavior: "smooth",
	});
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

	// Set auto-hide timer
	hideTimeout = window.setTimeout(hideButton, AUTO_HIDE_DELAY);
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

	// Show button on hover/focus (cancels auto-hide)
	button.addEventListener("mouseenter", () => {
		if (hideTimeout !== null) {
			clearTimeout(hideTimeout);
		}
	});

	button.addEventListener("mouseleave", () => {
		const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
		if (winScroll > 250) {
			hideTimeout = window.setTimeout(hideButton, AUTO_HIDE_DELAY);
		}
	});

	// Initial state check
	toggleBackToTopButton();
}
