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

export type SubsonicEndpoint = "getAlbumList2" | "getPlaylists" | "getPlaylist" | "getCoverArt" | "stream";

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

export function navidromeErrorResponse(error: unknown): Response {
	if (error instanceof NavidromeConfigError) {
		return jsonResponse({ error: error.message }, { status: 500 });
	}

	if (error instanceof NavidromeApiError) {
		return jsonResponse({ error: error.message }, { status: error.statusCode });
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
	if (!id?.trim()) {
		return jsonResponse({ error: "Missing music id" }, { status: 400 });
	}

	return id;
}

export async function proxySubsonicBinary(
	endpoint: Extract<SubsonicEndpoint, "getCoverArt" | "stream">,
	params: Record<string, string>,
	requestHeaders?: Headers
): Promise<Response> {
	const url = buildSubsonicUrl(endpoint, params);
	const headers = new Headers();
	const range = requestHeaders?.get("Range");

	// Audio seeking depends on forwarding Range and preserving partial-response headers.
	if (range) {
		headers.set("Range", range);
	}

	const upstream = await fetch(url, { headers });

	if (!upstream.ok) {
		return jsonResponse(
			{ error: `Navidrome media request failed: ${upstream.status} ${upstream.statusText}` },
			{ status: upstream.status === 404 ? 404 : 502 }
		);
	}

	const responseHeaders = new Headers({
		"Cache-Control": "no-store",
	});
	const copiedHeaders = ["Content-Type", "Content-Length", "Content-Range", "Accept-Ranges"];

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
