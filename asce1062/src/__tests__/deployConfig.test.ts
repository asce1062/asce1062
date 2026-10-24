import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const projectFile = (path: string) => new URL(`../../${path}`, import.meta.url);
const read = (path: string) => readFile(projectFile(path), "utf8");

/** [[headers]] blocks of netlify.toml as { for, body } pairs. */
async function netlifyHeaderRules(): Promise<{ path: string; body: string }[]> {
	const toml = await read("netlify.toml");
	return toml
		.split("[[headers]]")
		.slice(1)
		.map((block) => ({ path: block.match(/for\s*=\s*"([^"]+)"/)?.[1] ?? "", body: block.split("[[")[0] }));
}

const majorOf = (version: string) => Number(version.match(/\d+/)?.[0] ?? NaN);

describe("deploy configuration contracts", () => {
	it("versions the IcoMoon stylesheet with the token its font URLs use", async () => {
		const css = await read("public/fonts/icomoon/style.css");
		const layout = await read("src/layouts/Layout.astro");
		const cssToken = css.match(/icomoon\.woff\?([\w-]+)/)?.[1];
		const layoutToken = layout.match(/const ICOMOON_TOKEN = "([\w-]+)"/)?.[1];

		expect(cssToken).toBeTruthy();
		expect(layoutToken).toBe(cssToken);
		expect(layout).toContain("/fonts/icomoon/style.css?${ICOMOON_TOKEN}");
	});

	it("installs on Netlify without --legacy-peer-deps", async () => {
		expect(await read("netlify.toml")).not.toMatch(/legacy-peer-deps/);
	});

	it("never marks unhashed root scripts or styles immutable", async () => {
		const rules = await netlifyHeaderRules();
		for (const path of ["/*.js", "/*.css"]) {
			const rule = rules.find((r) => r.path === path);
			expect(rule?.body ?? "", `${path} must not be immutable`).not.toMatch(/immutable/);
		}
	});

	it("serves the service worker scripts with no-cache", async () => {
		const rules = await netlifyHeaderRules();
		for (const path of ["/sw.js", "/registerSW.js"]) {
			expect(rules.find((r) => r.path === path)?.body, path).toMatch(/Cache-Control\s*=\s*"[^"]*no-cache/);
		}
	});

	it("builds and declares a Node version that satisfies Astro's engines range", async () => {
		const toml = await read("netlify.toml");
		const pkg = JSON.parse(await read("package.json")) as { engines?: { node?: string } };
		const astro = JSON.parse(await read("node_modules/astro/package.json")) as { engines: { node: string } };
		const netlifyNode = toml.match(/NODE_VERSION\s*=\s*"([^"]+)"/)?.[1] ?? "";

		expect(pkg.engines?.node).toBe(astro.engines.node);
		// A bare major ("22") resolves to that line's latest release; it must be a
		// major above Astro's minimum, so no 22.x older than the floor can be picked.
		expect(majorOf(netlifyNode)).toBeGreaterThan(majorOf(astro.engines.node));
	});
});

describe("sitemap filter", () => {
	it("drops top-level utility and admin pages but keeps tag pages with the same words", async () => {
		const source = await read("astro.config.mjs");
		const pattern = source.match(/filter: \(page\) => !(\/.+\/)\.test\(new URL\(page\)\.pathname\)/)?.[1];
		expect(pattern).toBeTruthy();
		const excluded = new Function(`return ${pattern}`)() as RegExp;
		const kept = (path: string) => !excluded.test(path);

		for (const path of [
			"/404/",
			"/success/",
			"/search/",
			"/offline/",
			"/meta/",
			"/admin/",
			"/admin/guestbook/",
			"/.well-known/change-password/",
		]) {
			expect(kept(path), path).toBe(false);
		}
		for (const path of ["/", "/about/", "/tags/meta/", "/tags/search/", "/blog/2026-03-13-x/", "/verify/"]) {
			expect(kept(path), path).toBe(true);
		}
	});
});
