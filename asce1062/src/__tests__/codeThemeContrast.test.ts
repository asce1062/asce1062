/**
 * Code blocks use Rose Pine (dark) and Rose Pine Dawn (light). Every token
 * color must meet WCAG AA (4.5:1) on its theme's own code background.
 */
import { describe, expect, it } from "vitest";
import { loadAccessibleTheme } from "../../markdown.config";

function luminance(hex: string): number {
	const [r, g, b] = [1, 3, 5]
		.map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
		.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (hi + 0.05) / (lo + 0.05);
}

describe.each(["rose-pine", "rose-pine-dawn"] as const)("%s code theme", (name) => {
	it("keeps its name, so the data-theme selectors still match", async () => {
		expect((await loadAccessibleTheme(name)).name).toBe(name);
	});

	it("has AA contrast for every token color", async () => {
		const theme = await loadAccessibleTheme(name);
		const background = theme.colors?.["editor.background"] ?? "";
		const failing = theme.settings
			.map((token) => token.settings.foreground)
			.filter((color): color is string => Boolean(color))
			.filter((color) => contrast(color.slice(0, 7), background) < 4.5);

		expect(background).toMatch(/^#[0-9a-f]{6}$/i);
		expect([...new Set(failing)]).toEqual([]);
	});
});
