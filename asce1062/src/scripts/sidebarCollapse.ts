/**
 * Sidebar Collapse
 *
 * Manages the desktop sidebar collapsed/expanded state.
 * State is persisted to localStorage and applied as data-sidebar-collapsed
 * on <html> (early-applied in Layout.astro to prevent layout shift).
 *
 * The toggle is a fixed bookmark tab (.nav-collapse-tab) on the right edge
 * of the sidebar, cursor direction and icon communicate the action.
 *
 * Expanded:  footer avatar visible, header avatar hidden
 * Collapsed: footer avatar hidden, header avatar visible (icon-only rail)
 *
 * Desktop only. No effect on mobile (controlled by CSS @media min-width: 1024px).
 */

import { getPref, setPref, removePref } from "@/lib/prefs";
import { PREF_KEYS } from "@/lib/prefs";
import { bindAvatarMiniWidget } from "@/scripts/avatarMiniWidget";

const COLLAPSED_ATTR = "data-sidebar-collapsed";
const TRANSITION_ATTR = "data-sidebar-transition";
const COLLAPSED_WIDTH_VAR = "--sidebar-current-width";
const SIDEBAR_TRANSITION_MS = 200;
const SIDEBAR_COLLAPSE_EVENT = "sidebar:collapse-change";

let _ac: AbortController | null = null;
let _headerWidgetAc: AbortController | null = null;
let _transitionTimer: number | null = null;

function setTransitionState(state: "collapsing" | "expanding" | null): void {
	const html = document.documentElement;

	if (_transitionTimer !== null) {
		window.clearTimeout(_transitionTimer);
		_transitionTimer = null;
	}

	if (state) {
		html.setAttribute(TRANSITION_ATTR, state);
		_transitionTimer = window.setTimeout(() => {
			html.removeAttribute(TRANSITION_ATTR);
			_transitionTimer = null;
		}, SIDEBAR_TRANSITION_MS);
		return;
	}

	html.removeAttribute(TRANSITION_ATTR);
}

function isCollapsed(): boolean {
	return document.documentElement.hasAttribute(COLLAPSED_ATTR);
}

function setCollapsed(collapsed: boolean): void {
	const html = document.documentElement;
	const tab = document.getElementById("sidebar-collapse-tab");

	setTransitionState(collapsed ? "collapsing" : "expanding");

	if (collapsed) {
		html.setAttribute(COLLAPSED_ATTR, "");
		html.style.setProperty(COLLAPSED_WIDTH_VAR, "var(--sidebar-collapsed-width)");
		setPref(PREF_KEYS.sidebarCollapsed, "1");
		tab?.setAttribute("aria-label", "Expand sidebar");
		tab?.setAttribute("aria-expanded", "false");
	} else {
		html.removeAttribute(COLLAPSED_ATTR);
		html.style.setProperty(COLLAPSED_WIDTH_VAR, "var(--sidebar-width)");
		removePref(PREF_KEYS.sidebarCollapsed);
		tab?.setAttribute("aria-label", "Collapse sidebar");
		tab?.setAttribute("aria-expanded", "true");
	}

	document.dispatchEvent(
		new CustomEvent(SIDEBAR_COLLAPSE_EVENT, {
			detail: { collapsed },
		})
	);
}

function initCollapse(): void {
	_ac?.abort();
	_ac = new AbortController();
	const { signal } = _ac;

	const tab = document.getElementById("sidebar-collapse-tab");
	if (!tab) return;

	const collapsed = getPref(PREF_KEYS.sidebarCollapsed) === "1";
	setTransitionState(null);

	// Apply the correct CSS variable (ensures it's set even after the early-apply)
	// inline script has already stamped the attribute (inline scripts can't set CSS vars).
	document.documentElement.style.setProperty(
		COLLAPSED_WIDTH_VAR,
		collapsed ? "var(--sidebar-collapsed-width)" : "var(--sidebar-width)"
	);

	// Sync aria state to match current persisted preference
	tab.setAttribute("aria-label", collapsed ? "Expand sidebar" : "Collapse sidebar");
	tab.setAttribute("aria-expanded", collapsed ? "false" : "true");

	// Bind the collapsed header avatar widget so it renders the user's avatar
	_headerWidgetAc?.abort();
	_headerWidgetAc = bindAvatarMiniWidget("sidebar-header");
	const collapsedTrigger = document.querySelector<HTMLElement>('[data-navbrand-terminal-source="sidebar-collapsed"]');
	if (collapsedTrigger) {
		collapsedTrigger.dataset.avatarReady = "false";
		requestAnimationFrame(() => {
			collapsedTrigger.dataset.avatarReady = "true";
		});
	}

	tab.addEventListener("click", () => setCollapsed(!isCollapsed()), { signal });

	// Escape while focused inside a collapsed sidebar: expand and return focus to tab
	document.addEventListener(
		"keydown",
		(e: KeyboardEvent) => {
			if (e.key === "Escape" && isCollapsed()) {
				const sidebar = document.querySelector<HTMLElement>(".nav-menu");
				if (sidebar?.contains(document.activeElement)) {
					setCollapsed(false);
					tab.focus();
				}
			}
		},
		{ signal }
	);
}

// astro:after-swap fires synchronously after the DOM swap, before first paint.
// Astro's ClientRouter resets <html> attributes to match the new page's <html>
// element, which has no data-sidebar-collapsed and no inline style, stripping
// the collapsed state on every soft navigation.
// Re-stamping here (from localStorage) ensures the CSS rules apply on first render.
document.addEventListener("astro:after-swap", () => {
	const collapsed = getPref(PREF_KEYS.sidebarCollapsed) === "1";
	const html = document.documentElement;
	setTransitionState(null);

	if (collapsed) {
		html.setAttribute(COLLAPSED_ATTR, "");
	} else {
		html.removeAttribute(COLLAPSED_ATTR);
	}
	html.style.setProperty(COLLAPSED_WIDTH_VAR, collapsed ? "var(--sidebar-collapsed-width)" : "var(--sidebar-width)");
});

document.addEventListener("astro:page-load", initCollapse);
