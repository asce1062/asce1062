// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { WINDOW_KEY_STEP_PX } from "@/scripts/floatingWindowKeys";

/** The component's real markup, without its frontmatter and loader script. */
const TERMINAL_MARKUP = readFileSync("src/components/TerminalModal.astro", "utf8")
	.replace(/^---[\s\S]*?---/, "")
	.replace(/<script>[\s\S]*<\/script>/, "");
const OPENER_MARKUP = `<button id="opener" type="button">open</button>`;
const POINTER_ID = 1;

const byId = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const handle = () => byId("terminal-modal-drag-handle");

function frame() {
	const { left, top, width, height } = byId("terminal-modal").style;
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

function openTerminal(): void {
	document.dispatchEvent(new CustomEvent("navbrand:open-terminal", { detail: { source: "test" } }));
}

/** Mirrors an Astro soft navigation: the terminal's markup is replaced, its state lives in the module. */
function softNavigate(markup = TERMINAL_MARKUP): void {
	document.dispatchEvent(new Event("astro:before-swap"));
	document.body.innerHTML = markup;
	document.dispatchEvent(new Event("astro:after-swap"));
	document.dispatchEvent(new Event("astro:page-load"));
}

describe("terminal window", () => {
	beforeAll(async () => {
		vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query }));
		// jsdom has no pointer capture.
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
		Element.prototype.scrollIntoView = () => {};
		await import("@/scripts/terminalModal");
	});

	beforeEach(() => {
		vi.useFakeTimers();
		document.body.innerHTML = OPENER_MARKUP + TERMINAL_MARKUP;
		document.dispatchEvent(new Event("astro:page-load"));
		byId("opener").focus();
		openTerminal();
	});

	afterEach(() => {
		// Closing resets the module's session state for the next test.
		byId("terminal-close").click();
		vi.clearAllTimers();
		vi.useRealTimers();
	});

	describe("pointer interactions", () => {
		it("drags by the title bar", () => {
			const start = frame();
			pointer("pointerdown", handle(), 200, 200);
			pointer("pointermove", document, 210, 205);
			expect(frame()).toEqual({ ...start, x: start.x + 10, y: start.y + 5 });
		});

		it("ends a drag on pointercancel", () => {
			pointer("pointerdown", handle(), 200, 200);
			pointer("pointermove", document, 210, 205);
			const cancelled = frame();

			pointer("pointercancel", document);
			pointer("pointermove", document, 230, 230);

			expect(frame()).toEqual(cancelled);
			expect(handle().hasPointerCapture(POINTER_ID)).toBe(false);
		});

		it("keeps the drag when a different pointer lifts", () => {
			pointer("pointerdown", handle(), 200, 200);
			const start = frame();

			document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: POINTER_ID + 1 }));
			pointer("pointermove", document, 210, 205);

			expect(frame()).toEqual({ ...start, x: start.x + 10, y: start.y + 5 });
			pointer("pointerup", document);
		});

		it("ends a resize on pointercancel", () => {
			const start = frame();
			const edge = document.querySelector<HTMLElement>('[data-terminal-resize="e"]')!;
			pointer("pointerdown", edge, 500, 300);
			pointer("pointercancel", document);
			pointer("pointermove", document, 520, 300);

			expect(frame()).toEqual(start);
			expect(edge.hasPointerCapture(POINTER_ID)).toBe(false);
		});

		it("ends a drag when the window is minimized", () => {
			const start = frame();
			pointer("pointerdown", handle(), 200, 200);
			byId("terminal-minimize").click();
			byId("terminal-dock-chip").click();
			pointer("pointermove", document, 230, 230);

			expect(frame()).toEqual(start);
			expect(handle().hasPointerCapture(POINTER_ID)).toBe(false);
		});

		it("ends a drag when the window is closed", () => {
			pointer("pointerdown", handle(), 200, 200);
			byId("terminal-close").click();
			expect(handle().hasPointerCapture(POINTER_ID)).toBe(false);

			openTerminal();
			const reopened = frame();
			pointer("pointermove", document, 230, 230);
			expect(frame()).toEqual(reopened);
		});
	});

	describe("page swaps", () => {
		it("ends an in-flight drag", () => {
			const start = frame();
			pointer("pointerdown", handle(), 200, 200);
			softNavigate();
			pointer("pointermove", document, 230, 230);
			expect(frame()).toEqual(start);
		});

		it("returns focus to the opener's counterpart on the new page", () => {
			softNavigate(OPENER_MARKUP + TERMINAL_MARKUP);
			byId("terminal-modal-input").focus();
			byId("terminal-close").click();
			expect(document.activeElement).toBe(byId("opener"));
		});

		it("drops an opener the new page does not have", () => {
			const staleFocus = vi.spyOn(byId("opener"), "focus");
			softNavigate();
			byId("terminal-modal-input").focus();
			byId("terminal-close").click();
			expect(staleFocus).not.toHaveBeenCalled();
		});

		it("does not carry an open completion menu over", () => {
			const input = byId<HTMLInputElement>("terminal-modal-input");
			input.value = "h";
			press(input, "Tab");
			expect(document.querySelectorAll(".terminal-window__completion").length).toBeGreaterThan(0);

			softNavigate();
			// With a menu open, Enter accepts a completion instead of submitting.
			expect(press(byId("terminal-modal-input"), "Enter").defaultPrevented).toBe(false);
		});

		it("binds its listeners once, however many pages were visited", () => {
			softNavigate();
			softNavigate();
			softNavigate();
			const start = frame();
			press(handle(), "ArrowRight");
			expect(frame().x).toBe(start.x + WINDOW_KEY_STEP_PX);
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

		it("moves one step per arrow key", () => {
			const start = frame();
			expect(press(handle(), "ArrowRight").defaultPrevented).toBe(true);
			press(handle(), "ArrowDown");
			expect(frame()).toEqual({ ...start, x: start.x + WINDOW_KEY_STEP_PX, y: start.y + WINDOW_KEY_STEP_PX });

			press(handle(), "ArrowLeft");
			press(handle(), "ArrowUp");
			expect(frame()).toEqual(start);
		});

		it("resizes one step per Shift + arrow key, from the right and bottom edges", () => {
			const start = frame();
			press(handle(), "ArrowRight", { shiftKey: true });
			press(handle(), "ArrowDown", { shiftKey: true });
			expect(frame()).toEqual({
				...start,
				width: start.width + WINDOW_KEY_STEP_PX,
				height: start.height + WINDOW_KEY_STEP_PX,
			});
			expect(byId("terminal-modal-geometry").textContent).toBe(
				`${start.width + WINDOW_KEY_STEP_PX}×${start.height + WINDOW_KEY_STEP_PX}`
			);
		});

		it("stays inside the pointer's movement box", () => {
			for (let i = 0; i < 20; i++) press(handle(), "ArrowLeft");
			for (let i = 0; i < 20; i++) press(handle(), "ArrowUp");
			expect(frame()).toMatchObject({ x: 24, y: 24 });
		});

		it("stops at the minimum size without moving the window", () => {
			const start = frame();
			for (let i = 0; i < 40; i++) press(handle(), "ArrowLeft", { shiftKey: true });
			for (let i = 0; i < 40; i++) press(handle(), "ArrowUp", { shiftKey: true });
			expect(frame()).toEqual({ x: start.x, y: start.y, width: 420, height: 320 });
		});

		it("lets Shift+Tab leave the input for the controls and the title bar", () => {
			const input = byId<HTMLInputElement>("terminal-modal-input");
			input.value = "h";
			expect(press(input, "Tab").defaultPrevented).toBe(true);
			expect(press(input, "Tab", { shiftKey: true }).defaultPrevented).toBe(false);
			expect(document.querySelectorAll(".terminal-window__completion")).toHaveLength(0);
		});

		it("leaves keys on the window buttons and the input alone", () => {
			const start = frame();
			expect(press(byId("terminal-maximize"), "ArrowRight").defaultPrevented).toBe(false);
			press(byId("terminal-modal-input"), "ArrowLeft");
			press(byId("terminal-modal-input"), "ArrowLeft", { shiftKey: true });
			expect(frame()).toEqual(start);
		});

		it("keeps an expanded window expanded, as a pointer resize does", () => {
			byId("terminal-maximize").click();
			const start = frame();
			press(handle(), "ArrowLeft", { shiftKey: true });
			expect(frame().width).toBe(start.width - WINDOW_KEY_STEP_PX);
			expect(byId("terminal-modal").dataset.terminalMode).toBe("expanded");
		});

		it("does nothing in fullscreen, where the pointer cannot move or resize either", () => {
			byId("terminal-maximize").click();
			byId("terminal-maximize").click();
			expect(byId("terminal-modal").dataset.terminalMode).toBe("fullscreen");
			const start = frame();
			press(handle(), "ArrowRight");
			press(handle(), "ArrowLeft", { shiftKey: true });
			expect(frame()).toEqual(start);
		});
	});
});
