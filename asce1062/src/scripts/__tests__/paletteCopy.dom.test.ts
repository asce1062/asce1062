// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initPaletteCopy } from "@/scripts/paletteCopy";

const VALUE = "oklch(80% 0.13 80)";

const status = () => document.getElementById("status-announcer")!;
const swatchButton = () => document.querySelector<HTMLButtonElement>(".copy-btn")!;
const oklchButton = () => document.querySelector<HTMLButtonElement>(".oklch-copy")!;

function stubClipboard(writeText: (text: string) => Promise<void>): void {
	Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
}

/** Click, then let the clipboard promise and the announcement delay settle. */
async function clickAndSettle(el: HTMLElement): Promise<void> {
	el.click();
	await vi.advanceTimersByTimeAsync(100);
}

describe("palette copy", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		document.documentElement.style.setProperty("--color-primary", VALUE);
		document.body.innerHTML = `
			<button type="button" class="copy-btn" data-css-var="--color-primary" aria-label="Copy primary color">
				<i class="copy-icon"></i>
				<i class="check-icon hidden"></i>
			</button>
			<button type="button" class="oklch-copy" data-oklch="${VALUE}" aria-label="Copy dark primary color">
				<code>${VALUE}</code>
			</button>`;
		initPaletteCopy();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("adds one polite, visually hidden live region", () => {
		initPaletteCopy();

		expect(document.querySelectorAll("#status-announcer")).toHaveLength(1);
		expect(status().getAttribute("role")).toBe("status");
		expect(status().getAttribute("aria-live")).toBe("polite");
		expect(status().classList.contains("sr-only")).toBe(true);
		expect(status().textContent).toBe("");
	});

	it("adds no live region on a page without copy buttons", () => {
		document.body.innerHTML = "<p>nothing to copy</p>";
		initPaletteCopy();

		expect(document.getElementById("status-announcer")).toBeNull();
	});

	it("copies a swatch, swaps the icon and announces the value", async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		stubClipboard(writeText);

		await clickAndSettle(swatchButton());

		expect(writeText).toHaveBeenCalledWith(VALUE);
		expect(swatchButton().querySelector(".copy-icon")!.classList.contains("hidden")).toBe(true);
		expect(swatchButton().querySelector(".check-icon")!.classList.contains("hidden")).toBe(false);
		expect(swatchButton().classList.contains("text-error")).toBe(false);
		expect(status().textContent).toBe(`Copied ${VALUE}`);
	});

	it("marks a failed swatch copy, announces it, then restores the button", async () => {
		stubClipboard(() => Promise.reject(new Error("denied")));

		await clickAndSettle(swatchButton());

		expect(swatchButton().classList.contains("text-error")).toBe(true);
		expect(swatchButton().querySelector(".check-icon")!.classList.contains("hidden")).toBe(true);
		expect(status().textContent).toBe("Copy failed. Try again.");

		await vi.advanceTimersByTimeAsync(2000);
		expect(swatchButton().classList.contains("text-error")).toBe(false);
	});

	it("shows and announces a copied OKLCH value, then restores it", async () => {
		stubClipboard(vi.fn().mockResolvedValue(undefined));
		const code = oklchButton().querySelector("code")!;

		await clickAndSettle(oklchButton());

		expect(code.textContent).toBe("Copied!");
		expect(code.classList.contains("text-success")).toBe(true);
		expect(status().textContent).toBe(`Copied ${VALUE}`);

		await vi.advanceTimersByTimeAsync(2000);
		expect(code.textContent).toBe(VALUE);
		expect(code.classList.contains("text-success")).toBe(false);
	});

	it("shows and announces a failed OKLCH copy, then restores the value", async () => {
		stubClipboard(() => Promise.reject(new Error("denied")));
		const code = oklchButton().querySelector("code")!;

		await clickAndSettle(oklchButton());

		expect(code.textContent).toBe("Copy failed");
		expect(code.classList.contains("text-error")).toBe(true);
		expect(code.classList.contains("text-success")).toBe(false);
		expect(status().textContent).toBe("Copy failed. Try again.");

		await vi.advanceTimersByTimeAsync(2000);
		expect(code.textContent).toBe(VALUE);
		expect(code.classList.contains("text-error")).toBe(false);
	});

	it("treats a missing clipboard API as a failure", async () => {
		Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });

		await clickAndSettle(oklchButton());

		expect(oklchButton().querySelector("code")!.textContent).toBe("Copy failed");
		expect(status().textContent).toBe("Copy failed. Try again.");
	});

	it("announces the same value again on a repeat copy", async () => {
		stubClipboard(vi.fn().mockResolvedValue(undefined));

		await clickAndSettle(oklchButton());
		oklchButton().click();
		await vi.advanceTimersByTimeAsync(0);
		expect(status().textContent).toBe("");

		await vi.advanceTimersByTimeAsync(100);
		expect(status().textContent).toBe(`Copied ${VALUE}`);
	});
});
