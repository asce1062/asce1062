/**
 * Inactive Tab Title
 *
 * Swaps document.title when the user switches away from the tab,
 * then restores the real title when they return.
 *
 * Messages are grouped into three tiers tied to idle duration:
 *   Tier 1 (0–10s)  — playful, warm, immediate
 *   Tier 2 (10–30s) — system / terminal, calm machine energy
 *   Tier 3 (30s+)   — cosmic / reflective, loops indefinitely
 *
 * Rotation: every 8s via setInterval. Tier transitions happen on the
 * next tick after the boundary — index resets to 0 on tier change.
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

const TIER_1 = [
	"psst. still here.",
	"i'll be here when you get back ^^",
	"take your time. really.",
	"come back when you're ready.",
] as const;

const TIER_2 = [
	"[ heartbeat: slow | system: calm ]",
	"awaiting your command_",
	"process paused. not terminated.",
	"background processes dreaming…",
] as const;

const TIER_3 = [
	"somewhere, a star flickers.",
	"the void hums quietly.",
	"nothing happening ≠ nothing alive",
	"idling like an old machine at 2am.",
] as const;

const ROTATE_MS = 8_000;
const TIER_2_AFTER_MS = 10_000;
const TIER_3_AFTER_MS = 30_000;

function getTier(idleMs: number): readonly string[] {
	if (idleMs < TIER_2_AFTER_MS) return TIER_1;
	if (idleMs < TIER_3_AFTER_MS) return TIER_2;
	return TIER_3;
}

// Guard prevents ReferenceError in SSR / node environments.
if (typeof document !== "undefined") {
	let activeTitle = document.title;
	let rotateTimer: ReturnType<typeof setInterval> | null = null;

	document.addEventListener("astro:page-load", () => {
		activeTitle = document.title;
	});

	document.addEventListener("visibilitychange", () => {
		if (document.visibilityState === "hidden") {
			const hideTime = Date.now();
			let prevTier = getTier(0);
			let idx = 0;

			document.title = prevTier[idx];

			rotateTimer = setInterval(() => {
				const idle = Date.now() - hideTime;
				const currentTier = getTier(idle);

				if (currentTier !== prevTier) {
					prevTier = currentTier;
					idx = 0;
				} else {
					idx = (idx + 1) % currentTier.length;
				}

				document.title = currentTier[idx];
			}, ROTATE_MS);
		} else {
			if (rotateTimer !== null) {
				clearInterval(rotateTimer);
				rotateTimer = null;
			}
			document.title = activeTitle;
		}
	});
}
