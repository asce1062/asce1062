import { expect, test } from "@playwright/test";
import { builtPages } from "./pages";

// Not site pages: a search-console verification stub and a vendored font demo.
const NOT_PAGES = [/^\/google[0-9a-f]+\.html$/, /^\/fonts\//];
const CHUNK_SIZE = 12;

const pages = builtPages().filter((path) => !NOT_PAGES.some((pattern) => pattern.test(path)));

for (let start = 0; start < pages.length; start += CHUNK_SIZE) {
	const chunk = pages.slice(start, start + CHUNK_SIZE);
	test(`one h1, smaller than the greeting: ${chunk[0]} .. ${chunk.at(-1)}`, async ({ page }) => {
		for (const path of chunk) {
			await page.goto(path, { waitUntil: "load" });
			const { h1s, greeting, largestVisibleH1 } = await page.evaluate(() => {
				const size = (el: Element) => parseFloat(getComputedStyle(el).fontSize);
				const headings = [...document.querySelectorAll("h1")];
				const visible = headings.filter((h) => h.getBoundingClientRect().width > 1);
				const greetingEl = document.querySelector(".site-greeting");
				return {
					h1s: headings.length,
					greeting: greetingEl ? size(greetingEl) : null,
					largestVisibleH1: Math.max(0, ...visible.map(size)),
				};
			});
			// Every page names its own topic; the header greeting is site chrome, not a heading.
			expect.soft(h1s, `${path}: exactly one h1`).toBe(1);
			if (greeting !== null) {
				expect.soft(largestVisibleH1, `${path}: the greeting stays larger than the h1`).toBeLessThan(greeting);
			}
		}
	});
}
