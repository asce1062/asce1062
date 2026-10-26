/**
 * What a static crawl of dist/ cannot see, derived from the same sources
 * Netlify uses so the lists never go stale:
 *
 *   - redirects: exact-path [[redirects]] in netlify.toml. The link checker
 *     rewrites `from` to `to`, so the target must exist in dist/.
 *   - SSR routes: pages with `export const prerender = false`. They render on
 *     request, so there is no file to find; links to them are skipped.
 */

import { parse } from "smol-toml";

/**
 * @typedef {{ from: string, to: string }} Redirect
 */

/**
 * Same-site redirects with an exact `from` path. Placeholder (`:slug`) and
 * splat (`*`) rules, and rules to other hosts, are left to Netlify.
 * @param {string} toml netlify.toml source
 * @returns {Redirect[]}
 */
export function exactRedirects(toml) {
	const { redirects = [] } = /** @type {{ redirects?: Array<Record<string, unknown>> }} */ (parse(toml));
	return redirects
		.filter(
			(rule) =>
				typeof rule.from === "string" &&
				typeof rule.to === "string" &&
				rule.from.startsWith("/") &&
				rule.to.startsWith("/") &&
				!/[:*]/.test(rule.from)
		)
		.map((rule) => ({ from: /** @type {string} */ (rule.from), to: /** @type {string} */ (rule.to) }));
}

/**
 * URL pattern for an on-demand page, from its path under src/pages/.
 * `api/music/cover/[id].ts` → /^\/api\/music\/cover\/[^/]+\/?$/
 * @param {string} pagePath path relative to src/pages, with forward slashes
 * @returns {RegExp}
 */
export function routePattern(pagePath) {
	const route = pagePath
		.replace(/\.(astro|ts|js|mjs|mdx)$/, "")
		.replace(/(^|\/)index$/, "")
		.split("/")
		.map((segment) => {
			if (/^\[\.\.\.[^\]]+\]$/.test(segment)) return ".*";
			const escaped = segment.replace(/[.*+?^${}()|\\]/g, "\\$&");
			return escaped.replace(/\[[^\]]+\]/g, "[^/]+");
		})
		.join("/");
	return new RegExp(`^/${route}/?$`);
}
