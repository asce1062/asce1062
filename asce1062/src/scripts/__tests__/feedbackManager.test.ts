import { afterEach, describe, expect, it, vi } from "vitest";
import { shareOrCopyToClipboard } from "@/scripts/feedbackManager";

function stubNotificationDom(): void {
	const classList = {
		add: vi.fn(),
		remove: vi.fn(),
	};

	vi.stubGlobal("document", {
		getElementById: vi.fn(() => ({
			classList,
			isConnected: true,
		})),
	});

	vi.stubGlobal("window", {
		setTimeout: vi.fn(() => 1),
		clearTimeout: vi.fn(),
	});
}

describe("shareOrCopyToClipboard", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("uses native share when available", async () => {
		const share = vi.fn().mockResolvedValue(undefined);
		const writeText = vi.fn().mockResolvedValue(undefined);
		vi.stubGlobal("navigator", {
			share,
			clipboard: { writeText },
		});

		await expect(
			shareOrCopyToClipboard({
				shareData: { title: "Post", text: "Post", url: "https://example.com/post" },
				clipboardText: "Post\nhttps://example.com/post",
				notificationId: "share-notification",
			})
		).resolves.toBe("shared");

		expect(share).toHaveBeenCalledWith({ title: "Post", text: "Post", url: "https://example.com/post" });
		expect(writeText).not.toHaveBeenCalled();
	});

	it("does not copy when native share is cancelled", async () => {
		const share = vi.fn().mockRejectedValue(Object.assign(new Error("cancelled"), { name: "AbortError" }));
		const writeText = vi.fn().mockResolvedValue(undefined);
		vi.stubGlobal("navigator", {
			share,
			clipboard: { writeText },
		});

		await expect(
			shareOrCopyToClipboard({
				shareData: { title: "Post", url: "https://example.com/post" },
				clipboardText: "https://example.com/post",
				notificationId: "share-notification",
			})
		).resolves.toBe("cancelled");

		expect(writeText).not.toHaveBeenCalled();
	});

	it("copies to clipboard when native share is unavailable", async () => {
		stubNotificationDom();
		const writeText = vi.fn().mockResolvedValue(undefined);
		vi.stubGlobal("navigator", {
			clipboard: { writeText },
		});

		await expect(
			shareOrCopyToClipboard({
				shareData: { title: "Post", url: "https://example.com/post" },
				clipboardText: "https://example.com/post",
				notificationId: "share-notification",
			})
		).resolves.toBe("copied");

		expect(writeText).toHaveBeenCalledWith("https://example.com/post");
	});

	it("copies to clipboard when native share fails", async () => {
		stubNotificationDom();
		const share = vi.fn().mockRejectedValue(new Error("share failed"));
		const writeText = vi.fn().mockResolvedValue(undefined);
		vi.stubGlobal("navigator", {
			share,
			clipboard: { writeText },
		});

		await expect(
			shareOrCopyToClipboard({
				shareData: { title: "Post", url: "https://example.com/post" },
				clipboardText: "https://example.com/post",
				notificationId: "share-notification",
			})
		).resolves.toBe("copied");

		expect(writeText).toHaveBeenCalledWith("https://example.com/post");
	});
});
