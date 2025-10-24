/**
 * Collapsible Navigation
 * Detects when navigation items wrap to multiple rows and adds a toggle
 */

export function initCollapsibleNav(): void {
	const container = document.getElementById("nav-container");
	const toggleBtn = document.getElementById("nav-toggle");
	const toggleIcon = document.getElementById("nav-toggle-icon");
	const navItems = document.querySelectorAll("[data-nav-item]");

	if (!container || !toggleBtn || !toggleIcon || navItems.length === 0) return;

	let isExpanded = false;
	let firstRowCount = 0;

	/**
	 * Reset toggle button to collapsed state
	 */
	function resetToggleState() {
		if (!toggleBtn || !toggleIcon) return;

		isExpanded = false;
		toggleIcon.classList.remove("icon-chevron-bar-up");
		toggleIcon.classList.add("icon-chevron-bar-down");
		toggleBtn.setAttribute("aria-expanded", "false");
		toggleIcon.style.transform = "rotate(0deg)";
	}

	/**
	 * Detect which items are in the first row
	 */
	function detectFirstRow() {
		if (!toggleBtn) return;

		// Reset: show all items temporarily to measure
		navItems.forEach((item) => {
			(item as HTMLElement).style.display = "";
		});
		toggleBtn.style.display = "";

		const items = Array.from(navItems) as HTMLElement[];
		if (items.length === 0) return;

		const firstItemTop = items[0].offsetTop;
		firstRowCount = 0;

		// Count items in first row
		for (const item of items) {
			if (item.offsetTop === firstItemTop) {
				firstRowCount++;
			} else {
				break;
			}
		}

		// If all items fit in one row, hide toggle and show all items
		if (firstRowCount >= items.length) {
			toggleBtn.classList.add("hidden");
			resetToggleState();
			navItems.forEach((item) => {
				(item as HTMLElement).style.display = "";
			});
			return;
		}

		// Show toggle button and hide overflow items
		toggleBtn.classList.remove("hidden");
		resetToggleState();
		hideOverflowItems();
	}

	/**
	 * Hide items beyond the first row
	 */
	function hideOverflowItems() {
		navItems.forEach((item, index) => {
			if (index >= firstRowCount) {
				(item as HTMLElement).style.display = "none";
			}
		});
	}

	/**
	 * Show all items
	 */
	function showAllItems() {
		navItems.forEach((item) => {
			(item as HTMLElement).style.display = "";
		});
	}

	/**
	 * Toggle navigation expansion
	 */
	function toggleNav() {
		if (!toggleBtn || !toggleIcon) return;

		isExpanded = !isExpanded;

		if (isExpanded) {
			showAllItems();
			toggleIcon.classList.remove("icon-chevron-bar-down");
			toggleIcon.classList.add("icon-chevron-bar-up");
			toggleBtn.setAttribute("aria-expanded", "true");
			toggleIcon.style.transform = "rotate(180deg)";
		} else {
			hideOverflowItems();
			toggleIcon.classList.remove("icon-chevron-bar-up");
			toggleIcon.classList.add("icon-chevron-bar-down");
			toggleBtn.setAttribute("aria-expanded", "false");
			toggleIcon.style.transform = "rotate(0deg)";
		}
	}

	// Event listeners
	toggleBtn.addEventListener("click", toggleNav);

	// Detect on load and resize
	detectFirstRow();

	// Use debounced resize for better performance on mobile
	let resizeTimer: number;
	window.addEventListener("resize", () => {
		clearTimeout(resizeTimer);
		resizeTimer = window.setTimeout(() => {
			detectFirstRow();
		}, 150);
	});
}
