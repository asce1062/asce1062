import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const projectFile = (path: string) => new URL(`../../${path}`, import.meta.url);

describe("Astro 7 migration contracts", () => {
	it("installs the directly imported PWA plugin in production", async () => {
		const packageJson = JSON.parse(await readFile(projectFile("package.json"), "utf8")) as {
			dependencies?: Record<string, string>;
			devDependencies?: Record<string, string>;
		};

		expect(packageJson.dependencies?.["vite-plugin-pwa"]).toBeDefined();
		expect(packageJson.devDependencies?.["vite-plugin-pwa"]).toBeUndefined();
	});

	it("binds the production navigation fallback to the generated offline document", async () => {
		const source = await readFile(projectFile("astro.config.mjs"), "utf8");
		const workbox = source.slice(source.indexOf("workbox: {"), source.indexOf("devOptions: {"));

		// The offline page is a network-failure fallback for navigations, never an
		// app shell: navigateFallback would serve it for every non-precached URL
		// (/about, /sps, /guestbook) even while online.
		// null, not omitted: vite-plugin-pwa defaults a missing value to "index.html".
		expect(workbox).toMatch(/navigateFallback:\s*null,/);
		expect(workbox.match(/precacheFallback:\s*{\s*fallbackURL:\s*"\/offline\/index\.html"\s*}/g)).toHaveLength(2);
		expect(source).toMatch(/devOptions:\s*{[\s\S]*?navigateFallback:\s*"\/offline"/);
	});

	it("never caches admin, guestbook or search pages and caches other pages network-first", async () => {
		const source = await readFile(projectFile("astro.config.mjs"), "utf8");
		const workbox = source.slice(source.indexOf("workbox: {"), source.indexOf("devOptions: {"));
		const privateRoute = workbox.indexOf(String.raw`/^\/(admin|guestbook|search)(\/|$)/`);
		const pageRoute = workbox.indexOf(`handler: "NetworkFirst"`);

		// First match wins: the network-only rule must come before the caching one.
		expect(privateRoute).toBeGreaterThan(-1);
		expect(pageRoute).toBeGreaterThan(privateRoute);
		expect(workbox.slice(privateRoute, pageRoute)).toMatch(/handler:\s*"NetworkOnly"/);
		// Redirects arrive as status 0 opaque redirects and must not be replayed.
		expect(workbox.slice(pageRoute)).toMatch(/cacheableResponse:\s*{\s*statuses:\s*\[200\]\s*}/);
	});

	it("precaches the app shell, not every page and image", async () => {
		const source = await readFile(projectFile("astro.config.mjs"), "utf8");
		const patterns = source.slice(source.indexOf("globPatterns: ["), source.indexOf("globIgnores: ["));

		expect(patterns).not.toMatch(/\*\*\/\*\.\{[^}]*(html|png|jpg|webp)/);
		expect(patterns).toContain(`"{index,about/index,hello/index,now/index,offline/index}.html"`);
	});

	it("uses explicit JSX spaces around multiline homepage links", async () => {
		const source = await readFile(projectFile("src/pages/index.astro"), "utf8");

		expect(source).toMatch(/what I'm up to\s*\{\s*" "\s*\}\s*<a href="\/now"/);
		expect(source).toMatch(/or sign the\s*\{\s*" "\s*\}\s*<a href="\/guestbook"/);
	});

	it("does not depend on the removed Astro DB integration", async () => {
		const files = [
			"astro.config.mjs",
			"db/seed.ts",
			"db/import-csv.ts",
			"src/env.d.ts",
			"src/lib/api/guestbook.ts",
			"src/lib/db/client.ts",
			"src/lib/db/schema.ts",
		];
		const sources = await Promise.all(
			files.map(async (file) => [file, await readFile(projectFile(file), "utf8")] as const)
		);
		const legacyReferences = sources.filter(([, source]) => /(?:@astrojs\/db|astro:db)/.test(source));

		expect(legacyReferences.map(([file]) => file)).toEqual([]);
	});

	it("provides a non-destructive baseline for fresh guestbook databases", async () => {
		const migration = await readFile(projectFile("db/migrations/0000_guestbook_baseline.sql"), "utf8").catch(() => "");

		expect(migration).toContain(`CREATE TABLE IF NOT EXISTS "Guestbook"`);
		expect(migration).toContain(`CREATE TABLE IF NOT EXISTS "GuestbookModerationLog"`);
		expect(migration).toContain(`CREATE INDEX IF NOT EXISTS "ix_guestbook_ip_time"`);
		expect(migration).not.toMatch(/\b(?:DROP|DELETE|TRUNCATE)\b/i);
	});
});
