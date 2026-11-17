// @vitest-environment jsdom
/**
 * A clipboard failure must be reported through the same toast (and live
 * region) as a success, and must not leave the failure text behind.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { copyToClipboard } from "@/scripts/feedbackManager";

const ID = "entry-action-notification";

function toast(): HTMLElement {
	return document.getElementById(ID)!;
}

function messageText(): string {
	return toast().querySelector("[data-share-notification-message]")!.textContent!.trim();
}

function titleText(): string {
	return toast().querySelector("[data-share-notification-title]")!.textContent!.trim();
}

describe("copyToClipboard feedback", () => {
	beforeEach(() => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		document.body.innerHTML = `
			<div id="${ID}" class="share-notification hidden" role="status" aria-live="polite" aria-atomic="true"
				data-title-options='["Orbit achieved"]' data-rare-title-options="[]">
				<strong data-share-notification-title>Orbit achieved</strong>
				<small data-share-notification-message>Copied!</small>
			</div>`;
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("shows the toast with a failure message when the clipboard write rejects", async () => {
		vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } });

		await expect(copyToClipboard("text", ID)).resolves.toBe(false);

		expect(toast().classList.contains("hidden")).toBe(false);
		expect(messageText()).toBe("Copy failed. Try again.");
		expect(titleText()).toBe("Signal lost");
	});

	it("shows the failure toast when the Clipboard API is unavailable", async () => {
		vi.stubGlobal("navigator", {});

		await expect(copyToClipboard("text", ID)).resolves.toBe(false);

		expect(toast().classList.contains("hidden")).toBe(false);
		expect(messageText()).toBe("Copy failed. Try again.");
	});

	it("restores the success message on the next successful copy", async () => {
		vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } });
		await copyToClipboard("text", ID);

		vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
		await expect(copyToClipboard("text", ID)).resolves.toBe(true);

		expect(toast().classList.contains("hidden")).toBe(false);
		expect(messageText()).toBe("Copied!");
		expect(titleText()).toBe("Orbit achieved");
	});
});
