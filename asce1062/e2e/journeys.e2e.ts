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
});
