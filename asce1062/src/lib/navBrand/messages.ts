/**
 * Navbrand message catalog + pure message selection helpers.
 *
 * This file intentionally contains no DOM logic. It is the source of truth for:
 * - phase/state-specific message pools
 * - milestone and felt-duration phrasing
 * - same-category repetition guards
 *
 * The coordinator in `src/scripts/navBrand.ts` decides *when* a state should
 * render; this module decides *what text* is eligible for that state.
 */
export type ActiveTimeBucket = "activeMorning" | "activeAfternoon" | "activeEvening" | "activeLate";

export type MessagePoolKey =
	| "arrival"
	| ActiveTimeBucket
	| "idle"
	| "idleEscalation"
	| "return"
	| "system"
	| "rare"
	| "hints";

export type MessagePool = Record<MessagePoolKey, string[]>;

export const NAVBRAND_MESSAGE_POOLS: MessagePool = {
	arrival: [
		"hello, stranger",
		"welcome back",
		"back again.",
		"you keep coming back.",
		"practically a regular",
		"asce1062 approves.",
	],
	activeMorning: ["good morning", "morning, wanderer", "systems nominal. morning light."],
	activeAfternoon: ["good afternoon", "afternoon drift detected", "sun still on the terminal"],
	activeEvening: ["good evening", "evening glow online", "night shift, then"],
	activeLate: ["still up?", "burning the midnight oil", "the terminal is still warm"],
	idle: ["still here?", "[ system idle ]", "waiting...", "terminal idle"],
	idleEscalation: ["you left the terminal open", "signal holding", "still listening"],
	return: ["welcome back.", "resuming session...", "you were reading...", "there you are."],
	system: [
		"[ syncing memory ]",
		"[ calibrating signal ]",
		"[ aligning timelines ]",
		"[ checking state ]",
		"[ restoring context ]",
	],
	rare: [
		"you found something.",
		"this wasn't meant to trigger.",
		"signal anomaly detected.",
		"well, that was unusual.",
	],
	hints: ["type / to search", "try: blog", "try: projects", "try: guestbook"],
};

/** visitor-memory greeting ladder. */
export function getMilestoneGreeting(visits: number): string {
	if (visits <= 1) return "hello, stranger";
	if (visits <= 4) return "welcome back";
	if (visits <= 9) return "back again.";
	if (visits <= 24) return "you keep coming back.";
	if (visits <= 49) return "practically a regular";
	return "asce1062 approves.";
}

/** Converts elapsed time into the intentionally fuzzy "felt duration" subline. */
export function getFeltDuration(lastVisitTs: number, now: number): string {
	const elapsed = now - lastVisitTs;
	if (elapsed <= 0) return "just here a moment ago";
	if (elapsed < 3_600_000) return "just here a moment ago";
	if (elapsed < 86_400_000) return "back the same day";
	const days = Math.floor(elapsed / 86_400_000);
	if (days < 7) return `been ${days} day${days > 1 ? "s" : ""}`;
	return "been a while";
}

/** Maps local time to the active greeting bucket used for soft-nav/return states. */
export function getActiveTimeBucket(hour: number): ActiveTimeBucket {
	if (hour >= 5 && hour < 12) return "activeMorning";
	if (hour >= 12 && hour < 17) return "activeAfternoon";
	if (hour >= 17 && hour < 21) return "activeEvening";
	return "activeLate";
}

type RandomSource = () => number;

export function pickMessage(
	pool: readonly string[],
	options: {
		lastMessage?: string | null;
		random?: RandomSource;
	} = {}
): string {
	if (pool.length === 0) return "";

	const { lastMessage = null, random = Math.random } = options;
	// When possible, drop the immediate previous message so a state/category
	// does not feel stuck on one line across quick re-renders.
	const candidates = pool.filter((message) => message !== lastMessage);
	const effectivePool = candidates.length > 0 ? candidates : [...pool];
	const index = Math.min(effectivePool.length - 1, Math.floor(random() * effectivePool.length));
	return effectivePool[index];
}

/** Convenience selector for the default active greeting path. */
export function selectActiveGreeting(options: {
	hour: number;
	lastMessage?: string | null;
	random?: RandomSource;
}): string {
	const bucket = getActiveTimeBucket(options.hour);
	return pickMessage(NAVBRAND_MESSAGE_POOLS[bucket], options);
}
