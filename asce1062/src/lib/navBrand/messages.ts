/**
 * Navbrand message catalog + pure message selection helpers.
 *
 * This file intentionally contains no DOM logic. It is the source of truth for:
 * - state-specific message pools
 * - milestone and felt-duration phrasing
 * - same-category repetition guards
 *
 * The coordinator in `src/scripts/navBrand.ts` decides *when* a state should
 * render; this module decides *what text* is eligible for that state.
 */
export type ActiveTimeBucket = "activeMorning" | "activeAfternoon" | "activeEvening" | "activeLate";
export type TerminalAtmosphereReason = "load" | "route-enter" | "resume" | "idle" | "idle-return" | "random-time";

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

/**
 * Terminal header presence copy stays intentionally small and durable because it
 * lives above the scrolling log. The badge label is separated from the fuzzy
 * time text so future iterations can change the label vocabulary without
 * rewriting terminal rendering or localStorage handling.
 */
export function getTerminalPresenceSummary(options: { visits: number; lastVisitTs?: number | null; now: number }): {
	lastSeenBadge: string;
	lastSeenText: string;
	visits: number;
} {
	const visits = Math.max(1, Math.floor(options.visits) || 1);
	const lastVisitTs = options.lastVisitTs ?? null;

	if (!lastVisitTs || lastVisitTs <= 0) {
		return {
			lastSeenBadge: "first contact",
			lastSeenText: "new to the signal",
			visits,
		};
	}

	return {
		lastSeenBadge: "last seen",
		lastSeenText: getFeltDuration(lastVisitTs, options.now),
		visits,
	};
}

/** Maps local time to the active greeting bucket used for soft-nav/return states. */
export function getActiveTimeBucket(hour: number): ActiveTimeBucket {
	if (hour >= 5 && hour < 12) return "activeMorning";
	if (hour >= 12 && hour < 17) return "activeAfternoon";
	if (hour >= 17 && hour < 22) return "activeEvening";
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

/**
 * Terminal header atmosphere stays in the same message universe as the
 * sidebar navbrand, but its selection rules are slightly different because the
 * terminal needs a persistent, self-contained ambient line while it overlays
 * the rest of the page.
 */
export function selectTerminalAtmosphereMessage(options: {
	reason: TerminalAtmosphereReason;
	hour: number;
	visits: number;
	idleCount?: number;
	lastMessage?: string | null;
	systemEligible?: boolean;
	rareEligible?: boolean;
	random?: RandomSource;
}): {
	category: MessagePoolKey;
	message: string;
} {
	const {
		reason,
		hour,
		visits,
		idleCount = 0,
		lastMessage = null,
		systemEligible = false,
		rareEligible = false,
		random = Math.random,
	} = options;

	if (reason === "load" || reason === "route-enter") {
		if (visits <= 1) {
			return {
				category: "arrival",
				message: pickMessage(NAVBRAND_MESSAGE_POOLS.arrival, { lastMessage, random }),
			};
		}

		const category = getActiveTimeBucket(hour);
		return {
			category,
			message: pickMessage(NAVBRAND_MESSAGE_POOLS[category], { lastMessage, random }),
		};
	}

	if (reason === "resume" || reason === "idle-return") {
		return {
			category: "return",
			message: pickMessage(NAVBRAND_MESSAGE_POOLS.return, { lastMessage, random }),
		};
	}

	if (reason === "idle") {
		const category: MessagePoolKey = idleCount > 0 ? "idleEscalation" : "idle";
		return {
			category,
			message: pickMessage(NAVBRAND_MESSAGE_POOLS[category], { lastMessage, random }),
		};
	}

	if (rareEligible) {
		return {
			category: "rare",
			message: pickMessage(NAVBRAND_MESSAGE_POOLS.rare, { lastMessage, random }),
		};
	}

	if (systemEligible) {
		return {
			category: "system",
			message: pickMessage(NAVBRAND_MESSAGE_POOLS.system, { lastMessage, random }),
		};
	}

	if (random() < 0.28) {
		return {
			category: "hints",
			message: pickMessage(NAVBRAND_MESSAGE_POOLS.hints, { lastMessage, random }),
		};
	}

	const category = getActiveTimeBucket(hour);
	return {
		category,
		message: pickMessage(NAVBRAND_MESSAGE_POOLS[category], { lastMessage, random }),
	};
}
