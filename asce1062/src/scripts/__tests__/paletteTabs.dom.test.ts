// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { initPaletteTabs } from "@/scripts/paletteTabs";

const checkedId = () => document.querySelector<HTMLInputElement>("input[name=palette-view]:checked")?.id;
const label = (name: string) => document.getElementById(`${name}-tab-label`)!;
const press = (el: Element, key: string) => el.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));

describe("palette view tabs", () => {
	beforeEach(() => {
		document.body.innerHTML = `
			<input type="radio" name="palette-view" id="swatches-tab" checked />
			<input type="radio" name="palette-view" id="ingredients-tab" />
			<input type="radio" name="palette-view" id="flavors-tab" />
			<div role="tablist" aria-label="Palette views">
				${["swatches", "ingredients", "flavors"]
					.map((n) => `<label id="${n}-tab-label" for="${n}-tab" role="tab" tabindex="-1">${n}</label>`)
					.join("")}
			</div>`;
		initPaletteTabs();
	});

	it("exposes the selected tab and keeps a single Tab stop", () => {
		expect(label("swatches").getAttribute("aria-selected")).toBe("true");
		expect(label("ingredients").getAttribute("aria-selected")).toBe("false");
		expect([...document.querySelectorAll<HTMLElement>("[role=tab]")].map((t) => t.tabIndex)).toEqual([0, -1, -1]);
		for (const radio of document.querySelectorAll<HTMLInputElement>("input[name=palette-view]")) {
			expect(radio.tabIndex).toBe(-1);
			expect(radio.getAttribute("aria-hidden")).toBe("true");
		}
	});

	it("follows a mouse click on a label, which checks the radio after click listeners run", () => {
		label("flavors").click();

		expect(checkedId()).toBe("flavors-tab");
		expect(label("flavors").getAttribute("aria-selected")).toBe("true");
		expect(label("flavors").tabIndex).toBe(0);
		expect(label("swatches").getAttribute("aria-selected")).toBe("false");
	});

	it("hands focus that lands on a hidden radio to its tab", () => {
		document.getElementById("ingredients-tab")!.focus();

		expect(document.activeElement).toBe(label("ingredients"));
	});

	it("moves and selects with arrows (wrapping), Home and End", () => {
		label("swatches").focus();
		press(label("swatches"), "ArrowRight");
		expect(checkedId()).toBe("ingredients-tab");
		expect(document.activeElement).toBe(label("ingredients"));
		expect(label("ingredients").getAttribute("aria-selected")).toBe("true");
		expect(label("ingredients").tabIndex).toBe(0);
		expect(label("swatches").tabIndex).toBe(-1);

		press(label("ingredients"), "End");
		expect(checkedId()).toBe("flavors-tab");
		press(label("flavors"), "ArrowRight");
		expect(checkedId()).toBe("swatches-tab");
		press(label("swatches"), "ArrowLeft");
		expect(checkedId()).toBe("flavors-tab");
		press(label("flavors"), "Home");
		expect(checkedId()).toBe("swatches-tab");
	});
});
