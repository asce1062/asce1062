// @vitest-environment jsdom
/**
 * Entry action menus: closing a menu that holds focus must hand focus back to
 * its trigger, and Escape is only theirs while a menu is open.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/scripts/feedbackManager", () => ({
	copyToClipboard: vi.fn(async () => undefined),
	shareOrCopyToClipboard: vi.fn(async () => undefined),
}));

import { initEntryActions } from "@/scripts/guestbookEntryActions";

function press(key: string): void {
	document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
}

describe("guestbook entry action menu focus", () => {
	let trigger: HTMLButtonElement;
	let menu: HTMLElement;

	beforeEach(() => {
		document.body.innerHTML = `
			<div class="entry-actions">
				<button class="entry-actions-trigger" aria-expanded="false" aria-haspopup="true" type="button">menu</button>
				<div class="entry-actions-menu" role="menu" hidden>
					<button class="entry-action" role="menuitem" data-action="copy-message" data-message="hi">Copy</button>
					<button class="entry-action" role="menuitem" data-action="copy-style">Style</button>
				</div>
			</div>
			<button id="elsewhere" type="button">elsewhere</button>`;
		initEntryActions();
		trigger = document.querySelector(".entry-actions-trigger")!;
		menu = document.querySelector(".entry-actions-menu")!;
	});

	it("opens on the first item and returns focus to the trigger on Escape", () => {
		trigger.click();
		expect(menu.hidden).toBe(false);
		expect(document.activeElement?.textContent).toBe("Copy");

		press("Escape");

		expect(menu.hidden).toBe(true);
		expect(trigger.getAttribute("aria-expanded")).toBe("false");
		expect(document.activeElement).toBe(trigger);
	});

	it("returns focus to the trigger after choosing an action", () => {
		trigger.click();
		(document.activeElement as HTMLElement).click();

		expect(menu.hidden).toBe(true);
		expect(document.activeElement).toBe(trigger);
	});

	it("leaves Escape alone when no menu is open", () => {
		const elsewhere = document.getElementById("elsewhere")!;
		elsewhere.focus();

		press("Escape");

		expect(document.activeElement).toBe(elsewhere);
	});

	it("closes without stealing focus when focus moves out of the menu", () => {
		trigger.click();
		const elsewhere = document.getElementById("elsewhere")!;

		elsewhere.focus();

		expect(menu.hidden).toBe(true);
		expect(document.activeElement).toBe(elsewhere);
	});
});
