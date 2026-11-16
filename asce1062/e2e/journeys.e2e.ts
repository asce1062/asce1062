import { PAGES, expect, test } from "./fixtures";

const root = (page: import("@playwright/test").Page) => page.locator("html");

test.describe("navigation", () => {
	test("the sidebar takes a visitor from home to a blog post", async ({ page }) => {
		await page.goto(PAGES.home);
		// The greeting is shared header chrome; the home page names itself in a hidden h1.
		await expect(page.getByRole("heading", { level: 1 })).toHaveText("Alex Mbugua");

		await page.locator("#nav-menu").getByRole("link", { name: "Blog", exact: true }).click();
		await expect(page).toHaveURL(/\/blog\/?$/);

		const post = PAGES.post.replace(/\/$/, "");
		await page.locator(`a[href^="${post}"]`).first().click();
		await expect(page).toHaveURL(new RegExp(`${post}/?$`));
		await expect(page.getByRole("heading", { level: 1 })).toContainText("Argon2id");
	});

	test("an unknown URL shows the 404 page", async ({ page }) => {
		const response = await page.goto("/no-such-page/");
		expect(response?.status()).toBe(404);
		await expect(page.locator("[data-page-404]")).toBeVisible();
	});
});

test.describe("appearance", () => {
	test("the theme toggle switches theme and the choice survives a reload", async ({ page }) => {
		await page.goto(PAGES.home);
		await expect(root(page)).toHaveAttribute("data-theme", "dark");

		await page.locator("#theme-toggle-btn").click();
		await expect(root(page)).toHaveAttribute("data-theme", "light");
		await expect(root(page)).not.toHaveAttribute("data-theme-switching");

		await page.reload();
		await expect(root(page)).toHaveAttribute("data-theme", "light");
	});

	test("a flavor swatch applies the flavor and the choice survives a reload", async ({ page }) => {
		await page.goto(PAGES.home);
		const swatch = page.locator('[data-flavor-btn="crt-green"]');

		await swatch.click();
		await expect(root(page)).toHaveAttribute("data-flavor", "crt-green");
		await expect(swatch).toHaveAttribute("aria-pressed", "true");

		await page.reload();
		await expect(root(page)).toHaveAttribute("data-flavor", "crt-green");
		await expect(page.locator('[data-flavor-btn="crt-green"]')).toHaveAttribute("aria-pressed", "true");
	});
});

