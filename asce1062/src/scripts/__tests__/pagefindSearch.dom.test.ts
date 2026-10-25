// @vitest-environment jsdom
/**
 * The Pagefind UI is loaded on demand. A box must be built once even when it
 * is opened twice while the UI is still downloading, a failed download must
 * be retryable, and only the /search box may mirror its query in ?q=.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { PagefindUI, ensurePagefindStyles, loadUi } = vi.hoisted(() => {
	const PagefindUI = vi.fn(function (this: unknown, options: { element: string }) {
		const host = document.querySelector(options.element);
		host?.insertAdjacentHTML("beforeend", `<form class="pagefind-ui__form"><input type="text" /></form>`);
	});
	const ensurePagefindStyles = vi.fn();
	const loadUi = vi.fn(async () => ({ PagefindUI, ensurePagefindStyles }));
	return { PagefindUI, ensurePagefindStyles, loadUi };
});

vi.mock("@/scripts/pagefindUi", () => loadUi());

function box(id: string): HTMLElement {
	const el = document.createElement("div");
	el.id = id;
	el.setAttribute("data-pagefind-ui", "");
	document.body.appendChild(el);
	return el;
}

describe("initPagefindSearch", () => {
	beforeEach(() => {
		vi.resetModules();
		PagefindUI.mockClear();
		ensurePagefindStyles.mockClear();
		window.history.replaceState({}, "", "/");
	});

	afterEach(() => {
		document.body.innerHTML = "";
	});

	it("builds a box once when it is opened again while loading", async () => {
		const { initPagefindSearch } = await import("@/scripts/pagefindSearch");
		const el = box("floating-searchbox");

		const [first, second] = await Promise.all([initPagefindSearch(el), initPagefindSearch(el)]);

		expect(PagefindUI).toHaveBeenCalledTimes(1);
		expect(first).toBe(second);
		expect(first?.id).toBe("floating-searchbox-input");
		expect(ensurePagefindStyles).toHaveBeenCalled();
	});

	it("resolves null when the UI cannot load, and retries on the next call", async () => {
		const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
		vi.doMock("@/scripts/pagefindUi", () => {
			throw new Error("offline");
		});
		const { initPagefindSearch } = await import("@/scripts/pagefindSearch");
		const el = box("floating-searchbox");

		await expect(initPagefindSearch(el)).resolves.toBeNull();
		expect(consoleError).toHaveBeenCalled();

		vi.doMock("@/scripts/pagefindUi", () => loadUi());
		await expect(initPagefindSearch(el)).resolves.toBeInstanceOf(HTMLInputElement);
		expect(PagefindUI).toHaveBeenCalledTimes(1);
		consoleError.mockRestore();
	});

	it("mirrors the query in ?q= only for the /search page box", async () => {
		const { initPagefindSearch } = await import("@/scripts/pagefindSearch");
		window.history.replaceState({}, "", "/search?q=argon");

		const pageInput = await initPagefindSearch(box("page-searchbox"));
		expect(pageInput?.value).toBe("argon");
		pageInput!.value = "astro";
		pageInput!.dispatchEvent(new Event("input"));
		expect(window.location.search).toBe("?q=astro");

		window.history.replaceState({}, "", "/about");
		const floatingInput = await initPagefindSearch(box("floating-searchbox"));
		floatingInput!.value = "argon";
		floatingInput!.dispatchEvent(new Event("input"));
		expect(window.location.pathname + window.location.search).toBe("/about");
	});
});
