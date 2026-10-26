import { expect, test } from "@playwright/test";
import { findGluedWords } from "../../scripts/lib/glued-words.mjs";
import { builtPages } from "./pages";

// Layout only needs HTML and CSS; skip the heavy downloads.
const SKIPPED_RESOURCES = new Set(["image", "media", "font", "script"]);
// Pages per test: a fresh browser context per page costs more than the check.
const CHUNK_SIZE = 12;

const pages = builtPages();

for (let start = 0; start < pages.length; start += CHUNK_SIZE) {
	const chunk = pages.slice(start, start + CHUNK_SIZE);
	test(`no glued words: ${chunk[0]} .. ${chunk.at(-1)}`, async ({ page }) => {
		await page.route("**/*", (route) =>
			SKIPPED_RESOURCES.has(route.request().resourceType()) ? route.abort() : route.continue()
		);
		for (const path of chunk) {
			await page.goto(path, { waitUntil: "load" });
			const found = await page.evaluate(findGluedWords);
			expect
				.soft(
					found.map((f) => f.snippet),
					`${path}: add the missing space in the source`
				)
				.toEqual([]);
		}
	});
}
