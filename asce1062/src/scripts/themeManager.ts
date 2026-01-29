/**
 * Theme Manager
 * Handles theme switching logic without global function pollution
 */

export type Theme = "light" | "dark";

/**
 * Check if theme is being forced via URL parameter
 * Returns the theme if ?theme=light or ?theme=dark is present, null otherwise
 */
export function getThemeFromUrl(): Theme | null {
	const urlParams = new URLSearchParams(window.location.search);
	const themeParam = urlParams.get("theme");

	if (themeParam === "light" || themeParam === "dark") {
		return themeParam;
	}

	return null;
}

/**
 * Get the current theme from URL param, localStorage, or data-theme attribute
 * Priority: URL param > data-theme > localStorage > default (dark)
 */
export function getCurrentTheme(): Theme {
	// URL parameter takes highest priority (for embeds/screenshots)
	const urlTheme = getThemeFromUrl();
	if (urlTheme) {
		return urlTheme;
	}

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
 * Set a specific theme
 */
export function setTheme(theme: Theme, persist: boolean = true): Theme {
	// Update localStorage (unless URL param is forcing theme)
	if (persist && !getThemeFromUrl()) {
		localStorage.setItem("theme", theme);
	}

	// Update data-theme attribute
	document.documentElement.setAttribute("data-theme", theme);

	// Dispatch custom event for astro-themes integration
	document.dispatchEvent(new CustomEvent("set-theme", { detail: theme }));

	return theme;
}

/**
 * Toggle between light and dark themes
 */
export function toggleTheme(): Theme {
	const currentTheme = getCurrentTheme();
	const newTheme: Theme = currentTheme === "light" ? "dark" : "light";

	return setTheme(newTheme);
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
 * Initialize theme from URL parameter if present
 * Call this early to apply URL-based theme before content renders
 */
export function initThemeFromUrl(): void {
	const urlTheme = getThemeFromUrl();
	if (urlTheme) {
		setTheme(urlTheme, false); // Don't persist URL-based themes
	}
}

/**
 * Initialize theme switcher
 * Sets up the initial icon state and applies URL theme if present
 */
export function initThemeSwitcher(iconElementId: string = "toggleIcon"): void {
	initThemeFromUrl();
	updateThemeIcon(iconElementId);
}

/**
 * Handle theme toggle button click
 */
export function handleThemeToggle(iconElementId: string = "toggleIcon"): void {
	toggleTheme();
	updateThemeIcon(iconElementId);
}

/**
 * Setup global keyboard shortcut for theme toggle
 * Default: Ctrl/Cmd + Shift + L
 */
export function setupThemeShortcut(
	iconElementId: string = "toggleIcon",
	shortcut: { key: string; ctrlOrCmd: boolean; shift: boolean } = { key: "l", ctrlOrCmd: true, shift: true }
): () => void {
	const handler = (e: KeyboardEvent) => {
		const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
		const ctrlOrCmd = isMac ? e.metaKey : e.ctrlKey;
		const matchesShortcut =
			e.key.toLowerCase() === shortcut.key && ctrlOrCmd === shortcut.ctrlOrCmd && e.shiftKey === shortcut.shift;

		if (matchesShortcut) {
			e.preventDefault();
			handleThemeToggle(iconElementId);
		}
	};

	document.addEventListener("keydown", handler);

	// Return cleanup function
	return () => document.removeEventListener("keydown", handler);
}
