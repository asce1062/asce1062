/**
 * Server-only Navidrome/Subsonic gateway helpers.
 *
 * The browser never talks to Navidrome directly. Astro API routes import this
 * module, attach Subsonic token-auth parameters, normalize the parts of the
 * response shape the UI needs, and proxy binary cover/audio responses through
 * same-origin endpoints. Keep this module out of client-side scripts so
 * NAVIDROME_PASS never reaches the bundle.
 */

import { createHash, randomBytes } from "node:crypto";

const SUBSONIC_VERSION = "1.16.1";
const SUBSONIC_CLIENT = "alexmbugua-website";

/** JSON calls are small; fail fast rather than pin the function. */
const JSON_TIMEOUT_MS = 8_000;
/** Media: time allowed until upstream response headers arrive (not the whole body). */
const MEDIA_HEADERS_TIMEOUT_MS = 8_000;
/** How long the set of public playlist/track/cover ids is reused per warm instance. */
const CATALOG_TTL_MS = 5 * 60_000;
/** Navidrome ids (base62, al-/pl- prefixed cover ids). Anything else never reaches upstream. */
const MUSIC_ID_RE = /^[A-Za-z0-9_.-]{1,128}$/;

export type SubsonicEndpoint = "getPlaylists" | "getPlaylist" | "getCoverArt" | "stream";

export interface NavidromeConfig {
	baseUrl: string;
	username: string;
	password: string;
}

export interface NavidromeEnv {
	NAVIDROME_URL?: string;
	NAVIDROME_USER?: string;
	NAVIDROME_PASS?: string;
}

export interface SubsonicErrorPayload {
	code?: number;
	message?: string;
}

export interface SubsonicResponsePayload {
	status?: "ok" | "failed";
	error?: SubsonicErrorPayload;
	[key: string]: unknown;
}

interface SubsonicEnvelope {
	"subsonic-response"?: SubsonicResponsePayload;
}

export class NavidromeConfigError extends Error {
	constructor(missingVars: string[]) {
		super(`Missing Navidrome environment variables: ${missingVars.join(", ")}`);
		this.name = "NavidromeConfigError";
	}
}

class NavidromeApiError extends Error {
	statusCode: number;

	constructor(message: string, statusCode = 502) {
		super(message);
		this.name = "NavidromeApiError";
		this.statusCode = statusCode;
	}
}

export function getNavidromeConfig(env: NavidromeEnv = import.meta.env): NavidromeConfig {
	const navidromeUrl = env.NAVIDROME_URL?.trim();
	const username = env.NAVIDROME_USER?.trim();
	const password = env.NAVIDROME_PASS;
	const missingVars = [
		{ name: "NAVIDROME_URL", value: navidromeUrl },
		{ name: "NAVIDROME_USER", value: username },
		{ name: "NAVIDROME_PASS", value: password },
	]
		.filter(({ value }) => !value)
		.map(({ name }) => name);

	if (missingVars.length > 0) {
		throw new NavidromeConfigError(missingVars);
	}

	return {
		baseUrl: navidromeUrl!.replace(/\/+$/, ""),
		username: username!,
		password: password!,
	};
}

export function createSubsonicToken(password: string, salt: string): string {
	return createHash("md5").update(`${password}${salt}`).digest("hex");
}

export function buildSubsonicUrl(
	endpoint: SubsonicEndpoint,
	params: Record<string, string>,
	config: NavidromeConfig = getNavidromeConfig(),
	salt: string = randomBytes(8).toString("hex")
): URL {
	const url = new URL(`/rest/${endpoint}.view`, config.baseUrl);

	// Navidrome implements Subsonic token auth: md5(password + salt).
	url.searchParams.set("u", config.username);
	url.searchParams.set("t", createSubsonicToken(config.password, salt));
	url.searchParams.set("s", salt);
	url.searchParams.set("v", SUBSONIC_VERSION);
	url.searchParams.set("c", SUBSONIC_CLIENT);
	url.searchParams.set("f", "json");

	for (const [key, value] of Object.entries(params)) {
		url.searchParams.set(key, value);
	}

	return url;
}

export async function subsonicFetchJson(
	endpoint: SubsonicEndpoint,
	params: Record<string, string> = {},
	config: NavidromeConfig = getNavidromeConfig()
): Promise<SubsonicResponsePayload> {
	const url = buildSubsonicUrl(endpoint, params, config);
	const response = await fetch(url, {
		headers: {
			Accept: "application/json",
		},
		signal: AbortSignal.timeout(JSON_TIMEOUT_MS),
	});

	if (!response.ok) {
		throw new NavidromeApiError(`Navidrome request failed: ${response.status} ${response.statusText}`);
	}

	const envelope = (await response.json()) as SubsonicEnvelope;
	const payload = envelope["subsonic-response"];

	if (!payload) {
		throw new NavidromeApiError("Navidrome returned an invalid Subsonic response");
	}

	if (payload.status === "failed") {
		const code = payload.error?.code ?? "unknown";
		const message = payload.error?.message ?? "Unknown error";
		throw new NavidromeApiError(`Navidrome API error ${code}: ${message}`);
	}

	return payload;
}

