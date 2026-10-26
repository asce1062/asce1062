import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { PAGES, expect, test } from "./fixtures";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const FLAVORS = ["observatory", "crt-green", "amber", "synthwave", "dos", "void", "ice", "redline"];

// Text effects animate colour and opacity; settle them so contrast is measured
// on what a reader sees at rest.
test.use({ reducedMotion: "reduce" });

/** One line per violation node: rule, element, and axe's reason (e.g. the contrast ratio). */
async function violations(page: Page, rules?: string[]): Promise<string[]> {
	const builder = new AxeBuilder({ page }).withTags(WCAG_TAGS);
	if (rules) builder.withRules(rules);
	const { violations } = await builder.analyze();
	return violations.flatMap((v) =>
		v.nodes.map((node) => {
			const reason = [...node.any, ...node.all, ...node.none][0]?.message ?? v.help;
			return `${v.id}: ${node.target.join(" ")} | ${reason}`;
		})
	);
}

for (const theme of ["dark", "light"] as const) {
	test.describe(`${theme} theme`, () => {
		test.beforeEach(({ appearance }) => appearance({ theme }));

		for (const [name, path] of Object.entries(PAGES)) {
			test(`${name} has no WCAG A/AA violations`, async ({ page }) => {
				await page.goto(path);
				expect(await violations(page)).toEqual([]);
			});
		}

		test("404 has no WCAG A/AA violations", async ({ page }) => {
			await page.goto("/no-such-page/");
			expect(await violations(page)).toEqual([]);
		});
	});
}

// Flavors recolour the dark theme only, so contrast is the risk they carry.
for (const flavor of FLAVORS) {
	test(`${flavor} flavor keeps text contrast on home and a post`, async ({ page, appearance }) => {
		await appearance({ theme: "dark", flavor });
		for (const path of [PAGES.home, PAGES.post]) {
			await page.goto(path);
			await expect(page.locator("html")).toHaveAttribute("data-flavor", flavor);
			expect(await violations(page, ["color-contrast"]), path).toEqual([]);
		}
	});
}
