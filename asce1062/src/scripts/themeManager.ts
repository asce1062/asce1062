/**
 * Theme Manager
 * Handles theme switching logic without global function pollution
 */

export type Theme = "light" | "dark";

/**
 * Get the current theme from localStorage or data-theme attribute
 */
export function getCurrentTheme(): Theme {
	const dataTheme = document.documentElement.attributes.getNamedItem("data-theme")?.value;

	if (dataTheme === "light" || dataTheme === "dark") {
		return dataTheme;
	}

	const storedTheme = localStorage.getItem("theme");
	return storedTheme === "light" ? "light" : "dark";
}

/**
 * Check if current theme is light mode
 */
export function isLightMode(): boolean {
	return getCurrentTheme() === "light";
}

/**
 * Toggle between light and dark themes
 */
export function toggleTheme(): Theme {
	const currentTheme = getCurrentTheme();
	const newTheme: Theme = currentTheme === "light" ? "dark" : "light";

	// Update localStorage first
	localStorage.setItem("theme", newTheme);

	// Update data-theme attribute
	document.documentElement.setAttribute("data-theme", newTheme);

	// Dispatch custom event for astro-themes integration
	document.dispatchEvent(new CustomEvent("set-theme", { detail: newTheme }));

	return newTheme;
}

/**
 * Update the theme toggle icon
 */
export function updateThemeIcon(iconElementId: string = "toggleIcon"): void {
	const icon = document.getElementById(iconElementId);
	if (!icon) return;

	const lightMode = isLightMode();
	icon.className = lightMode ? "icon-moon" : "icon-sun";
}

/**
 * Initialize theme switcher
 * Sets up the initial icon state
 */
export function initThemeSwitcher(iconElementId: string = "toggleIcon"): void {
	updateThemeIcon(iconElementId);
}

/**
 * Handle theme toggle button click
 */
export function handleThemeToggle(iconElementId: string = "toggleIcon"): void {
	toggleTheme();
	updateThemeIcon(iconElementId);
}
