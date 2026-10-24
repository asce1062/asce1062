import { readdir, readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const contentDir = (collection: string) => new URL(`../content/${collection}/`, import.meta.url);

/** Frontmatter block (between the first two `---` fences) of an MDX file. */
async function frontmatterOf(collection: string, file: string): Promise<string> {
	const source = await readFile(new URL(file, contentDir(collection)), "utf8");
	return source.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? "";
}

describe.each(["blog", "notes"])("%s frontmatter", (collection) => {
	it("names every file YYYY-MM-DD-slug.mdx with a matching permalink", async () => {
		const files = (await readdir(contentDir(collection))).filter((file) => file.endsWith(".mdx"));
		expect(files.length).toBeGreaterThan(0);

		for (const file of files) {
			const slug = file.replace(/\.mdx$/, "");
			const permalink = (await frontmatterOf(collection, file)).match(/^permalink:\s*["']?([^"'\n]+?)["']?\s*$/m)?.[1];

			expect(slug, file).toMatch(/^\d{4}-\d{2}-\d{2}-[a-z0-9-]+$/);
			// Prev/next navigation and share links use permalink; URLs and OG images use the id.
			expect(permalink, file).toBe(slug);
		}
	});
});
