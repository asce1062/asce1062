// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	COLLAPSED_NUDGE_INITIAL_DELAY_MS,
	COLLAPSED_NUDGE_VISIBLE_DURATION_MS,
	IDLE_DELAY_MS,
} from "@/lib/navBrand/state";

vi.mock("@/scripts/feedbackManager", () => ({
	copyToClipboard: vi.fn(),
	initShareNotification: vi.fn(),
}));

type BoundListener = { target: EventTarget; args: Parameters<EventTarget["addEventListener"]> };

const SIDEBAR_MARKUP = `
	<div class="nav-brand-prompt" data-navbrand-terminal-trigger data-navbrand-terminal-source="sidebar-expanded">
		<span id="nav-brand-greeting"></span>
		<div id="nav-brand-sub-row"><span id="nav-brand-sub"></span></div>
		<span id="nav-brand-teaser"></span>
		<span id="nav-brand-visit-count"></span>
	</div>
	<button data-navbrand-terminal-trigger data-navbrand-terminal-source="sidebar-collapsed"></button>`;

/** The module binds document/window listeners on import, so each test unbinds its own copy. */
let boundListeners: BoundListener[] = [];

function trackListeners(target: EventTarget): void {
	const original = target.addEventListener.bind(target);
	vi.spyOn(target, "addEventListener").mockImplementation((...args: BoundListener["args"]) => {
		boundListeners.push({ target, args });
		original(...args);
	});
}

const brandState = () => document.querySelector<HTMLElement>(".nav-brand-prompt")?.dataset.navbrandState;
const collapsedTrigger = () =>
	document.querySelector<HTMLElement>('[data-navbrand-terminal-source="sidebar-collapsed"]')!;
const pageLoad = () => document.dispatchEvent(new Event("astro:page-load"));
const beforeSwap = () => document.dispatchEvent(new Event("astro:before-swap"));

/** Mirrors an Astro soft navigation: the sidebar is not persisted, so its nodes are replaced. */
function softNavigate(): void {
	beforeSwap();
	document.body.innerHTML = SIDEBAR_MARKUP;
	pageLoad();
}

async function loadNavBrand(): Promise<void> {
	vi.resetModules();
	await import("@/scripts/navBrand");
	pageLoad();
}

