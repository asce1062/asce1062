/**
 * Palette view tabs
 *
 * The views switch with CSS alone: hidden radios (`input[name=palette-view]`)
 * select a panel via `:checked ~`, and each tab is the radio's <label>. Without
 * JavaScript the radios stay keyboard operable (Tab to the group, arrows to
 * switch). This script upgrades the labels to the ARIA tabs pattern:
 *   - the labels are the tabs: one Tab stop (roving tabindex), aria-selected
 *   - ArrowLeft/ArrowRight (wrapping), Home/End move between tabs; Enter/Space
 *     select; selection follows focus
 *   - the radios leave the Tab order and the a11y tree (the labels speak for them)
 */

function selectTab(tabs: HTMLLabelElement[], tab: HTMLLabelElement, focus: boolean): void {
	const radio = tab.control as HTMLInputElement | null;
	if (radio && !radio.checked) {
		radio.checked = true;
		radio.dispatchEvent(new Event("change", { bubbles: true }));
	}
	syncTabs(tabs);
	if (focus) tab.focus();
}

/** Mirror the checked radio onto aria-selected and the roving tabindex. */
function syncTabs(tabs: HTMLLabelElement[]): void {
	for (const tab of tabs) {
		const selected = (tab.control as HTMLInputElement | null)?.checked === true;
		tab.setAttribute("aria-selected", String(selected));
		tab.tabIndex = selected ? 0 : -1;
	}
}

export function initPaletteTabs(): void {
	const tablist = document.querySelector<HTMLElement>('[role="tablist"][aria-label="Palette views"]');
	if (!tablist) return;
	const tabs = Array.from(tablist.querySelectorAll<HTMLLabelElement>('label[role="tab"]'));
	if (tabs.length === 0) return;

	for (const tab of tabs) {
		const radio = tab.control as HTMLInputElement | null;
		if (radio) {
			radio.tabIndex = -1;
			radio.setAttribute("aria-hidden", "true");
			// A label click checks its radio as the click's default action, after
			// any click listener has run: follow the radio instead.
			radio.addEventListener("change", () => syncTabs(tabs));
			// Clicking a label focuses its radio, which is hidden from the a11y tree: hand focus to the tab.
			radio.addEventListener("focus", () => tab.focus());
		}
	}
	syncTabs(tabs);

	tablist.addEventListener("keydown", (e) => {
		const current = (e.target as Element).closest<HTMLLabelElement>('label[role="tab"]');
		if (!current) return;
		const index = tabs.indexOf(current);
		let next: HTMLLabelElement | undefined;
		if (e.key === "ArrowRight") next = tabs[(index + 1) % tabs.length];
		else if (e.key === "ArrowLeft") next = tabs[(index - 1 + tabs.length) % tabs.length];
		else if (e.key === "Home") next = tabs[0];
		else if (e.key === "End") next = tabs[tabs.length - 1];
		else if (e.key === "Enter" || e.key === " ") next = current;
		if (!next) return;
		e.preventDefault();
		selectTab(tabs, next, true);
	});
}

// Auto-initialize on page load (for Astro view transitions)
document.addEventListener("astro:page-load", initPaletteTabs);
