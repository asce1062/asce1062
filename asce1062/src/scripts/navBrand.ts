/**
 * Navbrand coordinator.
 *
 * Responsibilities:
 * - listen to browser/session activity
 * - manage navbrand timers and state transitions
 * - coordinate storage reads/writes for visit memory
 * - render greeting/subline updates
 * - delegate pure policy decisions to `src/lib/navBrand/*`
 *
 * This file should stay as the browser-facing orchestrator, not the place where
 * message selection or state/effect rules are invented.
 */
import { PREF_KEYS, getPref, setPref } from "@/lib/prefs";
import {
	applyCursorMode,
	applyNavBrandPresentation,
	getCursorModeForState,
	type NavBrandTone,
} from "@/lib/navBrand/cursor";
import {
	NAVBRAND_MESSAGE_POOLS,
	getFeltDuration,
	getMilestoneGreeting,
	pickMessage,
	selectActiveGreeting,
} from "@/lib/navBrand/messages";
import {
	HINT_STATE_DURATION_MS,
	IDLE_DELAY_MS,
	RARE_MESSAGE_COOLDOWN_MS,
	RETURN_SETTLE_MS,
	SYSTEM_MESSAGE_COOLDOWN_MS,
	SYSTEM_STATE_DURATION_MS,
	RARE_MESSAGE_CHANCE,
	SYSTEM_MESSAGE_CHANCE,
	chooseTransitionEffect,
	shouldShowRareMessage,
	shouldShowSystemMessage,
	type NavBrandState,
} from "@/lib/navBrand/state";
import { NAVBRAND_OPEN_TERMINAL_EVENT, type NavBrandTerminalOpenDetail } from "@/lib/navBrand/terminalEvents";
import { playNavBrandEffect, resetNavBrandEffect } from "@/lib/navBrand/effects";

const SESSION_KEY = "nav-brand-visited";
const NAVBRAND_TERMINAL_TEASER_HINT = "open terminal";
const NAVBRAND_TERMINAL_TEASER_SUBLINE = "search, explore, tune the signal";

type MessageCategory = keyof typeof NAVBRAND_MESSAGE_POOLS;

type NavBrandElements = {
	root: HTMLElement | null;
	greeting: HTMLElement | null;
	subRow: HTMLElement | null;
	subline: HTMLElement | null;
	cursor: HTMLElement | null;
	teaserTrigger: HTMLElement | null;
	teaserText: HTMLElement | null;
};

type RenderState = {
	state: NavBrandState;
	greeting: string;
	subline: string | null;
	mode: "arrival" | "tod";
	tone?: NavBrandTone;
};

type NavBrandMemory = {
	lastState: NavBrandState;
	lastGreetingByCategory: Partial<Record<MessageCategory, string>>;
	lastGreetingText: string | null;
	lastSystemTs: number;
	lastRareTs: number;
	lastEffectTs: number;
	lastIdleTs: number;
	lastReturnTs: number;
	idleCount: number;
};

declare global {
	interface DocumentEventMap {
		[NAVBRAND_OPEN_TERMINAL_EVENT]: CustomEvent<NavBrandTerminalOpenDetail>;
	}
}

let elements: NavBrandElements = getElements();
let idleTimer: number | null = null;
let settleTimer: number | null = null;
let hintTimer: number | null = null;
let listenersBound = false;
let motionMedia: MediaQueryList | null = null;
let lastActivityTs = Date.now();

const memory: NavBrandMemory = {
	lastState: "arrival",
	lastGreetingByCategory: {},
	lastGreetingText: null,
	lastSystemTs: 0,
	lastRareTs: 0,
	lastEffectTs: 0,
	lastIdleTs: 0,
	lastReturnTs: 0,
	idleCount: 0,
};

function getVisitCount(): number {
	const n = parseInt(getPref(PREF_KEYS.navBrandVisits) ?? "0", 10);
	return Number.isFinite(n) && n >= 0 ? n : 0;
}

