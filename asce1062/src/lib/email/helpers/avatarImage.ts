/**
 * Server-side avatar PNG compositor.
 *
 * Composites avatar layers (sorted by zIndex) into a single PNG using sharp,
 * reading layer PNGs from the public directory.
 *
 * Exports:
 *   compositeAvatarPng     → CompositeResult (used by the /api/avatar.png endpoint)
 *   renderAvatarPngDataUri → base64 data URI (convenience wrapper; not used in emails
 *                            because Gmail strips data: URIs from <img src>)
 */
import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { avatarConfig, getImagePath } from "@/data/avatarConfig";
import type { Gender, AvatarState } from "@/data/avatarConfig";

/** Output size in pixels. Upscaled with nearest-neighbor to keep pixel art crisp. */
const OUTPUT_SIZE = 96;

export type CompositeResult =
	| { ok: true; buffer: Buffer }
	| { ok: false; kind: "invalid_state" }
	| { ok: false; kind: "render_error"; message: string };

/**
 * Parse a stored avatar state string into gender + state object.
 * Returns null if the string is missing required fields, invalid, or out of range.
 */
function parseState(stored: string): { gender: Gender; state: AvatarState } | null {
	try {
		const params = new URLSearchParams(stored);
		const gender = params.get("gender") as Gender;
		const avatarStr = params.get("avatar");
		if (!gender || (gender !== "male" && gender !== "female") || !avatarStr) return null;
		const segments = avatarStr.split("-");
		// Reject anything that isn't a plain non-negative integer string (no floats, spaces, sign chars).
		if (!segments.every((s) => /^\d+$/.test(s))) return null;
		const parts = segments.map(Number);
		const layers = avatarConfig[gender];
		if (parts.length !== layers.length) return null;
		const state: AvatarState = {};
		for (let i = 0; i < layers.length; i++) {
			const value = parts[i];
			if (!Number.isFinite(value) || !Number.isInteger(value) || value < 1 || value > layers[i].count) return null;
			state[layers[i].name] = value;
		}
		return { gender, state };
	} catch {
		return null;
	}
}

/**
 * Composite avatar layers into a raw PNG Buffer.
 * Returns a typed result that distinguishes invalid input from render/asset failures.
 *
 * - invalid_state: the state string could not be parsed or is out of range → 400
 * - render_error:  valid state but a layer asset could not be read or sharp failed → 500
 */
export async function compositeAvatarPng(avatarStateStr: string | null | undefined): Promise<CompositeResult> {
	if (!avatarStateStr) return { ok: false, kind: "invalid_state" };

	const parsed = parseState(avatarStateStr);
	if (!parsed) {
		console.warn("[avatarImage] Invalid avatar state:", avatarStateStr.slice(0, 100));
		return { ok: false, kind: "invalid_state" };
	}
	const { gender, state } = parsed;

	const sortedLayers = [...avatarConfig[gender]].sort((a, b) => a.zIndex - b.zIndex);

	try {
		const overlays: { input: Buffer; top: 0; left: 0 }[] = [];

		for (const layer of sortedLayers) {
			const urlPath = getImagePath(gender, layer.name, state[layer.name]);
			const fsPath = join(process.cwd(), "public", urlPath);

			let imgBuf: Buffer;
			try {
				imgBuf = await readFile(fsPath);
			} catch (err) {
				throw new Error(
					`Missing layer asset "${layer.name}" at "${urlPath}": ${err instanceof Error ? err.message : String(err)}`,
					{ cause: err }
				);
			}

			const resized = await sharp(imgBuf).resize(OUTPUT_SIZE, OUTPUT_SIZE, { kernel: sharp.kernel.nearest }).toBuffer();

			overlays.push({ input: resized, top: 0, left: 0 });
		}

		// Defensive: every required layer must have loaded. The loop throws on any
		// failure, so this diverging would indicate a logic bug, not a missing file.
		if (overlays.length !== sortedLayers.length) {
			throw new Error(`Layer count mismatch: expected ${sortedLayers.length}, got ${overlays.length}`);
		}

		const buffer = await sharp({
			create: {
				width: OUTPUT_SIZE,
				height: OUTPUT_SIZE,
				channels: 4,
				background: { r: 0, g: 0, b: 0, alpha: 0 },
			},
		})
			.composite(overlays)
			.png()
			.toBuffer();

		return { ok: true, buffer };
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		console.error("[avatarImage] Render failed:", message);
		return { ok: false, kind: "render_error", message };
	}
}

/**
 * Composite avatar layers into a base64 PNG data URI.
 * NOTE: Some clients strip data: URIs from <img src>. Use the /api/avatar.png
 * endpoint URL in email templates instead.
 */
export async function renderAvatarPngDataUri(avatarStateStr: string | null | undefined): Promise<string | null> {
	if (!avatarStateStr) return null;
	const result = await compositeAvatarPng(avatarStateStr);
	return result.ok ? `data:image/png;base64,${result.buffer.toString("base64")}` : null;
}
