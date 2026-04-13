/**
 * Shared mutable state for the transition system.
 * Isolated to break the circular dependency between transitionRegistry <> themeTransition.
 * BROWSER-ONLY.
 */

/** Cleanup closure registered by the current in-flight handler. */
let _cleanup: (() => void) | null = null;

export function registerTransitionCleanup(fn: () => void): void {
	_cleanup = fn;
}

export function runTransitionCleanup(): void {
	_cleanup?.();
	_cleanup = null;
}
