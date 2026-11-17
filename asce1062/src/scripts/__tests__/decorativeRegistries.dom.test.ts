// @vitest-environment jsdom
/**
 * Layout.astro imports these registries on demand, after `astro:page-load`
 * has already fired for the page that needs them. Each module therefore has
 * to bind the current page as it evaluates, and stay idempotent when the
 * event fires again.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function dispatch(name: string): void {
	document.dispatchEvent(new Event(name));
}

describe("decorative registries loaded on demand", () => {
	// Each registry module evaluates once per file (the import is cached), so the
	// "on import" test of each pair runs first and the second reuses the instance.
	beforeEach(() => {
		vi.stubGlobal("requestAnimationFrame", () => 1);
		vi.stubGlobal("cancelAnimationFrame", () => {});
		// jsdom has no Web Animations API; teardown only needs an empty list.
		Element.prototype.getAnimations = () => [];
	});

	afterEach(() => {
		dispatch("astro:before-swap");
		vi.unstubAllGlobals();
		Reflect.deleteProperty(Element.prototype, "getAnimations");
		document.body.innerHTML = "";
	});

	it("magicalTextRegistry binds the current page on import and does not double-bind", async () => {
		document.body.innerHTML = "<span id='magic' data-magical-text data-magical-text-colors='#f00,#00f'>hello</span>";
		const el = document.getElementById("magic")!;

		await import("@/scripts/magicalTextRegistry");
		expect(el.classList.contains("magical-text-container")).toBe(true);

		dispatch("astro:page-load");
		expect(el.querySelectorAll(".magical-text-inner")).toHaveLength(1);
		expect(el.querySelector(".magical-text-inner")?.textContent).toBe("hello");

		dispatch("astro:before-swap");
		expect(el.classList.contains("magical-text-container")).toBe(false);
		expect(el.innerHTML).toBe("hello");
	});

	it("magicalTextRegistry binds elements that arrive with a later soft navigation", async () => {
		await import("@/scripts/magicalTextRegistry");

		dispatch("astro:before-swap");
		document.body.innerHTML = "<span id='next' data-magical-text data-magical-text-colors='#f00,#00f'>next</span>";
		dispatch("astro:page-load");

		expect(document.getElementById("next")!.classList.contains("magical-text-container")).toBe(true);
	});

	it("hauntedRegistry binds the current page on import and does not double-bind", async () => {
		document.body.innerHTML = "<sup id='haunt' data-haunted data-haunted-number-of='2'>boo</sup>";
		const el = document.getElementById("haunt")!;

		await import("@/scripts/hauntedRegistry");
		expect(el.querySelectorAll(".haunted-creatures")).toHaveLength(1);

		dispatch("astro:page-load");
		expect(el.querySelectorAll(".haunted-creatures")).toHaveLength(1);
		expect(el.querySelectorAll(".haunted-creature-wrap")).toHaveLength(2);

		dispatch("astro:before-swap");
		expect(el.querySelector(".haunted-creatures")).toBeNull();
	});

	it("hauntedRegistry binds elements that arrive with a later soft navigation", async () => {
		await import("@/scripts/hauntedRegistry");

		dispatch("astro:before-swap");
		document.body.innerHTML = "<span id='next' data-haunted>next</span>";
		dispatch("astro:page-load");

		expect(document.getElementById("next")!.querySelector(".haunted-creatures")).not.toBeNull();
	});
});
