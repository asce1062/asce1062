// @vitest-environment jsdom
/**
 * The guestbook avatar widget is re-initialised on every astro:page-load.
 * Its window and form listeners must not pile up across visits, and leaving
 * the page must release them.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/scripts/avatarRenderCore", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/scripts/avatarRenderCore")>()),
	renderToCanvas: vi.fn(async () => undefined),
}));

import { getDefaultState } from "@/data/avatarConfig";
import { renderToCanvas } from "@/scripts/avatarRenderCore";
import { avatarStore } from "@/scripts/avatarStore";
import { initGuestbookAvatarWidget } from "@/scripts/guestbookAvatarWidget";

const renderSpy = vi.mocked(renderToCanvas);

/** Let the widget's async render chain settle. */
async function flush(): Promise<void> {
	await new Promise((resolve) => setTimeout(resolve, 0));
}

function mountGuestbookForm(): void {
	document.body.innerHTML = `
		<form id="form">
			<input type="hidden" id="avatar-state-input" name="avatarState" />
			<input type="checkbox" id="avatar-opt-in" name="avatarOptIn" />
			<p id="avatar-random-notice" style="display:none"></p>
			<div data-widget-id="guestbook">
				<button type="button" class="avatar-mini-randomize"></button>
				<canvas></canvas>
			</div>
		</form>`;
}

/** One soft-navigation visit: Astro swaps the DOM in, then fires astro:page-load. */
function visitGuestbook(): void {
	mountGuestbookForm();
	initGuestbookAvatarWidget();
}

describe("guestbook avatar widget listener lifecycle", () => {
	beforeEach(async () => {
		localStorage.clear();
		document.dispatchEvent(new Event("astro:before-swap"));
		await flush();
		renderSpy.mockClear();
	});

	it("renders once per avatar change no matter how many times the page was visited", async () => {
		visitGuestbook();
		visitGuestbook();
		visitGuestbook();
		await flush();
		renderSpy.mockClear();

		avatarStore.set("female", getDefaultState("female"));
		await flush();

		expect(renderSpy).toHaveBeenCalledTimes(1);
		expect(renderSpy.mock.calls[0]?.[0]).toBe(document.querySelector("canvas"));
		expect((document.getElementById("avatar-state-input") as HTMLInputElement).value).toBe(avatarStore.serialize());
	});

	it("does not stack listeners when page-load fires again on the same DOM", async () => {
		mountGuestbookForm();
		initGuestbookAvatarWidget();
		initGuestbookAvatarWidget();
		await flush();
		renderSpy.mockClear();

		document.querySelector<HTMLButtonElement>(".avatar-mini-randomize")!.click();
		await flush();

		expect(renderSpy).toHaveBeenCalledTimes(1);
	});

	it("stops reacting to avatar changes once the page is swapped out", async () => {
		visitGuestbook();
		await flush();
		renderSpy.mockClear();

		document.dispatchEvent(new Event("astro:before-swap"));
		avatarStore.set("male", getDefaultState("male"));
		await flush();

		expect(renderSpy).not.toHaveBeenCalled();
	});
});