export function jsonResponse(data: unknown, init?: ResponseInit): Response {
	return new Response(JSON.stringify(data), {
		...init,
		headers: {
			"Content-Type": "application/json; charset=utf-8",
			"Cache-Control": "no-store",
			...init?.headers,
		},
	});
}

/**
 * Map a gateway failure to a client response. Details (upstream messages such as
 * "Wrong username or password", missing env var names) are logged, never returned.
 */
export function navidromeErrorResponse(error: unknown): Response {
	if (error instanceof NavidromeConfigError) {
		console.error("Navidrome is not configured:", error.message);
		return jsonResponse({ error: "Music service unavailable" }, { status: 503 });
	}

	if (error instanceof NavidromeApiError) {
		console.error("Navidrome request failed:", error.message);
		return jsonResponse({ error: "Music service unavailable" }, { status: error.statusCode });
	}

	if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
		console.error("Navidrome request timed out:", error.message);
		return jsonResponse({ error: "Music service timed out" }, { status: 504 });
	}

	console.error("Unexpected Navidrome route error:", error);
	return jsonResponse({ error: "Unexpected music service error" }, { status: 500 });
}

// The Subsonic JSON envelope is loose and endpoint-specific. These helpers keep
// route serializers defensive without spreading type assertions across files.
export function asRecord(value: unknown): Record<string, unknown> | null {
	return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

export function readRecordArray(parent: unknown, key: string): Record<string, unknown>[] {
	const record = asRecord(parent);
	const value = record?.[key];
	return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => asRecord(item) !== null) : [];
}

export function readString(record: Record<string, unknown>, key: string): string | undefined {
	const value = record[key];
	return typeof value === "string" && value.trim() ? value : undefined;
}

