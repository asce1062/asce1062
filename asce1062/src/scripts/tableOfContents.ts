/**
 * Table of Contents Utilities
 * Handles auto-closing TOC when links are clicked and scroll-based visibility
 */

let lastScrollY = 0;
let scrollHandler: (() => void) | null = null;

/**
 * Initializes TOC link click handlers to auto-close the details element
 */
export function initTocLinks(): void {
	const details = document.getElementById("toc-details");
	if (!details) return;

	const links = details.querySelectorAll("a");
	links.forEach((link) => {
		link.addEventListener("click", () => {
			(details as HTMLDetailsElement).open = false;
		});
	});
}

/**
 * Initializes scroll direction detection to show/hide TOC
 * Shows TOC when scrolling up, hides when scrolling down
 */
export function initScrollDirection(): void {
	const toc = document.getElementById("toc-container");
	if (!toc) return;

	// Remove previous handler if exists
	if (scrollHandler) {
		window.removeEventListener("scroll", scrollHandler);
	}

	// Reset state
	lastScrollY = window.scrollY;
	toc.style.transform = "";

	// Get TOC height for transform
	const tocHeight = toc.offsetHeight;

	scrollHandler = () => {
		const currentScrollY = window.scrollY;
		const isScrollingDown = currentScrollY > lastScrollY;
		const isAtTop = currentScrollY < tocHeight;
		const details = document.getElementById("toc-details") as HTMLDetailsElement | null;
		const isOpen = details?.open ?? false;

		// Always show at top of page or when TOC is expanded
		if (isAtTop || isOpen) {
			toc.style.transform = "";
		} else if (isScrollingDown) {
			// Hide when scrolling down (slide up out of view)
			toc.style.transform = `translateY(-100%)`;
		} else {
			// Show when scrolling up (slide back into view)
			toc.style.transform = "";
		}

		lastScrollY = currentScrollY;
	};

	window.addEventListener("scroll", scrollHandler, { passive: true });
}
