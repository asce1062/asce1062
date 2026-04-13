/**
 * Theme Transition Utility
 *
 * Orchestrates atomic theme/flavor switching by dispatching to a transition
 * handler from the registry. The handler controls the visual presentation.
 *
 * THE PROBLEM
 * -----------
 * When data-theme or data-flavor changes, CSS variables cascade immediately.
 * Different transition rules cause elements to repaint at different rates (stagger wave).
 * Every handler must call the wrapped applyChange() which
 * stamps data-theme-switching on <html> to freeze all per-element transitions,
 * then releases after 2 rAFs.
 *
 * ARCHITECTURE
 * ------------
 * atomicSwitch(userApply, ctx):
 *   1. Reduced-motion check → instant apply + freeze + return
 *   2. Cancel-and-replace any in-flight transition
 *   3. Build wrappedApply (= userApply wrapped with freeze/unfreeze)
 *   4. Dispatch to registry[ctx.style](wrappedApply, ctx)
 *
 * Handlers call wrappedApply() at their chosen visual moment.
 *
 * BROWSER-ONLY. Import only from client-side <script> blocks.
 */

import { transitionRegistry, type TransitionContext, type TransitionStyle } from "@/scripts/transitionRegistry";
import { getStoredTransition } from "@/scripts/transitionManager";
import { runTransitionCleanup } from "@/scripts/transitionState";

/** Fired on document just before the DOM change is applied. */
export const THEME_SWITCH_START = "theme-switch-start";

/** Fired on document after the transition freeze is lifted. */
export const THEME_SWITCH_END = "theme-switch-end";

// ─── In-flight guard ─────────────────────────────────────────────────────────

/** Current in-flight transition controller. null = nothing running. */
let _inFlight: AbortController | null = null;

// ─── Freeze helpers ───────────────────────────────────────────────────────────

/** Stamp data-theme-switching on <html> to freeze all per-element transitions. */
function freezeTransitions(): void {
	document.documentElement.setAttribute("data-theme-switching", "");
}

/** Remove the freeze after 2 rAFs (one full repaint cycle). */
function unfreezeTransitions(): void {
	requestAnimationFrame(() => {
		requestAnimationFrame(() => {
			document.documentElement.removeAttribute("data-theme-switching");
			document.dispatchEvent(new CustomEvent(THEME_SWITCH_END));
		});
	});
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Apply a theme/flavor change atomically via the registered transition handler.
 *
 * @param userApply  - the actual DOM mutation (setTheme / setFlavor call)
 * @param ctx        - optional context; style defaults to stored pref or "none"
 *
 * Handlers receive a wrappedApply that handles the freeze/unfreeze cycle.
 * The handler decides WHEN to call wrappedApply() for its visual effect.
 */
export function atomicSwitch(userApply: () => void, ctx?: Partial<TransitionContext>): void {
	const root = document.documentElement;

	// ── Reduced-motion short-circuit ──────────────────────────────────────────
	// Bypass all visual transitions. Atomic freeze still runs to prevent stagger.
	if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
		freezeTransitions();
		userApply();
		unfreezeTransitions();
		return;
	}

	// ── Terminal guard: never fire on init/soft-nav ───────────────────────────
	const source = ctx?.source ?? "programmatic";
	const style: TransitionStyle = ctx?.style ?? getStoredTransition() ?? "none";

	if (style === "terminal" && (source === "init" || source === "soft-nav")) {
		freezeTransitions();
		userApply();
		unfreezeTransitions();
		return;
	}

	// ── Cancel-and-replace ────────────────────────────────────────────────────
	if (_inFlight) {
		_inFlight.abort();
		runTransitionCleanup();
		// Remove freeze from prior run if it's still active
		root.removeAttribute("data-theme-switching");
	}
	_inFlight = new AbortController();
	const signal = _inFlight.signal;

	// ── Build wrapped apply ───────────────────────────────────────────────────
	// Handlers call this at their chosen visual moment.
	const wrappedApply = (): void => {
		if (signal.aborted) return;
		freezeTransitions();
		document.dispatchEvent(new CustomEvent(THEME_SWITCH_START));
		userApply();
		unfreezeTransitions();
	};

	// ── Dispatch to registry ──────────────────────────────────────────────────
	const fullCtx: TransitionContext = {
		style,
		source,
		reason: ctx?.reason ?? "user",
		coords: ctx?.coords,
		triggerEl: ctx?.triggerEl,
		prevTheme: ctx?.prevTheme,
		nextTheme: ctx?.nextTheme,
		prevFlavor: ctx?.prevFlavor,
		nextFlavor: ctx?.nextFlavor,
		statusText: ctx?.statusText,
	};

	const handler = transitionRegistry[style] ?? transitionRegistry.none;
	Promise.resolve(handler(wrappedApply, fullCtx)).finally(() => {
		if (!signal.aborted) {
			_inFlight = null;
		}
	});
}

export { registerTransitionCleanup } from "@/scripts/transitionState";