export function readNumber(record: Record<string, unknown>, key: string): number | undefined {
	const value = record[key];
	return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function requireMusicId(id: string | undefined): string | Response {
	if (!id || !MUSIC_ID_RE.test(id)) {
		return jsonResponse({ error: "Invalid music id" }, { status: 400 });
	}

	return id;
}

export function notFoundResponse(): Response {
	return jsonResponse({ error: "Not found" }, { status: 404 });
}

export function isPublicPlaylist(playlist: Record<string, unknown>): boolean {
	return playlist.public === true || playlist.public === "true";
}

/** Ids the public player may request: public playlists and what they contain. */
export interface PublicCatalog {
	/** Raw Subsonic records of the public playlists, in Navidrome's order */
	playlists: readonly Record<string, unknown>[];
	playlistIds: ReadonlySet<string>;
	trackIds: ReadonlySet<string>;
	coverIds: ReadonlySet<string>;
}

export type CatalogKind = "playlistIds" | "trackIds" | "coverIds";

async function loadPublicCatalog(): Promise<PublicCatalog> {
	const list = await subsonicFetchJson("getPlaylists");
	const publicPlaylists = readRecordArray(asRecord(list.playlists), "playlist").filter(isPublicPlaylist);
	const playlists: Record<string, unknown>[] = [];
	const playlistIds = new Set<string>();
	const trackIds = new Set<string>();
	const coverIds = new Set<string>();

	// allSettled: one playlist failing (deleted mid-load, upstream hiccup) must not
	// take the whole player down; it is simply left out until the next load.
	const details = await Promise.allSettled(
		publicPlaylists.map(async (summary) => {
			const id = readString(summary, "id");
			if (!id) throw new Error("playlist without id");
			return { id, summary, payload: await subsonicFetchJson("getPlaylist", { id }) };
		})
	);

	for (const detail of details) {
		if (detail.status === "rejected") {
			console.error("Navidrome playlist skipped from public catalog:", detail.reason);
			continue;
		}
		const { id, summary, payload } = detail.value;
		const playlist = asRecord(payload.playlist);
		if (!playlist || !isPublicPlaylist(playlist)) continue;
		playlists.push(summary);
		playlistIds.add(id);
		// Matches the client: a playlist without coverArt uses its own id as the cover id.
		coverIds.add(readString(summary, "coverArt") ?? id);
		coverIds.add(readString(playlist, "coverArt") ?? id);
		for (const track of readRecordArray(playlist, "entry")) {
			const trackId = readString(track, "id");
			if (trackId) trackIds.add(trackId);
			const coverArt = readString(track, "coverArt");
			if (coverArt) coverIds.add(coverArt);
		}
	}

	return { playlists, playlistIds, trackIds, coverIds };
}

/** A miss may refresh the catalog early, but at most this often. */
const CATALOG_MISS_REFRESH_MS = 30_000;

let catalogCache: { loadedAt: number; catalog: Promise<PublicCatalog> } | null = null;

function loadIntoCache(now: number): Promise<PublicCatalog> {
	const catalog = loadPublicCatalog();
	catalogCache = { loadedAt: now, catalog };
	// A failed load is not cached, so the next request retries.
	catalog.catch(() => {
		if (catalogCache?.catalog === catalog) catalogCache = null;
	});
	return catalog;
}

/** The public catalog, cached per warm function instance. */
export function getPublicCatalog(now: number = Date.now()): Promise<PublicCatalog> {
	if (catalogCache && now - catalogCache.loadedAt < CATALOG_TTL_MS) return catalogCache.catalog;
	return loadIntoCache(now);
}

/**
 * Whether an id is publicly servable. On a miss against a catalog older than
 * CATALOG_MISS_REFRESH_MS, reload once first: a playlist just made public, or a
 * cover id that changed when a playlist was edited, should not 404 for minutes.
 */
export async function isInPublicCatalog(kind: CatalogKind, id: string, now: number = Date.now()): Promise<boolean> {
	if ((await getPublicCatalog(now))[kind].has(id)) return true;
	if (catalogCache && now - catalogCache.loadedAt < CATALOG_MISS_REFRESH_MS) return false;
	return (await loadIntoCache(now))[kind].has(id);
}

/** Test hook: forget the cached catalog. */
export function resetPublicCatalogCache(): void {
	catalogCache = null;
}

export async function proxySubsonicBinary(
	endpoint: Extract<SubsonicEndpoint, "getCoverArt" | "stream">,
	params: Record<string, string>,
	request?: Request
): Promise<Response> {
	const url = buildSubsonicUrl(endpoint, params);
	const headers = new Headers();
	const range = request?.headers.get("Range");

	// Audio seeking depends on forwarding Range and preserving partial-response headers.
	if (range) {
		headers.set("Range", range);
	}
	// Let the browser revalidate cached covers (ETag/Last-Modified are passed back).
	for (const name of ["If-None-Match", "If-Modified-Since"]) {
		const value = request?.headers.get(name);
		if (value) headers.set(name, value);
	}

	// Abort upstream when the browser goes away, and give up if headers never
	// arrive. The timer is cleared once streaming starts, so long tracks play on.
	const controller = new AbortController();
	const headersTimeout = setTimeout(() => controller.abort(), MEDIA_HEADERS_TIMEOUT_MS);
	if (request?.signal.aborted) controller.abort();
	request?.signal.addEventListener("abort", () => controller.abort(), { once: true });
	let upstream: Response;
	try {
		upstream = await fetch(url, { headers, signal: controller.signal });
	} finally {
		clearTimeout(headersTimeout);
	}

	if (upstream.status === 304) {
		const notModified = new Headers({ "Cache-Control": "public, max-age=86400" });
		for (const name of ["ETag", "Last-Modified"]) {
			const value = upstream.headers.get(name);
			if (value) notModified.set(name, value);
		}
		return new Response(null, { status: 304, headers: notModified });
	}

	if (!upstream.ok) {
		console.error(`Navidrome media request failed: ${endpoint} ${upstream.status} ${upstream.statusText}`);
		await upstream.body?.cancel().catch(() => {});
		// 404 and 416 (bad Range) mean something to the media element; anything else is upstream trouble.
		const status = upstream.status === 404 || upstream.status === 416 ? upstream.status : 502;
		return jsonResponse({ error: "Media unavailable" }, { status });
	}

	const responseHeaders = new Headers({
		// Covers are immutable per id and safe to cache; streams stay uncached.
		"Cache-Control": endpoint === "getCoverArt" ? "public, max-age=86400" : "no-store",
		"X-Content-Type-Options": "nosniff",
	});
	const copiedHeaders = ["Content-Type", "Content-Length", "Content-Range", "Accept-Ranges", "ETag", "Last-Modified"];

	for (const header of copiedHeaders) {
		const value = upstream.headers.get(header);
		if (value) {
			responseHeaders.set(header, value);
		}
	}

	if (!responseHeaders.has("Content-Type")) {
		responseHeaders.set("Content-Type", endpoint === "stream" ? "audio/mpeg" : "image/jpeg");
	}

	return new Response(upstream.body, {
		status: upstream.status,
		headers: responseHeaders,
	});
}
