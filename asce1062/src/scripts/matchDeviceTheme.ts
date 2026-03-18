/**
 * Match Device Theme
 *
 * Wires the sidebar "Match device" toggle to the theme system.
 *
 * When enabled:
 *   - The site theme immediately follows the OS/browser preferred color scheme.
 *   - A prefers-color-scheme listener updates the theme live if the device
 *     setting changes while the page is open.
 *   - URL ?theme= overrides take precedence and suppress live OS updates for
 *     the current page load (embed/screenshot use case).
 *
 * When disabled (including when the user manually toggles the site theme):
 *   - The live listener is removed.
 *   - The manual theme preference takes over.
 *
 * The MediaQueryList listener is a module-level singleton so it is never
 * duplicated across Astro soft navigations.
 * AbortController is used to clean up document-level listeners (toggle change,
 * MATCH_DEVICE_THEME_CHANGE_EVENT) on each navigation.
 *
 * localStorage keys:
 *   "match-device-theme" - "1" when enabled; absent when disabled (PREF_KEYS.matchDeviceTheme)
 *   "theme"              - always holds the last resolved "light"|"dark" value
 *
 * Flow on hard load / soft navigation:
 *   1. Inline `<head>` script (Layout.astro) stamps the correct data-theme before paint.
 *   2. astro:after-swap  → re-stamps data-theme before new content is visible.
 *   3. astro:page-load   → init() syncs the toggle checkbox and reattaches listeners.
 *
 * BROWSER-ONLY: this module uses window and document at load time. Import only
 * from client-side <script> blocks, never from SSR code paths.
 */

import {
	isMatchDeviceTheme,
	enableMatchDeviceTheme,
	disableMatchDeviceTheme,
	setTheme,
	getSystemTheme,
	getThemeFromUrl,
	updateThemeIcon,
	MATCH_DEVICE_THEME_CHANGE_EVENT,
} from "@/scripts/themeManager";

const TOGGLE_ID = "match-device-theme-toggle";

// ─── Option icon sync ───

/**
 * Update the sidebar option icon to reflect the current OS theme:
 *   icon-sun  → OS is light
 *   icon-moon → OS is dark
 * Navigates from the toggle checkbox up to its .nav-option container and
 * targets the first <i> in the label group.
 *
 * This is a passive OS-theme indicator: it reflects the device preference,
 * not the site's current active theme.
 */
function updateOptionIcon(): void {
	const toggle = document.getElementById(TOGGLE_ID);
	if (!toggle) return;
	const icon = toggle.closest(".nav-option")?.querySelector<HTMLElement>(".nav-option-label-group i");
	if (!icon) return;
	const isDark = getSystemTheme() === "dark";
	icon.classList.toggle("icon-sun", !isDark);
	icon.classList.toggle("icon-moon", isDark);
}

// ─── Module-level media query singleton ───
// Reused across navigations so addEventListener/removeEventListener stay paired.
// Initialized at module scope because this module is browser-only (see file header).
const _mq = window.matchMedia("(prefers-color-scheme: dark)");

function _onSystemThemeChange(): void {
	// Guard: only act when match mode is still enabled.
	if (!isMatchDeviceTheme()) return;
	// URL param takes precedence. Do not override an embed/screenshot theme.
	if (getThemeFromUrl()) return;
	setTheme(getSystemTheme());
	updateThemeIcon();
	updateOptionIcon();
}

function startListening(): void {
	// Remove first to guarantee idempotency even if called multiple times.
	_mq.removeEventListener("change", _onSystemThemeChange);
	_mq.addEventListener("change", _onSystemThemeChange);
}

function stopListening(): void {
	_mq.removeEventListener("change", _onSystemThemeChange);
}

// Always keep the option icon in sync with the OS theme regardless of match
// mode. It acts as a passive OS-theme indicator in the sidebar.
_mq.addEventListener("change", updateOptionIcon);

// ─── Per-navigation init ───
let _ac: AbortController | null = null;

function init(): void {
	// Clean up previous navigation's document-level listeners before re-registering.
	_ac?.abort();
	_ac = new AbortController();
	const { signal } = _ac;

	const toggle = document.getElementById(TOGGLE_ID) as HTMLInputElement | null;
	if (!toggle) return;

	// Reflect persisted state in the checkbox.
	toggle.checked = isMatchDeviceTheme();

	// User toggled the sidebar checkbox.
	toggle.addEventListener(
		"change",
		() => {
			if (toggle.checked) {
				enableMatchDeviceTheme();
				startListening();
			} else {
				disableMatchDeviceTheme();
				stopListening();
			}
			updateThemeIcon();
		},
		{ signal }
	);

	// Sync checkbox and listener state when match mode is changed externally
	// (e.g. the user manually clicked the header theme toggle while match mode
	// was active, which calls disableMatchDeviceTheme()).
	document.addEventListener(
		MATCH_DEVICE_THEME_CHANGE_EVENT,
		(event: Event) => {
			const enabled = (event as CustomEvent<boolean>).detail;
			toggle.checked = enabled;
			if (enabled) startListening();
			else stopListening();
		},
		{ signal }
	);

	// Ensure the live listener state matches stored preference after navigation.
	// Skip applying OS theme if a URL override is active for this page load.
	if (isMatchDeviceTheme()) {
		if (!getThemeFromUrl()) {
			setTheme(getSystemTheme());
			updateThemeIcon();
		}
		startListening();
	} else {
		stopListening();
	}

	// Always reflect the current OS theme in the option icon.
	updateOptionIcon();
}

// Re-stamp data-theme before the new page's content becomes visible on soft nav.
document.addEventListener("astro:after-swap", () => {
	if (!isMatchDeviceTheme()) return;
	if (getThemeFromUrl()) return;
	// Apply without calling the full setTheme to keep this synchronous and
	// avoid a double dispatch. the astro:page-load init() call right after
	// will call setTheme() which handles persistence and icon sync.
	document.documentElement.setAttribute("data-theme", getSystemTheme());
});

document.addEventListener("astro:page-load", init);
