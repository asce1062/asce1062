/**
 * Avatar Render Core
 *
 * Shared rendering utilities used by sidebarAvatar, guestbookAvatarWidget,
 * and entryAvatarRenderer. Kept minimal: image loading, canvas compositing,
 * state serialization / deserialization.
 *
 * Storage format (localStorage + data-avatar-state attributes):
 *   "gender=male&avatar=3-54-12-14-15-21"
 * Parsed with URLSearchParams for consistency with the existing URL scheme.
 */

import type { Gender, AvatarState } from "@/data/avatarConfig";
import { avatarConfig, getImagePath } from "@/data/avatarConfig";

/**
 * Load a single layer image. Resolves null on failure and logs a warning
 * so missing assets are visible without crashing the render.
 */
export function loadImage(src: string): Promise<HTMLImageElement | null> {
	return new Promise((resolve) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = () => {
			console.warn("[avatarRenderCore] Failed to load layer image:", src);
			resolve(null);
		};
		img.src = src;
	});
}

/**
 * Composite all avatar layers onto the canvas.
 * Loads all layer images concurrently, then draws them in zIndex order.
 * Null images (failed loads) are skipped, the render continues with the remaining layers.
 */
export async function renderToCanvas(canvas: HTMLCanvasElement, gender: Gender, state: AvatarState): Promise<void> {
	const ctx = canvas.getContext("2d");
	if (!ctx) return;

	const sortedLayers = [...avatarConfig[gender]].sort((a, b) => a.zIndex - b.zIndex);

	// Load all layer images concurrently, then draw in zIndex order.
	const images = await Promise.all(
		sortedLayers.map((layer) => loadImage(getImagePath(gender, layer.name, state[layer.name])))
	);

	ctx.clearRect(0, 0, canvas.width, canvas.height);
	for (const img of images) {
		if (img !== null) {
			ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
		}
	}
}

/** Serialize current gender + state into the storage/URL param string. */
export function serializeAvatarState(gender: Gender, state: AvatarState): string {
	const parts = avatarConfig[gender].map((l) => state[l.name]).join("-");
	return `gender=${gender}&avatar=${parts}`;
}

/** Parse a storage string back into gender + state. Returns null on invalid input. */
export function parseAvatarState(stored: string): { gender: Gender; state: AvatarState } | null {
	try {
		const params = new URLSearchParams(stored);
		const gender = params.get("gender") as Gender;
		const avatarString = params.get("avatar");
		if (!gender || (gender !== "male" && gender !== "female") || !avatarString) return null;

		// Reject anything that isn't a plain non-negative integer string before converting.
		const segments = avatarString.split("-");
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

/** Build the /8biticon href for the current state. */
export function buildAvatarURL(gender: Gender, state: AvatarState): string {
	const parts = avatarConfig[gender].map((l) => state[l.name]).join("-");
	return `/8biticon?gender=${gender}&avatar=${parts}`;
}
