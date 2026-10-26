/**
 * Post-build check: every same-site link and #fragment in dist/ resolves.
 * External links are skipped (other sites' outages must not block a push).
 *
 * Run with:  npm run check:links   (after npm run build)
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { LinkChecker, LinkState } from "linkinator";
import { exactRedirects, routePattern } from "./lib/link-targets.mjs";

const DIST = "dist";
const PAGES = "src/pages";

/** Pages under src/pages that render on request (`prerender = false`). */
function onDemandRoutes() {
	return readdirSync(PAGES, { withFileTypes: true, recursive: true })
		.filter((entry) => entry.isFile())
		.map((entry) => join(entry.parentPath, entry.name))
		.filter((file) => /export const prerender = false/.test(readFileSync(file, "utf8")))
		.map((file) => routePattern(relative(PAGES, file).split(sep).join("/")));
}

const ssrRoutes = onDemandRoutes();
const redirects = exactRedirects(readFileSync("netlify.toml", "utf8"));

const checker = new LinkChecker();
const result = await checker.check({
	path: DIST,
	recurse: true,
	cleanUrls: true,
	checkFragments: true,
	// The crawler serves dist/ on a loopback port; anything else is external.
	linksToSkip: async (link) => {
		const url = new URL(link);
		if (!["localhost", "127.0.0.1"].includes(url.hostname)) return true;
		return ssrRoutes.some((route) => route.test(url.pathname));
	},
	urlRewriteExpressions: redirects.map(({ from, to }) => ({
		pattern: new RegExp(`^(https?://[^/]+)${from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=[?#]|$)`),
		replacement: `$1${to}`,
	})),
});

const broken = result.links.filter((link) => link.state === LinkState.BROKEN);
if (broken.length > 0) {
	/** @type {Map<string, Set<string>>} */
	const byTarget = new Map();
	for (const { url, status, parent = "?" } of broken) {
		// The page loads (200) but has no element with that id.
		const reason = status === 200 && url.includes("#") ? "missing #fragment" : (status ?? "error");
		const key = `[${reason}] ${url}`;
		byTarget.set(key, (byTarget.get(key) ?? new Set()).add(parent));
	}
	for (const [target, parents] of byTarget) {
		console.error(`${target}\n  linked from: ${[...parents].slice(0, 5).join(", ")}${parents.size > 5 ? ", ..." : ""}`);
	}
	console.error(`\ncheck-links: ${byTarget.size} broken link targets in ${DIST}/.`);
	process.exit(1);
}

const checked = result.links.filter((link) => link.state === LinkState.OK).length;
console.log(`check-links: ${checked} same-site links resolve.`);
