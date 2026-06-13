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
export const hoverReplayLocks = new WeakSet<HTMLElement>();
const hoverReplayUnlockers = new WeakMap<HTMLElement, EventListener>();

export function clearActiveEffect(el: HTMLElement): void {
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
}

export function clearTriggerBindings(el: HTMLElement): void {
	const cleanups = triggerCleanups.get(el) ?? [];
	for (const cleanup of cleanups) cleanup();
	triggerCleanups.delete(el);
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
