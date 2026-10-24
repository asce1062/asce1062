// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { init } from "@/scripts/tableOfContents";

const HIDDEN = "translateY(-100%)";

/** jsdom has no layout: pin the TOC's viewport top so it reads as stuck (top-1). */
function stickTocAt(top: number): HTMLElement {
	const toc = document.getElementById("toc-container")!;
	toc.getBoundingClientRect = () => ({ top, height: 89 }) as DOMRect;
	return toc;
}

function scrollTo(y: number): void {
	Object.defineProperty(window, "scrollY", { configurable: true, value: y });
	window.dispatchEvent(new Event("scroll"));
}

describe("table of contents scroll hide/show", () => {
	let frames: FrameRequestCallback[];
	const flushFrames = () => frames.splice(0).forEach((cb) => cb(performance.now()));

	beforeEach(() => {
		frames = [];
		vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => frames.push(cb));
		document.body.innerHTML = `
			<nav id="toc-container">
				<details id="toc-details"><summary>Open</summary><ul><li><a href="#a">A</a></li></ul></details>
			</nav>`;
		scrollTo(1920);
		init();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("hides the floating TOC when scrolling down", () => {
		const toc = stickTocAt(4);
		scrollTo(2400);
		flushFrames();
		expect(toc.style.transform).toBe(HIDDEN);
	});

	// Opening the floating TOC grows it, and Chrome's scroll anchoring scrolls the
	// page down to keep the reading position. That scroll lands before the
	// asynchronous toggle event, so the TOC must read details.open directly or it
	// treats the jump as a downward scroll and hides itself, then reappears.
	it("stays visible when opening it triggers a scroll-anchoring jump", () => {
		const toc = stickTocAt(4);
		const details = document.getElementById("toc-details") as HTMLDetailsElement;

		details.open = true; // the toggle event is still queued
		scrollTo(2370);
		flushFrames();

		expect(toc.style.transform).toBe("");
	});

	it("does not count the anchoring jump once the TOC is closed again", () => {
		const toc = stickTocAt(4);
		const details = document.getElementById("toc-details") as HTMLDetailsElement;

		details.open = true;
		scrollTo(2370);
		flushFrames();
		details.open = false;
		scrollTo(2380); // a small nudge after closing is not a deliberate scroll down
		flushFrames();

		expect(toc.style.transform).toBe("");
	});
});
