// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { WINDOW_KEY_STEP_PX } from "@/scripts/floatingWindowKeys";

vi.mock("@/lib/asciiVisualizer", () => ({
	AsciiVisualizerController: class {
		mount(): void {}
		teardown(): void {}
		connect(): void {}
		setVisible(): void {}
		setPlaying(): void {}
		setFlavor(): void {}
	},
}));

/** The component's real markup, without its frontmatter and loader script. */
const MUSIC_MARKUP = readFileSync("src/components/MusicPlayerModal.astro", "utf8")
	.replace(/^---[\s\S]*?---/, "")
	.replace(/<script>[\s\S]*<\/script>/, "");
const POINTER_ID = 1;
/** jsdom's 1024x768 viewport inset by the 24px window margin. */
const BOX = { x: 24, y: 24, width: 976, height: 720 };

const byId = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const player = () => byId("music-terminal");
const handle = () => byId("music-terminal-drag-handle");
const sizeButton = () => byId("music-collapse-button");

function frame() {
	const { left, top, width, height } = player().style;
	return { x: parseFloat(left), y: parseFloat(top), width: parseFloat(width), height: parseFloat(height) };
}

function pointer(type: string, target: EventTarget, clientX = 0, clientY = 0): void {
	target.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: POINTER_ID, clientX, clientY }));
}

function press(target: EventTarget, key: string, init: KeyboardEventInit = {}): KeyboardEvent {
	const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init });
	target.dispatchEvent(event);
	return event;
}

describe("music player window", () => {
	beforeAll(async () => {
		vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query }));
		vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
		// jsdom has no pointer capture and no media playback.
		const captured = new WeakMap<Element, Set<number>>();
		HTMLElement.prototype.setPointerCapture = function (pointerId: number) {
			captured.set(this, (captured.get(this) ?? new Set()).add(pointerId));
		};
		HTMLElement.prototype.hasPointerCapture = function (pointerId: number) {
			return captured.get(this)?.has(pointerId) ?? false;
		};
		HTMLElement.prototype.releasePointerCapture = function (pointerId: number) {
			captured.get(this)?.delete(pointerId);
		};
		HTMLMediaElement.prototype.pause = () => {};
		HTMLMediaElement.prototype.load = () => {};
		// The player root persists across navigations: it is rendered once.
		document.body.innerHTML = MUSIC_MARKUP;
		await import("@/scripts/musicPlayerModal");
	});

	beforeEach(() => {
		document.dispatchEvent(new Event("music-player:open"));
	});

	afterEach(() => {
		// Closing resets the window to its default size and position.
		byId("music-close-button").click();
	});

	describe("pointer interactions", () => {
		it("drags by the title bar", () => {
			const start = frame();
			pointer("pointerdown", handle(), 300, 40);
			pointer("pointermove", document, 310, 40);
			expect(frame()).toEqual({ ...start, x: start.x + 10 });
		});

		it("keeps the drag when a different pointer lifts", () => {
			pointer("pointerdown", handle(), 300, 40);
			const start = frame();

			document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: POINTER_ID + 1 }));
			pointer("pointermove", document, 310, 40);

			expect(frame()).toEqual({ ...start, x: start.x + 10 });
			pointer("pointerup", document);
		});

		it("ends a drag on pointercancel", () => {
			pointer("pointerdown", handle(), 300, 40);
			pointer("pointermove", document, 310, 40);
			const cancelled = frame();
			expect(player().classList.contains("is-dragging")).toBe(true);

			pointer("pointercancel", document);
			pointer("pointermove", document, 340, 40);

			expect(frame()).toEqual(cancelled);
			expect(player().classList.contains("is-dragging")).toBe(false);
			expect(handle().hasPointerCapture(POINTER_ID)).toBe(false);
		});

		it("ends a drag when the window is minimized", () => {
			const start = frame();
			pointer("pointerdown", handle(), 300, 40);
			byId("music-minimize-button").click();
			expect(player().classList.contains("is-dragging")).toBe(false);
			expect(handle().hasPointerCapture(POINTER_ID)).toBe(false);

			byId("music-dock-chip").click();
			pointer("pointermove", document, 340, 40);
			expect(frame()).toEqual(start);
		});

		it("ends a drag when the window is closed", () => {
			pointer("pointerdown", handle(), 300, 40);
			byId("music-close-button").click();
			expect(player().classList.contains("is-dragging")).toBe(false);
			expect(handle().hasPointerCapture(POINTER_ID)).toBe(false);

			document.dispatchEvent(new Event("music-player:open"));
			const reopened = frame();
			pointer("pointermove", document, 340, 40);
			expect(frame()).toEqual(reopened);
		});
	});

	describe("keyboard move and resize", () => {
		it("makes the title bar a described keyboard stop", () => {
			expect(handle().tabIndex).toBe(0);
			expect(handle().getAttribute("aria-label")).toBeTruthy();
			const description = byId(handle().getAttribute("aria-describedby") ?? "");
			expect(description.textContent).toMatch(/arrow keys/i);
			expect(description.textContent).toMatch(/shift/i);
		});

		it("moves one step per arrow key, inside the pointer's movement box", () => {
			const start = frame();
			expect(press(handle(), "ArrowRight").defaultPrevented).toBe(true);
			expect(frame()).toEqual({ ...start, x: start.x + WINDOW_KEY_STEP_PX });

			for (let i = 0; i < 40; i++) press(handle(), "ArrowLeft");
			expect(frame()).toEqual({ ...start, x: BOX.x });
		});

		it("resizes one step per Shift + arrow key, from the right and bottom edges", () => {
			const start = frame();
			press(handle(), "ArrowRight", { shiftKey: true });
			press(handle(), "ArrowUp", { shiftKey: true });
			expect(frame()).toEqual({
				...start,
				width: start.width + WINDOW_KEY_STEP_PX,
				height: start.height - WINDOW_KEY_STEP_PX,
			});
		});

		it("stops at the minimum size without moving the window", () => {
			const start = frame();
			for (let i = 0; i < 40; i++) press(handle(), "ArrowLeft", { shiftKey: true });
			for (let i = 0; i < 40; i++) press(handle(), "ArrowUp", { shiftKey: true });
			expect(frame()).toEqual({ x: start.x, y: start.y, width: 560, height: 520 });
		});

		it("leaves keys on the window buttons alone", () => {
			const start = frame();
			expect(press(sizeButton(), "ArrowRight").defaultPrevented).toBe(false);
			press(byId("music-progress"), "ArrowRight");
			expect(frame()).toEqual(start);
		});

		it("makes a maximized window an ordinary one when resized, as a pointer resize does", () => {
			sizeButton().click();
			expect(frame()).toEqual(BOX);
			expect(sizeButton().getAttribute("aria-label")).toBe("Collapse music player");

			press(handle(), "ArrowLeft", { shiftKey: true });
			expect(frame()).toEqual({ ...BOX, width: BOX.width - WINDOW_KEY_STEP_PX });
			expect(sizeButton().getAttribute("aria-label")).toBe("Maximize music player");
		});

		// The miniplayer's height limits are measured from layout, which jsdom
		// does not have: the e2e journey covers its height.
		it("moves and resizes the miniplayer", () => {
			sizeButton().click();
			sizeButton().click();
			expect(player().dataset.musicWindowMode).toBe("collapsed");
			const start = frame();

			press(handle(), "ArrowDown");
			expect(frame()).toEqual({ ...start, y: start.y + WINDOW_KEY_STEP_PX });

			press(handle(), "ArrowLeft", { shiftKey: true });
			expect(frame().width).toBe(start.width - WINDOW_KEY_STEP_PX);
		});
	});
});
