// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initAsciiCopy } from "@/scripts/asciiWidgetCopy";

const VARIANT = { text: "hi", font: "Standard", art: "| |\n|_|" };

const status = () => document.getElementById("status-announcer")!;
const button = () => document.querySelector<HTMLButtonElement>(".ascii-widget-copy")!;
const copyIcon = () => document.querySelector<HTMLElement>(".ascii-copy-icon")!;
const checkIcon = () => document.querySelector<HTMLElement>(".ascii-check-icon")!;

function stubClipboard(clipboard: unknown): void {
	Object.defineProperty(navigator, "clipboard", { value: clipboard, configurable: true });
}

/** Click, then let the clipboard promise and the announcement delay settle. */
async function clickAndSettle(): Promise<void> {
	button().click();
	await vi.advanceTimersByTimeAsync(100);
}

describe("ascii widget copy", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		document.body.innerHTML = `
			<div id="egg">
				<button class="ascii-widget-copy" data-widget-id="egg" aria-label="Copy ASCII art as JSON">
					<i class="ascii-copy-icon"></i>
					<i class="ascii-check-icon hidden"></i>
				</button>
			</div>`;
		document.getElementById("egg")!.dataset.asciiCurrent = JSON.stringify(VARIANT);
		initAsciiCopy();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("copies the art with its JSON, shows the check and announces it", async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		stubClipboard({ writeText });

		await clickAndSettle();

		const copied = writeText.mock.calls[0][0] as string;
		expect(copied).toContain("[Standard]");
		expect(copied).toContain(VARIANT.art);
		expect(copied).toContain(JSON.stringify(VARIANT, null, 2));
		expect(checkIcon().classList.contains("hidden")).toBe(false);
		expect(copyIcon().classList.contains("hidden")).toBe(true);
		expect(status().textContent).toBe("ASCII art copied");
	});

	it("shows and announces a failure when the write is rejected, then recovers", async () => {
		stubClipboard({ writeText: vi.fn().mockRejectedValue(new Error("denied")) });

		await clickAndSettle();

		expect(button().classList.contains("text-error")).toBe(true);
		expect(checkIcon().classList.contains("hidden")).toBe(true);
		expect(status().textContent).toBe("Copy failed. Try again.");

		await vi.advanceTimersByTimeAsync(2000);
		expect(button().classList.contains("text-error")).toBe(false);
	});

	it("reports a failure when the Clipboard API is unavailable", async () => {
		stubClipboard(undefined);

		await clickAndSettle();

		expect(button().classList.contains("text-error")).toBe(true);
		expect(status().textContent).toBe("Copy failed. Try again.");
	});

	it("adds no live region on a page without a widget", () => {
		document.body.innerHTML = "<p>no art here</p>";
		initAsciiCopy();

		expect(document.getElementById("status-announcer")).toBeNull();
	});
});