function getLastVisitTs(): number {
	const n = parseInt(getPref(PREF_KEYS.navBrandLastVisit) ?? "0", 10);
	return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** Query on each render so Astro soft navigations always get fresh nodes. */
function getElements(): NavBrandElements {
	return {
		root: document.querySelector(".nav-brand-prompt"),
		greeting: document.getElementById("nav-brand-greeting"),
		subRow: document.getElementById("nav-brand-sub-row"),
		subline: document.getElementById("nav-brand-sub"),
		cursor: document.querySelector(".nav-brand-cursor"),
		teaserTrigger: document.querySelector("[data-navbrand-terminal-trigger]"),
		teaserText: document.getElementById("nav-brand-teaser"),
	};
}

function isReducedMotion(): boolean {
	return motionMedia?.matches ?? false;
}

function getSessionFlag(): boolean {
	try {
		return !!sessionStorage.getItem(SESSION_KEY);
	} catch {
		return false;
	}
}

function setSessionFlag(): void {
	try {
		sessionStorage.setItem(SESSION_KEY, "1");
	} catch {
		// sessionStorage unavailable. silently no-op
	}
}

function clearTimer(timer: number | null): null {
	if (timer !== null) window.clearTimeout(timer);
	return null;
}

/** Subline visibility remains CSS-driven; JS only updates content and collapsed height. */
function setSubline(subline: string | null): void {
	if (!elements.subRow || !elements.subline) return;

	if (subline) {
		elements.subline.textContent = subline;
		elements.subline.setAttribute("aria-hidden", "false");
		elements.subRow.style.maxHeight = "2em";
		elements.subRow.style.opacity = "1";
	} else {
		elements.subline.textContent = "";
		elements.subline.setAttribute("aria-hidden", "true");
		elements.subRow.style.maxHeight = "0";
		elements.subRow.style.opacity = "0";
	}
}

function setTeaserText(text: string): void {
	elements = getElements();
	if (!elements.teaserText) return;
	elements.teaserText.textContent = text;
}

/**
 * Single render entrypoint.
 *
 * State/effect/cursor choices are delegated outward; this function applies the
 * resulting presentation in one place so the DOM contract stays compact.
 */
function renderNavBrand({ state, greeting, subline, mode, tone = "normal" }: RenderState): void {
	elements = getElements();
	if (!elements.greeting) return;

	const previousState = memory.lastState;
	const now = Date.now();
	const effect = chooseTransitionEffect({
		fromState: previousState,
		toState: state,
		tone,
		reducedMotion: isReducedMotion(),
		lastEffectTs: memory.lastEffectTs,
		now,
		randomValue: Math.random(),
		decryptRandomValue: Math.random(),
	});

	elements.greeting.dataset.mode = mode;
	setSubline(subline);

	applyNavBrandPresentation(elements.root, {
		state,
		effect,
		tone,
	});
	applyCursorMode(elements.cursor, getCursorModeForState(state, isReducedMotion()));
	resetNavBrandEffect(elements.greeting, elements.root);
	playNavBrandEffect({
		el: elements.greeting,
		rootEl: elements.root,
		effect,
		text: greeting,
	});

	if (state !== "hint") {
		hintTimer = clearTimer(hintTimer);
		setTeaserText(NAVBRAND_TERMINAL_TEASER_HINT);
	}

	if (effect !== "none") {
		memory.lastEffectTs = now;
	}

	memory.lastState = state;
	memory.lastGreetingText = greeting;
}

/** Preserve the original visit-count/felt-duration subline behavior from Phase 1. */
function getSubline(lastVisitTsOverride?: number): string | null {
	const visits = getVisitCount();
	if (visits < 2) return null;
	return `visit ${visits} · ${getFeltDuration(lastVisitTsOverride ?? getLastVisitTs(), Date.now())}`;
}

function choosePoolMessage(category: MessageCategory): string {
	const greeting = pickMessage(NAVBRAND_MESSAGE_POOLS[category], {
		lastMessage: memory.lastGreetingByCategory[category] ?? null,
	});
	memory.lastGreetingByCategory[category] = greeting;
	return greeting;
}

function renderHint(greeting: string, subline = getSubline()): void {
	renderNavBrand({
		state: "hint",
		greeting,
		subline,
		mode: "tod",
	});

	hintTimer = clearTimer(hintTimer);
	hintTimer = window.setTimeout(() => {
		if (memory.lastState === "hint") {
			renderActive({ allowSystem: false });
		}
	}, HINT_STATE_DURATION_MS);
}

function chooseSystemOverride(): { message: string; tone: NavBrandTone } | null {
	const now = Date.now();
	if (
		shouldShowRareMessage({
			now,
			lastRareTs: memory.lastRareTs,
			randomValue: Math.random(),
			chance: RARE_MESSAGE_CHANCE,
			cooldownMs: RARE_MESSAGE_COOLDOWN_MS,
		})
	) {
		const message = choosePoolMessage("rare");
		memory.lastRareTs = now;
		memory.lastSystemTs = now;
		return { message, tone: "rare" };
	}

	if (
		shouldShowSystemMessage({
			now,
			lastSystemTs: memory.lastSystemTs,
			randomValue: Math.random(),
			chance: SYSTEM_MESSAGE_CHANCE,
			cooldownMs: SYSTEM_MESSAGE_COOLDOWN_MS,
		})
	) {
		const message = choosePoolMessage("system");
		memory.lastSystemTs = now;
		return { message, tone: "normal" };
	}

	return null;
}

/** System/rare messages temporarily override active or return copy, then settle back. */
function maybeRenderSystem(origin: "active" | "return", subline: string | null): boolean {
	const override = chooseSystemOverride();
	if (!override) return false;

	renderNavBrand({
		state: "system",
		greeting: override.message,
		subline,
		mode: "tod",
		tone: override.tone,
	});

	settleTimer = clearTimer(settleTimer);
	settleTimer = window.setTimeout(() => {
		if (origin === "return") {
			renderActive();
			return;
		}

		if (memory.lastState === "system") {
			renderActive({ allowSystem: false });
		}
	}, SYSTEM_STATE_DURATION_MS);

	return true;
}

function renderArrival(previousLastVisitTs: number): void {
	settleTimer = clearTimer(settleTimer);
	renderNavBrand({
		state: "arrival",
		greeting: getMilestoneGreeting(getVisitCount()),
		subline: getSubline(previousLastVisitTs),
		mode: "arrival",
	});
}

function renderActive(options: { allowSystem?: boolean } = {}): void {
	settleTimer = clearTimer(settleTimer);
	const subline = getSubline();
	if (options.allowSystem !== false && maybeRenderSystem("active", subline)) return;

	renderNavBrand({
		state: "active",
		greeting: selectActiveGreeting({
			hour: new Date().getHours(),
			lastMessage: memory.lastGreetingByCategory[getActiveCategory()],
		}),
		subline,
		mode: "tod",
	});
	memory.lastGreetingByCategory[getActiveCategory()] = memory.lastGreetingText ?? undefined;
}

function getActiveCategory(): MessageCategory {
	const hour = new Date().getHours();
	if (hour >= 5 && hour < 12) return "activeMorning";
	if (hour >= 12 && hour < 17) return "activeAfternoon";
	if (hour >= 17 && hour < 21) return "activeEvening";
	return "activeLate";
}

function renderIdle(): void {
	settleTimer = clearTimer(settleTimer);
	const now = Date.now();
	const category: MessageCategory = memory.idleCount > 0 ? "idleEscalation" : "idle";
	const greeting = choosePoolMessage(category);
	memory.lastIdleTs = now;
	memory.idleCount += 1;

	renderNavBrand({
		state: "idle",
		greeting,
		subline: getSubline(),
		mode: "tod",
	});
}

function renderReturn(): void {
	const now = Date.now();
	memory.lastReturnTs = now;
	lastActivityTs = now;

	const subline = getSubline();
	if (maybeRenderSystem("return", subline)) {
		scheduleIdleTimer();
		return;
	}

	renderNavBrand({
		state: "return",
		greeting: choosePoolMessage("return"),
		subline,
		mode: "tod",
	});

	settleTimer = clearTimer(settleTimer);
	settleTimer = window.setTimeout(() => renderActive({ allowSystem: false }), RETURN_SETTLE_MS);
	scheduleIdleTimer();
}

function getTeaserTrigger(target: EventTarget | null): HTMLElement | null {
	if (!(target instanceof Element)) return null;
	return target.closest<HTMLElement>("[data-navbrand-terminal-trigger]");
}

function isWithinTeaser(relatedTarget: EventTarget | null): boolean {
	return getTeaserTrigger(relatedTarget) !== null;
}

function restoreAfterTeaserHint(): void {
	if (memory.lastState === "hint") {
		renderActive({ allowSystem: false });
	}
}

/**
 * Task 2 boundary:
 * the sidebar no longer owns terminal execution. It only advertises intent by
 * dispatching a single custom event. Task 3's modal coordinator should listen
 * for `navbrand:open-terminal` and decide how to open the shared terminal
 * window for the reported source/trigger combination.
 */
function dispatchOpenTerminal(trigger: NavBrandTerminalOpenDetail["trigger"], target: HTMLElement): void {
	document.dispatchEvent(
		new CustomEvent<NavBrandTerminalOpenDetail>(NAVBRAND_OPEN_TERMINAL_EVENT, {
			detail: {
				source: target.dataset.navbrandTerminalSource ?? "sidebar-expanded",
				trigger,
			},
		})
	);
}

/** Reset idle after meaningful activity while respecting hidden-tab pauses. */
function scheduleIdleTimer(): void {
	idleTimer = clearTimer(idleTimer);
	if (document.visibilityState === "hidden") return;

	const delay = Math.max(0, IDLE_DELAY_MS - (Date.now() - lastActivityTs));
	idleTimer = window.setTimeout(() => {
		if (document.visibilityState === "visible" && memory.lastState !== "idle") {
			renderIdle();
		}
	}, delay);
}

function onActivity(): void {
	lastActivityTs = Date.now();
	scheduleIdleTimer();

	if (memory.lastState === "idle") {
		renderActive();
	}
}

function onNewVisit(): void {
	const now = Date.now();
	const previousLastVisitTs = getLastVisitTs();
	setPref(PREF_KEYS.navBrandVisits, String(getVisitCount() + 1));
	setPref(PREF_KEYS.navBrandLastVisit, String(now));
	setSessionFlag();
	lastActivityTs = now;
	renderArrival(previousLastVisitTs);
	scheduleIdleTimer();
}

function onSoftNav(): void {
	lastActivityTs = Date.now();
	renderActive();
	scheduleIdleTimer();
}

function bindListeners(): void {
	if (listenersBound) return;
	listenersBound = true;

	const activityEvents: Array<keyof DocumentEventMap> = ["pointermove", "pointerdown", "keydown", "click", "focusin"];
	for (const eventName of activityEvents) {
		document.addEventListener(eventName, onActivity, { passive: true });
	}

	document.addEventListener("pointerover", (event) => {
		if (!getTeaserTrigger(event.target)) return;
		setTeaserText("launch terminal");
		renderHint(NAVBRAND_TERMINAL_TEASER_HINT, NAVBRAND_TERMINAL_TEASER_SUBLINE);
	});

	document.addEventListener("focusin", (event) => {
		if (!getTeaserTrigger(event.target)) return;
		setTeaserText("press enter");
		renderHint(NAVBRAND_TERMINAL_TEASER_HINT, NAVBRAND_TERMINAL_TEASER_SUBLINE);
	});

	document.addEventListener("pointerout", (event) => {
		if (!getTeaserTrigger(event.target) || isWithinTeaser(event.relatedTarget)) return;
		restoreAfterTeaserHint();
	});

	document.addEventListener("focusout", (event) => {
		if (!getTeaserTrigger(event.target) || isWithinTeaser(event.relatedTarget)) return;
		restoreAfterTeaserHint();
	});

	document.addEventListener("click", (event) => {
		const teaserTrigger = getTeaserTrigger(event.target);
		if (!teaserTrigger) return;
		if (event.detail === 0) return;
		event.preventDefault();
		dispatchOpenTerminal("pointer", teaserTrigger);
	});

	document.addEventListener("keydown", (event) => {
		const teaserTrigger = getTeaserTrigger(event.target);
		if (!teaserTrigger) return;
		if (event.key !== "Enter" && event.key !== " ") return;

		event.preventDefault();
		dispatchOpenTerminal("keyboard", teaserTrigger);
	});

	window.addEventListener("focus", onActivity);
	window.addEventListener("blur", () => {
		idleTimer = clearTimer(idleTimer);
	});

	document.addEventListener("visibilitychange", () => {
		if (document.visibilityState === "visible") {
			renderReturn();
		} else {
			// Hidden tabs should not accumulate idle/system timers in the background.
			idleTimer = clearTimer(idleTimer);
			settleTimer = clearTimer(settleTimer);
			hintTimer = clearTimer(hintTimer);
			setTeaserText(NAVBRAND_TERMINAL_TEASER_HINT);
		}
	});
}

function initMotionListener(): void {
	if (motionMedia) return;
	motionMedia = window.matchMedia("(prefers-reduced-motion: reduce)");
	motionMedia.addEventListener("change", () => {
		applyCursorMode(elements.cursor, getCursorModeForState(memory.lastState, isReducedMotion()));
	});
}

if (typeof document !== "undefined") {
	initMotionListener();
	bindListeners();

	document.addEventListener("astro:page-load", () => {
		elements = getElements();
		if (!getSessionFlag()) {
			onNewVisit();
		} else {
			onSoftNav();
		}
	});
}
