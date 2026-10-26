import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";

const DIST = "dist";

/** URL path of every page in dist/, e.g. "/blog/" for dist/blog/index.html. */
export function builtPages(): string[] {
	const files = readdirSync(DIST, { withFileTypes: true, recursive: true })
		.filter((entry) => entry.isFile() && entry.name.endsWith(".html"))
		.map((entry) => relative(DIST, join(entry.parentPath, entry.name)).split(sep).join("/"));
	if (files.length === 0) throw new Error("No pages in dist/. Run npm run build first.");
	return files.map((file) => "/" + file.replace(/(^|\/)index\.html$/, "$1")).sort();
}
