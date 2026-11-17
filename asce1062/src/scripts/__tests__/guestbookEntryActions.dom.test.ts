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

import { ENTRY_STYLE_DEFAULTS, parseEntryStyle } from "@/lib/api/guestbook-input";
import { copyToClipboard } from "@/scripts/feedbackManager";
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

describe("guestbook entry Copy Style", () => {
	const copy = vi.mocked(copyToClipboard);

	/** Render one Copy Style item, click it, and return the JSON it copied. */
	async function copiedStyle(dataStyle: string): Promise<unknown> {
		copy.mockClear();
		document.body.innerHTML = `<button class="entry-action" role="menuitem" data-action="copy-style"></button>`;
		const button = document.querySelector<HTMLButtonElement>(".entry-action")!;
		button.dataset.style = dataStyle;
		initEntryActions();
		button.click();
		await vi.waitFor(() => expect(copy).toHaveBeenCalledTimes(1));
		return JSON.parse(copy.mock.calls[0]![0]);
	}

	it("copies the renderer's defaults for an entry with no stored style", async () => {
		expect(await copiedStyle("")).toEqual(ENTRY_STYLE_DEFAULTS);
	});

	it("fills a partial style the same way the renderer does", async () => {
		const partial = JSON.stringify({ bg: "none", borderWidth: "2px" });
		expect(await copiedStyle(partial)).toEqual(parseEntryStyle(partial));
	});

	it("falls back to the renderer's defaults for malformed style JSON", async () => {
		expect(await copiedStyle("{not json")).toEqual(ENTRY_STYLE_DEFAULTS);
	});
});
