import { describe, expect, it } from "vitest";
import { getContentUrl, getTagUrl } from "@/lib/content/utils";

describe("getTagUrl", () => {
	it("ends with a slash, the site's canonical URL form", () => {
		expect(getTagUrl("astro")).toBe("/tags/astro/");
		expect(getTagUrl("web-security")).toBe("/tags/web-security/");
	});

	it("encodes characters that are not safe in a path segment", () => {
		expect(getTagUrl("c#")).toBe("/tags/c%23/");
		expect(getTagUrl("how to")).toBe("/tags/how%20to/");
		expect(getTagUrl("a/b")).toBe("/tags/a%2Fb/");
		expect(getTagUrl("q?&a")).toBe("/tags/q%3F%26a/");
	});
});

describe("getContentUrl", () => {
	it("joins the base path and the entry id, dropping the file extension", () => {
		expect(getContentUrl("2025-06-18-website", "/blog")).toBe("/blog/2025-06-18-website");
		expect(getContentUrl("2026-03-12-licensing.mdx", "/notes")).toBe("/notes/2026-03-12-licensing");
	});
});
