/**
 * Collapsible Navigation Script
 *
 * Handles the collapsible behavior for the navigation component with:
 * - Height-based animation
 * - Keyboard accessibility
 * - ARIA state management
 * - Layout stability across breakpoints
 *
 */

interface NavState {
	container: HTMLElement;
	wrapper: HTMLElement;
	itemsContainer: HTMLElement;
	toggle: HTMLButtonElement;
	toggleText: HTMLElement;
	items: HTMLElement[];
	isExpanded: boolean;
	firstRowHeight: number;
	fullHeight: number;
	firstRowCount: number;
}

/**
 * Initialize all collapsible navigation instances on the page
 */
export function initCollapsibleNavigation(): void {
	const navContainers = document.querySelectorAll<HTMLElement>("[data-collapsible-nav]");

	navContainers.forEach((container) => {
		initSingleNav(container);
	});
}

/**
 * Initialize a single collapsible navigation instance
 */
function initSingleNav(container: HTMLElement): void {
	const wrapper = container.querySelector<HTMLElement>("[data-nav-items-wrapper]");
	const itemsContainer = container.querySelector<HTMLElement>("[data-nav-items]");
	const toggle = container.querySelector<HTMLButtonElement>("[data-nav-toggle]");
	const toggleText = container.querySelector<HTMLElement>("[data-toggle-text]");
	const items = Array.from(container.querySelectorAll<HTMLElement>("[data-nav-item]"));

	// Bail if required elements are missing
	if (!wrapper || !itemsContainer || !toggle || !toggleText || items.length === 0) {
		return;
	}

	// Initialize state object
	const state: NavState = {
		container,
		wrapper,
		itemsContainer,
		toggle,
		toggleText,
		items,
		isExpanded: false,
		firstRowHeight: 0,
		fullHeight: 0,
		firstRowCount: 0,
	};

	// Clean up any previous event listeners (for view transitions)
	const newToggle = toggle.cloneNode(true) as HTMLButtonElement;
	toggle.parentNode?.replaceChild(newToggle, toggle);
	state.toggle = newToggle;

	// Bind event handlers
	setupEventListeners(state);

	// Perform initial measurement and setup
	measureAndSetup(state);
}

/**
 * Set up event listeners for toggle and resize
 */
function setupEventListeners(state: NavState): void {
	// Toggle button click/keyboard handler
	// Using click event which fires for both mouse and keyboard (Enter/Space)
	state.toggle.addEventListener("click", () => {
		toggleNav(state);
	});

	// Debounced resize handler
	let resizeTimer: number;
	const handleResize = () => {
		clearTimeout(resizeTimer);
		resizeTimer = window.setTimeout(() => {
			measureAndSetup(state);
		}, 150);
	};

	window.addEventListener("resize", handleResize);
}

/**
 * Measure navigation dimensions and set up initial state
 *
 * This function:
 * 1. Temporarily shows all items to measure full height
 * 2. Calculates which items fit in the first row
 * 3. Measures the first row height
 * 4. Determines if collapse behavior is needed
 * 5. Sets appropriate ARIA and visual states
 */
function measureAndSetup(state: NavState): void {
	const { wrapper, itemsContainer, toggle, items } = state;

	// Reset to expanded state for measurement
	wrapper.style.maxHeight = "none";
	wrapper.removeAttribute("data-collapsed");
	wrapper.setAttribute("aria-hidden", "false");

	// Force a reflow to ensure measurements are accurate
	void itemsContainer.offsetHeight;

	// Measure full expanded height
	state.fullHeight = itemsContainer.scrollHeight;

	// Find the first row by comparing offsetTop values
	if (items.length === 0) return;

	const firstItemTop = items[0].offsetTop;
	state.firstRowCount = 0;
	let firstRowBottom = 0;

	for (const item of items) {
		if (item.offsetTop === firstItemTop) {
			state.firstRowCount++;
			// Track the bottom of the first row items
			const itemBottom = item.offsetTop + item.offsetHeight;
			if (itemBottom > firstRowBottom) {
				firstRowBottom = itemBottom;
			}
		} else {
			break;
		}
	}

	// Calculate first row height (from container top to bottom of first row items)
	// Include any gap spacing
	const computedStyle = window.getComputedStyle(itemsContainer);
	const gap = parseFloat(computedStyle.gap) || 0;

	// First row height = first row item bottom position relative to container + some padding
	state.firstRowHeight = firstRowBottom - items[0].offsetTop + gap;

	// Determine if we need the toggle (items overflow to second row)
	const needsToggle = state.firstRowCount < items.length;

	if (needsToggle) {
		// Show toggle button
		toggle.hidden = false;

		// Start in collapsed state
		state.isExpanded = false;
		collapseNav(state);
	} else {
		// Hide toggle - all items fit
		toggle.hidden = true;
		state.isExpanded = true;

		// Ensure full visibility
		wrapper.style.maxHeight = "none";
		wrapper.removeAttribute("data-collapsed");
		wrapper.setAttribute("aria-hidden", "false");
	}
}

/**
 * Toggle navigation between collapsed and expanded states
 */
function toggleNav(state: NavState): void {
	if (state.isExpanded) {
		collapseNav(state);
	} else {
		expandNav(state);
	}
}

/**
 * Collapse navigation to show only the first row
 *
 * Animation Strategy:
 * - Set max-height to first row height
 * - CSS transition handles the animation
 * - aria-hidden="true" hides collapsed items from screen readers
 */
function collapseNav(state: NavState): void {
	const { wrapper, toggle, toggleText, items, firstRowHeight, firstRowCount } = state;

	state.isExpanded = false;

	// Set max-height to first row height for smooth animation
	wrapper.style.maxHeight = `${firstRowHeight}px`;
	wrapper.setAttribute("data-collapsed", "true");

	// Update ARIA states
	toggle.setAttribute("aria-expanded", "false");
	toggle.setAttribute("aria-label", "Show more navigation items");
	toggleText.textContent = "Show more";

	// Mark overflow items as hidden from assistive tech
	// We use aria-hidden on the wrapper, but also tabindex=-1 on hidden items
	// to prevent keyboard focus on visually hidden content
	items.forEach((item, index) => {
		if (index >= firstRowCount) {
			item.setAttribute("tabindex", "-1");
			item.setAttribute("aria-hidden", "true");
		}
	});

	// The wrapper itself announces the collapsed state
	wrapper.setAttribute("aria-hidden", "false");
}

/**
 * Expand navigation to show all items
 *
 * Animation Strategy:
 * - Set max-height to full content height
 * - CSS transition handles the animation
 * - After transition, could set to "none" for dynamic content
 */
function expandNav(state: NavState): void {
	const { wrapper, toggle, toggleText, items, fullHeight } = state;

	state.isExpanded = true;

	// Set max-height to full height for smooth animation
	wrapper.style.maxHeight = `${fullHeight}px`;
	wrapper.removeAttribute("data-collapsed");

	// Update ARIA states
	toggle.setAttribute("aria-expanded", "true");
	toggle.setAttribute("aria-label", "Show fewer navigation items");
	toggleText.textContent = "Show less";

	// Restore focusability and visibility to all items
	items.forEach((item) => {
		item.removeAttribute("tabindex");
		item.removeAttribute("aria-hidden");
	});

	wrapper.setAttribute("aria-hidden", "false");

	// After animation completes, set max-height to none for flexibility
	// This handles cases where content might change size
	wrapper.addEventListener(
		"transitionend",
		() => {
			if (state.isExpanded) {
				wrapper.style.maxHeight = "none";
			}
		},
		{ once: true }
	);
}
