// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function setReducedMotion(reduce: boolean): void {
	vi.stubGlobal(
		"matchMedia",
		vi.fn((query: string) => ({
			matches: reduce && query.includes("reduce"),
			addEventListener() {},
			removeEventListener() {},
		}))
	);
}

describe("backToTop", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.resetModules();
		document.body.innerHTML = `
			<main id="main-content"><p>content</p></main>
			<button id="back-to-top" class="opacity-0 invisible">top</button>`;
		Object.defineProperty(document.documentElement, "scrollTop", { configurable: true, value: 1000 });
		window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
		setReducedMotion(false);
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	const button = () => document.getElementById("back-to-top") as HTMLButtonElement;

	it("does not auto-hide while the button has keyboard focus", async () => {
		const { initBackToTop } = await import("@/scripts/backToTop");
		initBackToTop();
		button().focus();
		button().dispatchEvent(new FocusEvent("focusin", { bubbles: true }));

		vi.advanceTimersByTime(5_000);

		expect(button().classList.contains("invisible")).toBe(false);
	});

	it("moves focus to the main content after scrolling to the top", async () => {
		const { initBackToTop } = await import("@/scripts/backToTop");
		initBackToTop();
		button().click();

		expect(document.activeElement?.id).toBe("main-content");
		expect(window.scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 0, behavior: "smooth" }));
	});

	it("jumps without smooth scrolling under prefers-reduced-motion", async () => {
		setReducedMotion(true);
		const { initBackToTop } = await import("@/scripts/backToTop");
		initBackToTop();
		button().click();

		expect(window.scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 0, behavior: "auto" }));
	});
});

describe("iframeTheme", () => {
	const SRC = "https://widget.example/embed?theme=dark&user=x";

	beforeEach(() => {
		vi.resetModules();
		document.documentElement.setAttribute("data-theme", "dark");
		document.body.innerHTML = `<iframe id="widget" src="${SRC}"></iframe>`;
	});

	const config = {
		id: "widget",
		updateMethod: "src-query" as const,
		queryParam: "theme",
		queryValues: { dark: "dark", light: "light" },
	};

	it("leaves src alone when it already matches, so the iframe does not reload", async () => {
		const iframe = document.getElementById("widget") as HTMLIFrameElement;
		const setter = vi.fn();
		const descriptor = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, "src")!;
		Object.defineProperty(iframe, "src", { configurable: true, get: () => descriptor.get!.call(iframe), set: setter });
		const { initIframeTheme } = await import("@/scripts/iframeTheme");

		initIframeTheme(config);
		document.dispatchEvent(new Event("astro:page-load"));

		expect(setter).not.toHaveBeenCalled();
	});

	it("follows data-theme changes from any source, not only the set-theme event", async () => {
		const { initIframeTheme } = await import("@/scripts/iframeTheme");
		initIframeTheme(config);

		document.documentElement.setAttribute("data-theme", "light");
		await Promise.resolve(); // MutationObserver callbacks run as microtasks

		expect((document.getElementById("widget") as HTMLIFrameElement).src).toContain("theme=light");
	});
});
