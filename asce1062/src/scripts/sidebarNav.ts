/**
 * Sidebar Navigation
 *
 * Manages the CSS checkbox-driven nav drawer state:
 * - Resets toggle on every page load / view transition
 * - Closes nav when a nav link is clicked
 * - Closes nav on Escape key and returns focus to the hamburger button
 *
 * Uses AbortController to prevent the document keydown listener from
 * accumulating across Astro soft navigations. document persists across
 * navigations; .nav-link elements do not, so those are safe without cleanup.
 */

let _ac: AbortController | null = null;

function initNav(): void {
	_ac?.abort();
	_ac = new AbortController();
	const { signal } = _ac;

	const toggle = document.getElementById("nav-toggle") as HTMLInputElement | null;
	if (!toggle) return;

	// Reset state on every page load / view transition.
	toggle.checked = false;

	// Close on nav link click. Elements are replaced on navigation; no leak.
	document.querySelectorAll<HTMLAnchorElement>(".nav-link").forEach((link) => {
		link.addEventListener(
			"click",
			() => {
				toggle.checked = false;
			},
			{ signal }
		);
	});

	// Close on Escape key. document persists — signal prevents accumulation.
	document.addEventListener(
		"keydown",
		(e: KeyboardEvent) => {
			if (e.key === "Escape" && toggle.checked) {
				toggle.checked = false;
				document.querySelector<HTMLElement>(".nav-hamburger")?.focus();
			}
		},
		{ signal }
	);
}

document.addEventListener("astro:page-load", initNav);
