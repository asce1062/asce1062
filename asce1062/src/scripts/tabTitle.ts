/**
 * Inactive Tab Title
 *
 * Swaps document.title when the user switches away from the tab,
 * then restores the real title when they return.
 *
 * OG / SEO safety: og:title and <title> in <head> are server-rendered at
 * build time. This script only mutates document.title client-side
 * (sharing cards always see the SSR value).
 *
 * Astro ClientRouter compatibility:
 *   - "astro:page-load" fires on both the initial hard load and every soft
 *     navigation, so activeTitle always reflects the current page's title.
 *   - The "visibilitychange" listener is registered once at module scope
 *     (not re-registered on each page load) to avoid stacking duplicates.
 */

const INACTIVE_MESSAGES = [
	"psst. still here.",
	"[ tab: open | user: afk ]",
	"come back when you're ready.",
	"waiting for input_",
] as const;

let messageIndex = 0;

function nextInactiveMessage(): string {
	const msg = INACTIVE_MESSAGES[messageIndex % INACTIVE_MESSAGES.length];
	messageIndex++;
	return msg;
}

// Guard prevents ReferenceError in SSR / node environments.
if (typeof document !== "undefined") {
	let activeTitle = document.title;

	document.addEventListener("astro:page-load", () => {
		activeTitle = document.title;
	});

	document.addEventListener("visibilitychange", () => {
		if (document.visibilityState === "hidden") {
			document.title = nextInactiveMessage();
		} else {
			document.title = activeTitle;
		}
	});
}
