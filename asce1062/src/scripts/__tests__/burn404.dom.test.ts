// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { containsFlammableAnchor, resolveFlammableAnchor } from "@/scripts/burn404flammable";

const PIXEL_SIZE = 4;
const FIRE_HEIGHT_RATIO = 0.45;

const NOT_FOUND_BODY = `
	<article data-page-404>
		<h2><i class="icon"></i><span>Looks like you're lost.</span></h2>
		<p>Nothing to debug here, <a href="/">go home</a>.</p>
		<div class="widget"><span>loose text</span></div>
	</article>`;

/** jsdom has no canvas backend: return just enough 2D context for the fire scripts. */
function stubCanvasContext(): void {
	const fakeContext = {
		createLinearGradient: () => ({ addColorStop: () => {} }),
		fillRect: () => {},
		fillText: () => {},
		createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
		getImageData: (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
		putImageData: () => {},
	};
	vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
		fakeContext as unknown as CanvasRenderingContext2D
	);
}

// jsdom has no layout engine and omits Range#getClientRects. The torch's
// debounced flammable detection can still fire after a test ends, so this
// stays installed for the whole file rather than per test. An empty rect list
// is what a real browser returns for unrendered text.
if (!("getClientRects" in Range.prototype)) {
	Object.defineProperty(Range.prototype, "getClientRects", {
		configurable: true,
		value: () => Object.assign([], { item: () => null }) as unknown as DOMRectList,
	});
}

function stubBrowserApis(): void {
	stubCanvasContext();
	vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query }));
	// Keep the RAF loop from running: these tests cover canvas lifecycle, not frames.
	vi.stubGlobal(
		"requestAnimationFrame",
		vi.fn(() => 1)
	);
	vi.stubGlobal("cancelAnimationFrame", vi.fn());
	Object.defineProperty(document, "fonts", { configurable: true, value: { ready: Promise.resolve() } });
}

/** Mimic an Astro soft navigation: swap <body>, then fire the lifecycle events. */
function softNavigate(bodyHtml: string): void {
	document.body = document.createElement("body");
	document.body.innerHTML = bodyHtml;
	document.dispatchEvent(new Event("astro:after-swap"));
	document.dispatchEvent(new Event("astro:page-load"));
}

function expectSizedCanvas(id: string, heightRatio: number): void {
	const canvas = document.getElementById(id) as HTMLCanvasElement | null;
	expect(canvas).not.toBeNull();
	expect(canvas!.isConnected).toBe(true);
	expect(canvas!.width).toBe(Math.ceil(window.innerWidth / PIXEL_SIZE));
	expect(canvas!.height).toBe(Math.ceil(Math.floor(window.innerHeight * heightRatio) / PIXEL_SIZE));
	expect(canvas!.style.width).toBe(`${window.innerWidth}px`);
}

describe("burn404 soft-navigation lifecycle", () => {
	beforeEach(async () => {
		vi.resetModules();
		localStorage.clear();
		document.body.innerHTML = NOT_FOUND_BODY;
		stubBrowserApis();
		// Both scripts initialise on import, like the 404 page's client <script>.
		await import("@/scripts/burn404");
		await import("@/scripts/burn404torch");
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it("sizes both fire canvases on first load", () => {
		expectSizedCanvas("burn404-canvas", FIRE_HEIGHT_RATIO);
		expectSizedCanvas("burn404-torch", 1);
	});

	it("re-sizes both canvases after navigating away and back", () => {
		softNavigate("<main>blog</main>");
		expect(document.getElementById("burn404-torch")).toBeNull();

		softNavigate(NOT_FOUND_BODY);

		// Regression: stale _fireW left the new canvases at the 300x150 default.
		expectSizedCanvas("burn404-canvas", FIRE_HEIGHT_RATIO);
		expectSizedCanvas("burn404-torch", 1);
	});

	it("rebinds the torch mutation observer to the new 404 article", () => {
		const observe = vi.spyOn(MutationObserver.prototype, "observe");
		softNavigate("<main>blog</main>");
		softNavigate(NOT_FOUND_BODY);

		const sentinel = document.querySelector("[data-page-404]");
		const observedTargets = observe.mock.calls.map(([target]) => target);
		expect(observedTargets).toContain(sentinel);
	});
});

describe("flammable anchors", () => {
	beforeEach(() => {
		document.body.innerHTML = NOT_FOUND_BODY;
	});

	it("resolves text to its nearest text block", () => {
		const root = document.querySelector("[data-page-404]")!;
		const span = root.querySelector("h2 span")!;
		const link = root.querySelector("a")!;
		expect(resolveFlammableAnchor(span, root)).toBe(root.querySelector("h2"));
		// Nested anchors own their own ink: a link inside a paragraph is its own block.
		expect(resolveFlammableAnchor(link, root)).toBe(link);
	});

	it("falls back to the root for content outside any text block", () => {
		const root = document.querySelector("[data-page-404]")!;
		expect(resolveFlammableAnchor(root.querySelector(".widget span")!, root)).toBe(root);
	});

	it("never resolves to an anchor outside the root", () => {
		document.body.innerHTML = `<p id="outer"><span data-root><em>x</em></span></p>`;
		const root = document.querySelector("[data-root]")!;
		expect(resolveFlammableAnchor(root.querySelector("em")!, root)).toBe(root);
	});

	it("detects inserted nodes that are or contain anchors", () => {
		const wrapper = document.createElement("div");
		wrapper.innerHTML = "<p>new</p>";
		expect(containsFlammableAnchor(wrapper)).toBe(true);
		expect(containsFlammableAnchor(wrapper.firstElementChild!)).toBe(true);
		expect(containsFlammableAnchor(document.createElement("span"))).toBe(false);
		expect(containsFlammableAnchor(document.createTextNode("text"))).toBe(false);
	});
});
