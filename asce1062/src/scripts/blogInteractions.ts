/**
 * Blog Interaction Utilities
 */

/**
 * Scrolls the page back to the top
 * Supports both Safari and other browsers
 */
export function scrollToTop(): void {
	document.body.scrollTop = 0; // For Safari
	document.documentElement.scrollTop = 0; // For Chrome, Firefox, IE and Opera
}

/**
 * Initializes the "Back to Top" button functionality
 * Attaches click event listener to scroll to top
 */
export function initBackToTop(): void {
	const backToTopButton = document.querySelector("#back-to-top");
	if (backToTopButton) {
		backToTopButton.addEventListener("click", scrollToTop);
	}
}

/**
 * Creates and appends a progress bar to track scroll position
 * The progress bar uses a gradient matching the site's color palette
 */
export function createProgressBar(): void {
	// Check if progress bar already exists
	if (document.getElementById("myBar")) {
		return;
	}

	const progressContainer = document.createElement("div");
	progressContainer.className = "progress-container fixed top-0 z-20 h-1 w-full";
	progressContainer.style.backgroundColor = "transparent";

	const progressBar = document.createElement("div");
	progressBar.className = "progress-bar h-1 w-0 transition-all duration-150";
	progressBar.id = "myBar";
	// Gradient using site's color palette: #9f94a0, #8e878c, #947b82, #cad5db, #9bb0cd, #e5cab7, #dcb8b0
	progressBar.style.background =
		"linear-gradient(to right, #9f94a0, #8e878c, #947b82, #cad5db, #9bb0cd, #e5cab7, #dcb8b0)";
	progressBar.style.width = "0%";

	progressContainer.appendChild(progressBar);
	document.body.appendChild(progressContainer);
}

/**
 * Calculates and updates the scroll progress percentage
 * Updates the progress bar width based on scroll position
 */
function updateProgress(): void {
	const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
	const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
	const scrolled = Math.min((winScroll / height) * 100, 100);

	const progressBar = document.getElementById("myBar");
	if (progressBar) {
		progressBar.style.width = `${scrolled}%`;
	}
}

/**
 * Sets up scroll progress tracking
 * Attaches scroll event listener and performs initial update
 */
export function initScrollProgress(): void {
	document.addEventListener("scroll", updateProgress);
	updateProgress(); // Initial update
}

/**
 * Removes the progress bar from the page
 * Called when navigating away from blog posts
 */
export function removeProgressBar(): void {
	const progressBar = document.getElementById("myBar");
	if (progressBar && progressBar.parentElement) {
		progressBar.parentElement.remove();
	}
}

/**
 * Initializes all blog interactions
 * Call this once when the DOM is ready
 */
export function initBlogInteractions(): void {
	initBackToTop();
	createProgressBar();
	initScrollProgress();
}
