import type { RGBColor } from "./types";

function hexToRgb(hex: string): RGBColor | null {
	const long = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	if (long) {
		return {
			r: parseInt(long[1]!, 16),
			g: parseInt(long[2]!, 16),
			b: parseInt(long[3]!, 16),
		};
	}
	const short = /^#?([a-f\d])([a-f\d])([a-f\d])$/i.exec(hex);
	if (short) {
		return {
			r: parseInt(short[1]! + short[1], 16),
			g: parseInt(short[2]! + short[2], 16),
			b: parseInt(short[3]! + short[3], 16),
		};
	}
	return null;
}

function rgbStringToRgb(str: string): RGBColor | null {
	const m = str.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/);
	if (m) return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) };
	return null;
}

/**
 * Parse any CSS color string into an RGB triplet.
 * Handles hex, rgb(), and named colors (via canvas fallback).
 */
export function parseCSSColor(color: string): RGBColor {
	const trimmed = color.trim();

	const hex = hexToRgb(trimmed);
	if (hex) return hex;

	const rgb = rgbStringToRgb(trimmed.toLowerCase());
	if (rgb) return rgb;

	if (typeof document !== "undefined") {
		const canvas = document.createElement("canvas");
		canvas.width = canvas.height = 1;
		const ctx = canvas.getContext("2d");
		if (ctx) {
			ctx.fillStyle = trimmed;
			ctx.fillRect(0, 0, 1, 1);
			const data = ctx.getImageData(0, 0, 1, 1).data;
			return { r: data[0] ?? 0, g: data[1] ?? 0, b: data[2] ?? 0 };
		}
	}

	return { r: 128, g: 128, b: 128 };
}

/**
 * Build a 200-step color table by interpolating through all supplied colors.
 * Step 0 = colors[0], step 199 = colors[N-1].
 *
 * Used for exact gradient-position color matching on sparkle adornments
 */
export function multiColorFade(colors: string[], steps: number): RGBColor[] {
	if (colors.length === 0) return Array(steps).fill({ r: 128, g: 128, b: 128 }) as RGBColor[];
	if (colors.length === 1) {
		const c = parseCSSColor(colors[0]!);
		return Array(steps).fill(c) as RGBColor[];
	}

	const parsed = colors.map(parseCSSColor);
	const segments = parsed.length - 1;
	const result: RGBColor[] = [];

	for (let step = 0; step < steps; step++) {
		const t = steps === 1 ? 0 : step / (steps - 1);
		const segPos = t * segments;
		const segIdx = Math.min(Math.floor(segPos), segments - 1);
		const segT = segPos - segIdx;
		const from = parsed[segIdx]!;
		const to = parsed[segIdx + 1]!;
		result.push({
			r: from.r + (to.r - from.r) * segT,
			g: from.g + (to.g - from.g) * segT,
			b: from.b + (to.b - from.b) * segT,
		});
	}

	return result;
}
