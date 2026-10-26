import { describe, expect, it } from "vitest";
import { exactRedirects, routePattern } from "../lib/link-targets.mjs";

describe("exactRedirects", () => {
	it("keeps same-site rules with an exact from path", () => {
		const toml = `
[[redirects]]
from = "/security.txt"
to = "/.well-known/security.txt"
status = 301

[[redirects]]
from = "/blog/:slug"
to = "/blog/:slug/"

[[redirects]]
from = "http://*alexmbugua.me/*"
to = "https://alexmbugua.me/:splat"

[[redirects]]
from = "/sps"
to = "https://example.com/sps"
`;
		expect(exactRedirects(toml)).toEqual([{ from: "/security.txt", to: "/.well-known/security.txt" }]);
	});

	it("returns nothing when there are no redirects", () => {
		expect(exactRedirects('[build]\ncommand = "npm run build"\n')).toEqual([]);
	});
});

describe("routePattern", () => {
	it.each([
		["guestbook.astro", "/guestbook", true],
		["guestbook.astro", "/guestbook/", true],
		["guestbook.astro", "/guestbook-old", false],
		["admin/index.astro", "/admin", true],
		["admin/index.astro", "/admin/guestbook", false],
		["api/avatar.png.ts", "/api/avatar.png", true],
		["api/avatar.png.ts", "/api/avatarxpng", false],
		["api/music/cover/[id].ts", "/api/music/cover/abc123", true],
		["api/music/cover/[id].ts", "/api/music/cover/a/b", false],
		["docs/[...rest].astro", "/docs/a/b/c", true],
	])("%s matches %s: %s", (page, path, matches) => {
		expect(routePattern(page).test(path)).toBe(matches);
	});
});
