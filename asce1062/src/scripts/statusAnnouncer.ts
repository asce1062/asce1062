/**
 * Status Announcer
 *
 * One visually hidden polite live region for short outcome messages
 * ("Copied ...", "Copy failed"). Controls that carry an aria-label never have
 * their icon swap or inner text read out, so the outcome is announced here.
 *
 * BROWSER-ONLY. Import only from client-side <script> blocks.
 */

const STATUS_ID = "status-announcer";
const ANNOUNCE_DELAY = 50; // ms. lets the cleared region register before the new text

/**
 * Make sure the live region exists. Call this before the first announcement
 * (at init time): a region created in the same tick as its text is not read.
 */
export function ensureStatusRegion(): HTMLElement {
	const existing = document.getElementById(STATUS_ID);
	if (existing) return existing;

	const region = document.createElement("span");
	region.id = STATUS_ID;
	region.className = "sr-only";
	region.setAttribute("role", "status");
	region.setAttribute("aria-live", "polite");
	document.body.appendChild(region);
	return region;
}

/** Announce a message politely. Repeating the same message announces it again. */
export function announceStatus(message: string): void {
	ensureStatusRegion().textContent = "";
	window.setTimeout(() => {
		// Looked up again: a soft navigation may have replaced the body meanwhile.
		ensureStatusRegion().textContent = message;
	}, ANNOUNCE_DELAY);
}
