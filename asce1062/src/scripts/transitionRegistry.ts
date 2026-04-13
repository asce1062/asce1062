/**
 * Transition Registry
 *
 * Defines all theme/flavor transition types and their handlers.
 *
 * Each handler receives a wrapped applyChange() and an optional context.
 * The handler owns:
 *   1. Setup (overlay classes, dynamic elements)
 *   2. Calling applyChange() at the correct visual moment
 *   3. Waiting for settle (timeout-backed. never trust animationend alone)
 *   4. Cleanup (must be idempotent)
 *
 * BROWSER-ONLY. Import only from client-side <script> blocks.
 */

import type { Flavor } from "@/scripts/flavorManager";
import { registerTransitionCleanup } from "@/scripts/transitionState";

// ─── Types ──────────────────────────────────────────────────────────────────

export type TransitionStyle = "none" | "scanline" | "phosphor" | "retune" | "glitch" | "ripple" | "static" | "terminal";

export const TRANSITION_STYLES: readonly TransitionStyle[] = [
	"none",
	"scanline",
	"phosphor",
	"retune",
	"glitch",
	"ripple",
	"static",
	"terminal",
];

/** Re-export so callers don't need to import from flavorManager. */
export type { Flavor };
export const FLAVORS: readonly Flavor[] = ["", "crt-green", "amber", "synthwave", "dos", "void", "ice", "redline"];

export interface TransitionContext {
	style: TransitionStyle;
	source: "theme-toggle" | "flavor-swatch" | "transition-picker" | "init" | "soft-nav" | "programmatic";
	reason?: "user" | "restore" | "sync" | "programmatic";
	coords?: { x: number; y: number };
	triggerEl?: HTMLElement | null;
	prevTheme?: string;
	nextTheme?: string;
	prevFlavor?: Flavor;
	nextFlavor?: Flavor;
	/**
	 * Optional status line for the terminal transition.
	 * Defaults to "loading profile: [nextFlavor]" if absent.
	 */
	statusText?: string;
}

export type TransitionFn = (applyChange: () => void, ctx?: TransitionContext) => Promise<void> | void;

// ─── Flavor → Transition mapping ────────────────────────────────────────────

export const FLAVOR_TRANSITION_MAP: Record<Flavor, TransitionStyle> = {
	"": "none",
	"crt-green": "retune",
	amber: "phosphor",
	synthwave: "glitch",
	dos: "scanline",
	void: "static",
	ice: "ripple",
	redline: "glitch",
};

/** Return the transition style mapped to a given flavor. */
export function getMappedTransitionForFlavor(flavor: Flavor): TransitionStyle {
	return FLAVOR_TRANSITION_MAP[flavor] ?? "none";
}

/**
 * Resolve the effective transition style for a switch action.
 *
 * Priority:
 *   stored (explicit, including "none") > flavor mapping > "none"
 *
 * The distinction between null (no stored pref) and "none" (explicit opt-out)
 * is critical: a stored "none" means the user wants no animation and it must
 * NOT be bypassed by flavor mappings.
 */
export function resolveEffectiveTransitionStyle(stored: TransitionStyle | null, flavor: Flavor): TransitionStyle {
	if (stored !== null) return stored;
	return getMappedTransitionForFlavor(flavor);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Return the transition overlay element.
 * Used by overlay-based transition handlers (scanline, phosphor, retune, etc.)
 */
export function getOverlay(): HTMLElement | null {
	return document.getElementById("theme-transition-overlay") as HTMLElement | null;
}

/** Wait for ms milliseconds. Used by transition handlers. */
export function wait(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Clamp a number between min and max. Used by the ripple handler. */
export function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

// ─── Registry ────────────────────────────────────────────────────────────────

export const transitionRegistry: Record<TransitionStyle, TransitionFn> = {
	// ── none ──────────────────────────────────────────────────────────────────
	// Trivial passthrough. Theme change happens atomically but no overlay shown.
	none: (applyChange) => {
		applyChange();
	},

	// ── scanline ──────────────────────────────────────────────────────────────
	scanline: async (applyChange, _ctx) => {
		const overlay = getOverlay();
		if (!overlay) {
			applyChange();
			return;
		}

		const oldBg = window.getComputedStyle(document.documentElement).backgroundColor;
		overlay.style.backgroundColor = oldBg;

		let cleaned = false;
		const cleanup = (): void => {
			if (cleaned) return;
			cleaned = true;
			overlay.classList.remove("transition-scanline");
			overlay.style.backgroundColor = "";
		};
		registerTransitionCleanup(cleanup);

		// Apply change immediately (overlay is opaque from frame 0) to avoid a flash of the new theme before the overlay paints.
		applyChange();

		overlay.classList.remove("transition-scanline");
		void overlay.offsetHeight; // force reflow to restart animation
		overlay.classList.add("transition-scanline");

		await wait(520); // 420ms duration + 100ms buffer
		cleanup();
	},
	phosphor: (applyChange) => {
		applyChange();
	},
	retune: (applyChange) => {
		applyChange();
	},
	glitch: (applyChange) => {
		applyChange();
	},
	ripple: (applyChange) => {
		applyChange();
	},
	static: (applyChange) => {
		applyChange();
	},
	terminal: (applyChange) => {
		applyChange();
	},
};
