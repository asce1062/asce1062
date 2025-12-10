/**
 * Shared utilities for view controls (Albums, Tracks, etc.)
 * Provides consistent styling and structure across all views
 */

export interface ControlsConfig {
	id: string;
	sortOptions: { value: string; label: string; selected?: boolean }[];
	currentSortOrder: "asc" | "desc";
	showViewToggle?: boolean;
	currentView?: "grid" | "list";
	customRightContent?: string;
	viewName?: string; // e.g., "albums", "tracks"
}

/**
 * Generate consistent control bar HTML
 * Includes sort order toggle, sort dropdown, and optional view toggle
 */
export function generateControlsHTML(config: ControlsConfig): string {
	const {
		id,
		sortOptions,
		currentSortOrder,
		showViewToggle = false,
		currentView = "grid",
		customRightContent,
		viewName = "",
	} = config;

	// Sort order icon
	const sortIcon = currentSortOrder === "asc" ? "icon-sort-up" : "icon-sort-down";
	const sortTitle = currentSortOrder === "asc" ? "Sort descending" : "Sort ascending";

	// View toggle icon
	const viewIcon = currentView === "grid" ? "icon-grid" : "icon-list";
	const viewTitle = currentView === "grid" ? "Switch to list view" : "Switch to grid view";

	// Generate sort options HTML
	const optionsHTML = sortOptions
		.map((option) => `<option value="${option.value}"${option.selected ? " selected" : ""}>${option.label}</option>`)
		.join("");

	// Determine right content
	let rightContent = "";
	if (customRightContent) {
		rightContent = customRightContent;
	} else if (showViewToggle) {
		rightContent = `
			<a
				id="${id}-view-toggle"
				class="no-underline icon group hover:text-accent scale-90 p-2 sm:p-1 cursor-pointer"
				data-view="${currentView}"
				aria-label="Toggle view mode"
				title="${viewTitle}">
				<i class="${viewIcon} text-2xl"></i>
			</a>
		`;
	}

	const viewAttr = viewName ? ` data-view-controls="${viewName}"` : "";
	// sticky top-[104px] sm:top-[88px] z-30
	return `
		<div id="${id}" class="bg-light-100/80 dark:bg-palette-700/80 backdrop-blur-md flex items-center justify-between gap-4 py-2 mb-2 border-t border-palette-900/30 dark:border-palette-50/30"${viewAttr}>
			<!-- Left: Sort controls -->
			<div class="flex items-center">
				<a
					id="${id}-order"
					class="no-underline icon group hover:text-accent scale-90 p-2 sm:p-1 cursor-pointer"
					data-order="${currentSortOrder}"
					aria-label="${sortTitle}"
					title="${sortTitle}">
					<i class="${sortIcon} text-2xl"></i>
				</a>
				<div class="relative">
					<select
						id="${id}-select"
						class="px-3 py-1.5 pr-8 bg-light-100/80 dark:bg-palette-700/80 border dark:border-palette-100 border-palette-700 text-palette-50 dark:text-palette-200 text-sm focus:outline-none focus:border-palette-500 dark:focus:border-palette-600 transition-colors cursor-pointer appearance-none">
						${optionsHTML}
					</select>
					<i class="icon-caret-down-fill absolute right-2 top-1/2 -translate-y-1/2 text-palette-100 pointer-events-none"></i>
				</div>
			</div>
			${rightContent}
		</div>
	`;
}
