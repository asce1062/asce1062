/**
 * Global Scroll Progress Utilities
 */

/**
 * Creates and appends a progress bar to track scroll position
 * The progress bar uses a gradient matching the site's color palette
 */
export function createProgressBar(): void {
	// Check if progress bar already exists
	if (document.getElementById("scroll-progress-bar")) {
		return;
	}

	const progressContainer = document.createElement("div");
	progressContainer.className = "progress-container fixed top-0 z-20 h-1 w-full";
	progressContainer.style.backgroundColor = "transparent";

	const progressBar = document.createElement("div");
	progressBar.className = "progress-bar h-1 w-0 transition-all duration-150";
	progressBar.id = "scroll-progress-bar";
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

	const progressBar = document.getElementById("scroll-progress-bar");
	if (progressBar) {
		progressBar.style.width = `${scrolled}%`;
	}
}

/**
 * Sets up scroll progress tracking
 * Attaches scroll event listener and performs initial update
 */
export function initScrollProgress(): void {
	createProgressBar();
	document.addEventListener("scroll", updateProgress);
	updateProgress(); // Initial update
}

/**
 * Removes the progress bar from the page
 */
export function removeProgressBar(): void {
	const progressBar = document.getElementById("scroll-progress-bar");
	if (progressBar && progressBar.parentElement) {
		progressBar.parentElement.remove();
	}
}
