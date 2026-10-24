/**
 * /api/music/* route handlers against a fake Navidrome.
 *
 * The player only browses public playlists, so the routes must only serve
 * public playlists and the tracks and covers they contain, never the rest of
 * the library behind the server's credentials.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";
import { resetPublicCatalogCache } from "@/lib/navidrome";
import { GET as getPlaylists } from "@/pages/api/music/playlists";
import { GET as getPlaylist } from "@/pages/api/music/playlist/[id]";
import { GET as getStream } from "@/pages/api/music/stream/[id]";
import { GET as getCover } from "@/pages/api/music/cover/[id]";

const PLAYLISTS = [
	{ id: "pl-public", name: "Public", public: true, coverArt: "pl-public_cover" },
	{ id: "pl-private", name: "Private", public: false, coverArt: "pl-private_cover" },
];
const ENTRIES: Record<string, { id: string; coverArt: string }[]> = {
	"pl-public": [{ id: "tr-public", coverArt: "al-public" }],
	"pl-private": [{ id: "tr-private", coverArt: "al-private" }],
};

function subsonic(body: Record<string, unknown>): Response {
	return Response.json({ "subsonic-response": { status: "ok", ...body } });
}

function fakeNavidrome(url: string | URL): Response {
	const { pathname, searchParams } = new URL(url);
	const endpoint = pathname.replace(/^\/rest\/|\.view$/g, "");
	const id = searchParams.get("id") ?? "";
	switch (endpoint) {
		case "getPlaylists":
			return subsonic({ playlists: { playlist: PLAYLISTS } });
		case "getPlaylist":
			return subsonic({ playlist: { ...PLAYLISTS.find((p) => p.id === id), entry: ENTRIES[id] ?? [] } });
		case "stream":
			return new Response("audio", {
				status: 206,
				headers: { "Content-Type": "audio/mpeg", "Content-Range": "bytes 0-4/5" },
			});
		case "getCoverArt":
			return new Response("img", { headers: { "Content-Type": "image/jpeg" } });
		default:
			return new Response("unknown", { status: 404 });
	}
}

const context = (id?: string, headers: HeadersInit = {}) =>
	({ params: { id }, request: new Request("https://alexmbugua.me/api/music", { headers }) }) as unknown as APIContext;

beforeEach(() => {
	vi.stubEnv("NAVIDROME_URL", "https://navidrome.example.test");
	vi.stubEnv("NAVIDROME_USER", "site");
	vi.stubEnv("NAVIDROME_PASS", "secret");
	vi.stubGlobal(
		"fetch",
		vi.fn(async (url: string | URL) => fakeNavidrome(url))
	);
	resetPublicCatalogCache();
});

afterEach(() => {
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
	vi.spyOn(console, "error").mockRestore();
});

describe("public catalog enforcement", () => {
	it("lists only public playlists", async () => {
		const body = await (await getPlaylists(context())).json();
		expect(body.playlists.map((p: { id: string }) => p.id)).toEqual(["pl-public"]);
	});

	it("serves a public playlist and 404s a private one by id", async () => {
		expect((await getPlaylist(context("pl-public"))).status).toBe(200);
		expect((await getPlaylist(context("pl-private"))).status).toBe(404);
	});

	it("streams tracks from public playlists only, forwarding Range", async () => {
		const ok = await getStream(context("tr-public", { Range: "bytes=0-4" }));
		expect(ok.status).toBe(206);
		const streamCall = vi.mocked(fetch).mock.calls.find(([url]) => String(url).includes("/rest/stream.view"));
		expect(new Headers(streamCall?.[1]?.headers).get("Range")).toBe("bytes=0-4");

		expect((await getStream(context("tr-private"))).status).toBe(404);
	});

	it("serves covers used by public playlists only, cacheable", async () => {
		const ok = await getCover(context("al-public"));
		expect(ok.status).toBe(200);
		expect(ok.headers.get("Cache-Control")).toMatch(/public/);
		expect(ok.headers.get("X-Content-Type-Options")).toBe("nosniff");
		expect((await getCover(context("pl-public_cover"))).status).toBe(200);

		expect((await getCover(context("al-private"))).status).toBe(404);
	});

	it("rejects malformed ids before any upstream call", async () => {
		vi.mocked(fetch).mockClear();
		expect((await getStream(context("a/b"))).status).toBe(400);
		expect((await getStream(context("x".repeat(200)))).status).toBe(400);
		expect(fetch).not.toHaveBeenCalled();
	});
});

describe("error responses", () => {
	it("never returns upstream or configuration details", async () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		vi.mocked(fetch).mockResolvedValue(
			Response.json({
				"subsonic-response": { status: "failed", error: { code: 40, message: "Wrong username or password" } },
			})
		);
		const failed = await getPlaylists(context());
		expect(failed.status).toBe(502);
		expect(JSON.stringify(await failed.json())).not.toMatch(/username|password|Navidrome API/i);

		vi.stubEnv("NAVIDROME_PASS", "");
		const misconfigured = await getPlaylists(context());
		expect(misconfigured.status).toBe(503);
		expect(JSON.stringify(await misconfigured.json())).not.toMatch(/NAVIDROME_/);
	});
});
