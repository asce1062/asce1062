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