test.describe("music player", () => {
	// The playlist API is an SSR route, absent from the static build: this
	// covers the dialog itself, not playback.
	test.beforeEach(async ({ page }) => {
		await page.route("**/api/music/**", (route) => route.fulfill({ status: 503, json: { error: "offline" } }));
	});

	test("opens from the sidebar and closes from its close button", async ({ page }) => {
		await page.goto(PAGES.home);
		const player = page.getByRole("dialog", { name: "Navidrome music player" });
		await expect(player).toBeHidden();

		await page.locator("#nav-menu [data-music-player-trigger]").click();
		await expect(player).toBeVisible();
		await expect(player).toBeFocused();

		await page.getByRole("button", { name: "Close music player" }).click();
		await expect(player).toBeHidden();
	});

	test("is a floating window: Escape minimizes it only from inside", async ({ page }) => {
		await page.goto(PAGES.home);
		const player = page.getByRole("dialog", { name: "Navidrome music player" });
		await page.locator("#nav-menu [data-music-player-trigger]").click();
		await expect(player).toBeFocused();
		await expect(player).not.toHaveAttribute("aria-modal");

		// Focus on the page behind it: Escape is the page's, not the player's.
		await page.locator("#theme-toggle-btn").focus();
		await page.keyboard.press("Escape");
		await expect(player).toBeVisible();

		// From inside, Escape minimizes and focus lands on the tab that restores it.
		await page.getByRole("button", { name: "Minimize music player" }).focus();
		await page.keyboard.press("Escape");
		await expect(player).toBeHidden();
		const restore = page.getByRole("button", { name: "Restore music player" });
		await expect(restore).toBeFocused();

		await page.keyboard.press("Enter");
		await expect(player).toBeVisible();
		await expect(player).toBeFocused();
	});

	test("size button steps windowed, maximized, miniplayer and back", async ({ page }) => {
		await page.goto(PAGES.home);
		const player = page.getByRole("dialog", { name: "Navidrome music player" });
		await page.locator("#nav-menu [data-music-player-trigger]").click();
		await expect(player).toBeVisible();
		const size = page.locator("#music-collapse-button");
		const box = async () => {
			const rect = await player.boundingBox();
			if (!rect) throw new Error("music player has no box");
			return rect;
		};
		const viewport = page.viewportSize();
		if (!viewport) throw new Error("no viewport");

		// Opens windowed, at the narrowest allowed width, so the button offers more room.
		const windowed = await box();
		expect(windowed.width).toBe(560);
		await expect(size).toHaveAccessibleName("Maximize music player");

		// Maximized fills the same movement box as the terminal: 24px from every edge.
		await size.click();
		await expect(size).toHaveAccessibleName("Collapse music player");
		expect(await box()).toEqual({ x: 24, y: 24, width: viewport.width - 48, height: viewport.height - 48 });

		await size.click();
		await expect(size).toHaveAccessibleName("Expand music player");
		await expect(size).toHaveAttribute("aria-expanded", "false");
		expect((await box()).height).toBeLessThan(windowed.height);

		await size.click();
		await expect(size).toHaveAccessibleName("Maximize music player");
		expect(await box()).toEqual(windowed);
	});

	test("names the seek slider and reads its position as times", async ({ page }) => {
		await page.goto(PAGES.home);
		await page.locator("#nav-menu [data-music-player-trigger]").click();

		const seek = page.getByRole("slider", { name: "Seek" });
		await expect(seek).toHaveAttribute("aria-valuetext", "00:00 of 00:00");
	});
});

test.describe("terminal", () => {
	// The nav brand opens the terminal by dispatching this event.
	const openTerminal = (page: import("@playwright/test").Page) =>
		page.evaluate(() =>
			document.dispatchEvent(new CustomEvent("navbrand:open-terminal", { detail: { source: "test" } }))
		);

	test("is a floating window: the page behind it stays usable", async ({ page }) => {
		await page.goto(PAGES.post);
		const terminal = page.getByRole("dialog", { name: "stellar console" });
		await openTerminal(page);
		await expect(terminal).toBeVisible();
		await expect(terminal).not.toHaveAttribute("aria-modal");

		// No scroll lock: the page scrolls with the terminal open.
		await page.mouse.move(8, 8);
		await page.evaluate(() => window.scrollTo(0, 600));
		await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
		await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");

		// No backdrop: a control outside the window still takes clicks.
		await page.evaluate(() => window.scrollTo(0, 0));
		await page.locator("#theme-toggle-btn").click();
		await expect(root(page)).toHaveAttribute("data-theme", "light");
		await expect(terminal).toBeVisible();
	});

	test("Escape minimizes it only from inside", async ({ page }) => {
		await page.goto(PAGES.home);
		const terminal = page.getByRole("dialog", { name: "stellar console" });
		await openTerminal(page);
		await expect(terminal).toBeVisible();

		await page.locator("#theme-toggle-btn").focus();
		await page.keyboard.press("Escape");
		await expect(terminal).toBeVisible();

		await page.locator("#terminal-modal").focus();
		await page.keyboard.press("Escape");
		await expect(terminal).toBeHidden();
		await expect(page.locator("#terminal-dock-chip")).toBeFocused();
	});

	test("stays open across a page navigation", async ({ page }) => {
		await page.goto(PAGES.home);
		const terminal = page.getByRole("dialog", { name: "stellar console" });
		await openTerminal(page);
		await expect(terminal).toBeVisible();

		await page.locator("#nav-menu").getByRole("link", { name: "Blog", exact: true }).click();
		await expect(page).toHaveURL(/\/blog\/?$/);
		await expect(terminal).toBeVisible();
	});
});
