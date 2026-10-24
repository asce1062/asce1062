import type { ActiveEffectHandle, IntervalHandle } from "./types";

export const activeEffects = new WeakMap<HTMLElement, ActiveEffectHandle>();
export const triggerHandlers = new WeakMap<
	HTMLElement,
	{
		mouseenter: EventListener;
		mouseleave: EventListener;
		focusin: EventListener;
		touchstart: EventListener;
		click: EventListener;
	}
>();
export const randomTimers = new WeakMap<HTMLElement, IntervalHandle>();
const triggerCleanups = new WeakMap<HTMLElement, Array<() => void>>();
/** Elements with live bindings, so swapped-out ones can be found and released. */
const boundElements = new Set<HTMLElement>();
export const hoverReplayLocks = new WeakSet<HTMLElement>();
const hoverReplayUnlockers = new WeakMap<HTMLElement, EventListener>();

/**
 * Work an effect keeps doing after it resolves (the glitch shimmer). It is no
 * longer the active effect, so it registers its own stop here.
 */
const postEffectStops = new WeakMap<HTMLElement, () => void>();

export function registerPostEffectStop(el: HTMLElement, stop: () => void): void {
	postEffectStops.get(el)?.();
	postEffectStops.set(el, stop);
}

export function stopPostEffect(el: HTMLElement): void {
	postEffectStops.get(el)?.();
	postEffectStops.delete(el);
}

export function clearActiveEffect(el: HTMLElement): void {
	stopPostEffect(el);
	activeEffects.get(el)?.cancel();
	activeEffects.delete(el);
}

export function hasActiveEffect(el: HTMLElement): boolean {
	return activeEffects.has(el);
}

export function registerTriggerCleanup(el: HTMLElement, cleanup: () => void): void {
	const cleanups = triggerCleanups.get(el) ?? [];
	cleanups.push(cleanup);
	triggerCleanups.set(el, cleanups);
	boundElements.add(el);
}

export function clearTriggerBindings(el: HTMLElement): void {
	const cleanups = triggerCleanups.get(el) ?? [];
	for (const cleanup of cleanups) cleanup();
	triggerCleanups.delete(el);
	boundElements.delete(el);
}

/**
 * Release every binding whose element is no longer in the document: its
 * listeners, observers and timers, and any effect still running on it. Call
 * after a soft navigation swap; persisted elements stay connected and keep
 * their bindings.
 */
export function releaseDetachedTriggerBindings(): void {
	for (const el of boundElements) {
		if (el.isConnected !== false) continue;
		clearTriggerBindings(el);
		clearActiveEffect(el);
	}
}

function clearHoverReplayLock(el: HTMLElement): void {
	hoverReplayLocks.delete(el);
	const unlock = hoverReplayUnlockers.get(el);
	if (unlock && typeof document !== "undefined") {
		document.removeEventListener("mousemove", unlock);
		document.removeEventListener("pointerdown", unlock);
		document.removeEventListener("touchstart", unlock);
	}
	hoverReplayUnlockers.delete(el);
}

export function scheduleHoverReplayUnlock(el: HTMLElement): void {
	if (!hoverReplayLocks.has(el) || hoverReplayUnlockers.has(el)) return;
	if (typeof document === "undefined") {
		clearHoverReplayLock(el);
		return;
	}

	const unlock = () => clearHoverReplayLock(el);
	hoverReplayUnlockers.set(el, unlock);
	document.addEventListener("mousemove", unlock, { once: true });
	document.addEventListener("pointerdown", unlock, { once: true });
	document.addEventListener("touchstart", unlock, { once: true });
	registerTriggerCleanup(el, () => clearHoverReplayLock(el));
}