describe("nav brand timers", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-01-01T12:00:00"));
		// High roll: no system/rare override, no chance-gated curiosity pulse.
		vi.spyOn(Math, "random").mockReturnValue(0.99);
		localStorage.clear();
		sessionStorage.setItem("nav-brand-visited", "1");
		document.documentElement.removeAttribute("data-sidebar-collapsed");
		document.body.innerHTML = SIDEBAR_MARKUP;
		boundListeners = [];
		trackListeners(document);
		trackListeners(window);
	});

	afterEach(() => {
		for (const { target, args } of boundListeners) target.removeEventListener(args[0], args[1], args[2]);
		vi.clearAllTimers();
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	describe("idle timer", () => {
		it("does not create or clear a timer per pointermove", async () => {
			await loadNavBrand();
			const setSpy = vi.spyOn(window, "setTimeout");
			const clearSpy = vi.spyOn(window, "clearTimeout");

			for (let i = 0; i < 50; i += 1) {
				vi.advanceTimersByTime(16);
				document.dispatchEvent(new Event("pointermove", { bubbles: true }));
			}

			expect(setSpy).not.toHaveBeenCalled();
			expect(clearSpy).not.toHaveBeenCalled();
		});

		it("still goes idle exactly one idle delay after the last activity", async () => {
			await loadNavBrand();

			vi.advanceTimersByTime(10_000);
			document.dispatchEvent(new Event("pointermove", { bubbles: true }));

			vi.advanceTimersByTime(IDLE_DELAY_MS - 1);
			expect(brandState()).toBe("active");

			vi.advanceTimersByTime(1);
			expect(brandState()).toBe("idle");
		});

		it("wakes on activity and goes idle again one idle delay later", async () => {
			await loadNavBrand();
			vi.advanceTimersByTime(IDLE_DELAY_MS);
			expect(brandState()).toBe("idle");

			document.dispatchEvent(new Event("pointermove", { bubbles: true }));
			expect(brandState()).toBe("active");

			vi.advanceTimersByTime(IDLE_DELAY_MS - 1);
			expect(brandState()).toBe("active");
			vi.advanceTimersByTime(1);
			expect(brandState()).toBe("idle");
		});

		it("stays paused after window blur until the next activity", async () => {
			await loadNavBrand();
			window.dispatchEvent(new Event("blur"));

			vi.advanceTimersByTime(IDLE_DELAY_MS * 2);
			expect(brandState()).toBe("active");

			document.dispatchEvent(new Event("pointermove", { bubbles: true }));
			vi.advanceTimersByTime(IDLE_DELAY_MS);
			expect(brandState()).toBe("idle");
		});
	});

	describe("soft navigation teardown", () => {
		it("leaves no pending timer once astro:before-swap has fired", async () => {
			document.documentElement.setAttribute("data-sidebar-collapsed", "");
			await loadNavBrand();
			expect(vi.getTimerCount()).toBeGreaterThan(0);

			beforeSwap();

			expect(vi.getTimerCount()).toBe(0);
		});

		it("clears an in-flight curiosity pulse from the outgoing page", async () => {
			document.documentElement.setAttribute("data-sidebar-collapsed", "");
			await loadNavBrand();
			vi.advanceTimersByTime(COLLAPSED_NUDGE_INITIAL_DELAY_MS);
			const outgoingTrigger = collapsedTrigger();
			expect(outgoingTrigger.dataset.navbrandCurious).toBe("true");

			beforeSwap();

			expect(outgoingTrigger.dataset.navbrandCurious).toBeUndefined();
		});

		it("does not stack timers or listeners across repeated navigations", async () => {
			await loadNavBrand();
			const timersAfterFirstLoad = vi.getTimerCount();
			const listenersAfterFirstLoad = boundListeners.length;

			for (let i = 0; i < 5; i += 1) softNavigate();

			expect(vi.getTimerCount()).toBe(timersAfterFirstLoad);
			expect(boundListeners.length).toBe(listenersAfterFirstLoad);
		});

		it("drives the incoming page's nodes after the swap", async () => {
			await loadNavBrand();
			softNavigate();

			expect(brandState()).toBe("active");
			vi.advanceTimersByTime(IDLE_DELAY_MS);
			expect(brandState()).toBe("idle");
		});
	});

	describe("curiosity timers", () => {
		beforeEach(() => {
			document.documentElement.setAttribute("data-sidebar-collapsed", "");
		});

		it("does not restart the wait when the brand re-renders", async () => {
			await loadNavBrand();

			vi.advanceTimersByTime(5_000);
			// A re-render that leaves collapse state, viewport and route untouched.
			document.dispatchEvent(new Event("visibilitychange"));
			expect(brandState()).toBe("return");

			vi.advanceTimersByTime(COLLAPSED_NUDGE_INITIAL_DELAY_MS - 5_000 - 1);
			expect(collapsedTrigger().dataset.navbrandCurious).toBeUndefined();
			vi.advanceTimersByTime(1);
			expect(collapsedTrigger().dataset.navbrandCurious).toBe("true");
		});

		it("does not cut a visible pulse short when the brand re-renders", async () => {
			await loadNavBrand();
			vi.advanceTimersByTime(COLLAPSED_NUDGE_INITIAL_DELAY_MS);
			expect(collapsedTrigger().dataset.navbrandCurious).toBe("true");

			document.dispatchEvent(new Event("visibilitychange"));
			expect(collapsedTrigger().dataset.navbrandCurious).toBe("true");

			vi.advanceTimersByTime(COLLAPSED_NUDGE_VISIBLE_DURATION_MS);
			expect(collapsedTrigger().dataset.navbrandCurious).toBeUndefined();
		});

		it("restarts the wait when the sidebar collapse state changes", async () => {
			await loadNavBrand();

			vi.advanceTimersByTime(3_000);
			document.dispatchEvent(new CustomEvent("sidebar:collapse-change", { detail: { collapsed: true } }));

			vi.advanceTimersByTime(COLLAPSED_NUDGE_INITIAL_DELAY_MS - 1);
			expect(collapsedTrigger().dataset.navbrandCurious).toBeUndefined();
			vi.advanceTimersByTime(1);
			expect(collapsedTrigger().dataset.navbrandCurious).toBe("true");
		});

		it("restarts after the tab was hidden", async () => {
			await loadNavBrand();
			const visibility = vi.spyOn(document, "visibilityState", "get");

			vi.advanceTimersByTime(3_000);
			visibility.mockReturnValue("hidden");
			document.dispatchEvent(new Event("visibilitychange"));
			expect(vi.getTimerCount()).toBe(0);

			visibility.mockReturnValue("visible");
			document.dispatchEvent(new Event("visibilitychange"));

			vi.advanceTimersByTime(COLLAPSED_NUDGE_INITIAL_DELAY_MS - 1);
			expect(collapsedTrigger().dataset.navbrandCurious).toBeUndefined();
			vi.advanceTimersByTime(1);
			expect(collapsedTrigger().dataset.navbrandCurious).toBe("true");
		});
	});
});
