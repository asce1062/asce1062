import { describe, expect, it, vi, afterEach } from "vitest";
import { buildSubsonicUrl, getNavidromeConfig, NavidromeConfigError, subsonicFetchJson } from "@/lib/navidrome";

// Covers the server-only boundary between Astro API routes and Navidrome.
// The browser should never need credentials or direct upstream URLs.
describe("getNavidromeConfig", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("reads server-only Navidrome env vars", () => {
		vi.stubEnv("NAVIDROME_URL", "https://navidrome.example.test/");
		vi.stubEnv("NAVIDROME_USER", "personal_website");
		vi.stubEnv("NAVIDROME_PASS", "secret");

		expect(getNavidromeConfig()).toEqual({
			baseUrl: "https://navidrome.example.test",
			username: "personal_website",
			password: "secret",
		});
	});

	it("reads Astro/Vite env object values", () => {
		expect(
			getNavidromeConfig({
				NAVIDROME_URL: "https://navidrome.example.test/",
				NAVIDROME_USER: "personal_website",
				NAVIDROME_PASS: "secret",
			})
		).toEqual({
			baseUrl: "https://navidrome.example.test",
			username: "personal_website",
			password: "secret",
		});
	});

	it("throws a clear config error when required env vars are missing", () => {
		vi.stubEnv("NAVIDROME_URL", "");
		vi.stubEnv("NAVIDROME_USER", "personal_website");
		vi.stubEnv("NAVIDROME_PASS", "");

		expect(() => getNavidromeConfig()).toThrow(NavidromeConfigError);
		expect(() => getNavidromeConfig()).toThrow(
			"Missing Navidrome environment variables: NAVIDROME_URL, NAVIDROME_PASS"
		);
	});
});

describe("buildSubsonicUrl", () => {
	it("adds token auth and fixed Subsonic client params", () => {
		const url = buildSubsonicUrl(
			"getPlaylists",
			{},
			{
				baseUrl: "https://navidrome.example.test",
				username: "personal_website",
				password: "secret",
			},
			"abc123"
		);

		expect(url.origin).toBe("https://navidrome.example.test");
		expect(url.pathname).toBe("/rest/getPlaylists.view");
		expect(url.searchParams.get("u")).toBe("personal_website");
		expect(url.searchParams.get("s")).toBe("abc123");
		expect(url.searchParams.get("t")).toBe("f22ae4f5eacb35c993e910606a413410");
		expect(url.searchParams.get("v")).toBe("1.16.1");
		expect(url.searchParams.get("c")).toBe("alexmbugua-website");
		expect(url.searchParams.get("f")).toBe("json");
	});

	it("preserves endpoint-specific query params", () => {
		const url = buildSubsonicUrl(
			"stream",
			{ id: "track-1", maxBitRate: "192" },
			{
				baseUrl: "https://navidrome.example.test",
				username: "personal_website",
				password: "secret",
			},
			"abc123"
		);

		expect(url.pathname).toBe("/rest/stream.view");
		expect(url.searchParams.get("id")).toBe("track-1");
		expect(url.searchParams.get("maxBitRate")).toBe("192");
	});
});

describe("subsonicFetchJson", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("returns the subsonic-response payload on ok responses", async () => {
		vi.stubGlobal(
			"fetch",
			vi
				.fn()
				.mockResolvedValue(
					new Response(JSON.stringify({ "subsonic-response": { status: "ok", playlists: { playlist: [] } } }))
				)
		);

		const payload = await subsonicFetchJson(
			"getPlaylists",
			{},
			{
				baseUrl: "https://navidrome.example.test",
				username: "personal_website",
				password: "secret",
			}
		);

		expect(payload).toEqual({ status: "ok", playlists: { playlist: [] } });
	});

	it("throws the Subsonic error message when Navidrome returns failed status", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(
				new Response(
					JSON.stringify({
						"subsonic-response": {
							status: "failed",
							error: { code: 40, message: "Wrong username or password" },
						},
					})
				)
			)
		);

		await expect(
			subsonicFetchJson(
				"getPlaylists",
				{},
				{
					baseUrl: "https://navidrome.example.test",
					username: "personal_website",
					password: "secret",
				}
			)
		).rejects.toThrow("Navidrome API error 40: Wrong username or password");
	});
});
