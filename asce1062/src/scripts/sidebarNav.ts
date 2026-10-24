/**
 * Sidebar Navigation
 *
 * Manages the CSS checkbox-driven nav drawer state:
 * - Resets toggle on every page load / view transition
 * - The hamburger <button> toggles the checkbox and mirrors it in aria-expanded
 * - Below the desktop breakpoint the closed drawer is inert (off-canvas links
 *   are not tab stops); the open drawer receives focus and traps Tab
 * - Closes nav when a nav link is clicked
 * - Closes nav on Escape key and returns focus to the hamburger button
 *
 * Uses AbortController to prevent document/window listeners from accumulating
 * across Astro soft navigations. document persists across navigations; header
 * and sidebar elements do not, so they are re-queried on every page load.
 */

const DESKTOP_QUERY = "(min-width: 1024px)";

let _ac: AbortController | null = null;

function focusableIn(container: HTMLElement): HTMLElement[] {
	return Array.from(
		container.querySelectorAll<HTMLElement>(
			'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), [tabindex]:not([tabindex="-1"])'
		)
	).filter((el) => el.offsetParent !== null || el === document.activeElement);
}

function initNav(): void {
	_ac?.abort();
	_ac = new AbortController();
	const { signal } = _ac;

	const toggle = document.getElementById("nav-toggle") as HTMLInputElement | null;
	const menu = document.getElementById("nav-menu");
	const hamburger = document.querySelector<HTMLButtonElement>(".nav-hamburger");
	if (!toggle || !menu) return;

	const desktop = window.matchMedia(DESKTOP_QUERY);

	/** Reflect the checkbox in ARIA state and inertness. */
	const sync = (): void => {
		const open = toggle.checked;
		hamburger?.setAttribute("aria-expanded", String(open));
		hamburger?.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
		// On desktop the sidebar is always on screen; only the mobile drawer hides.
		menu.inert = !desktop.matches && !open;
	};

	const setOpen = (open: boolean, { returnFocus = false } = {}): void => {
		toggle.checked = open;
		sync();
		if (open) {
			focusableIn(menu)[0]?.focus();
		} else if (returnFocus) {
			hamburger?.focus();
		}
	};

	// Reset state on every page load / view transition.
	toggle.checked = false;
	sync();

	hamburger?.addEventListener("click", () => setOpen(!toggle.checked), { signal });
	// The overlay is a <label for="nav-toggle">; clicking it flips the checkbox natively.
	toggle.addEventListener("change", sync, { signal });
	desktop.addEventListener("change", sync, { signal });

	// Close on nav link click. Elements are replaced on navigation; no leak.
	document.querySelectorAll<HTMLAnchorElement>(".nav-link").forEach((link) => {
		link.addEventListener("click", () => setOpen(false), { signal });
	});

	document.addEventListener(
		"keydown",
		(e: KeyboardEvent) => {
			if (!toggle.checked || desktop.matches) return;

			if (e.key === "Escape") {
				setOpen(false, { returnFocus: true });
				return;
			}

			// Keep Tab inside the open drawer (plus the hamburger that closes it).
			if (e.key === "Tab") {
				// DOM order (the sidebar precedes the header), so first/last really are the ends.
				const stops = [...(hamburger ? [hamburger] : []), ...focusableIn(menu)].sort((a, b) =>
					a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
				);
				if (stops.length === 0) return;
				const first = stops[0];
				const last = stops[stops.length - 1];
				if (e.shiftKey && document.activeElement === first) {
					e.preventDefault();
					last.focus();
				} else if (!e.shiftKey && document.activeElement === last) {
					e.preventDefault();
					first.focus();
				} else if (!stops.includes(document.activeElement as HTMLElement)) {
					e.preventDefault();
					first.focus();
				}
			}
		},
		{ signal }
	);
}

document.addEventListener("astro:page-load", initNav);
