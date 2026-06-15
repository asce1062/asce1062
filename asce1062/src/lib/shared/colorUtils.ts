export type RGBColor = { r: number; g: number; b: number };

/** Parse 3- or 6-digit hex color strings (with or without leading `#`). */
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

/** Parse `rgb(R, G, B)` — comma-separated, integer channel values. */
function rgbStringToRgb(str: string): RGBColor | null {
	const m = str.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/);
	if (m) return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) };
	return null;
}

/** HSL hue-sector helper used by `hslStringToRgb`. */
function hue2rgb(p: number, q: number, t: number): number {
	let h = t;
	if (h < 0) h += 1;
	if (h > 1) h -= 1;
	if (h < 1 / 6) return p + (q - p) * 6 * h;
	if (h < 1 / 2) return q;
	if (h < 2 / 3) return p + (q - p) * (2 / 3 - h) * 6;
	return p;
}

/**
 * Parse hsl() / hsla() (both comma and space-separated syntaxes).
 * Examples: hsl(200, 80%, 50%), hsl(200deg 80% 50%), hsla(200, 80%, 50%, 0.5)
 */
function hslStringToRgb(str: string): RGBColor | null {
	const m = str.match(/^hsla?\(\s*([\d.]+)(?:deg)?\s*[,\s]\s*([\d.]+)%\s*[,\s]\s*([\d.]+)%/i);
	if (!m) return null;

	const h = Number(m[1]) / 360;
	const s = Number(m[2]) / 100;
	const l = Number(m[3]) / 100;

	if (s === 0) {
		const v = Math.round(l * 255);
		return { r: v, g: v, b: v };
	}

	const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
	const p = 2 * l - q;
	return {
		r: Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
		g: Math.round(hue2rgb(p, q, h) * 255),
		b: Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
	};
}

function linearToGamma(c: number): number {
	const v = Math.max(0, c);
	return v >= 0.0031308 ? 1.055 * Math.pow(v, 1 / 2.4) - 0.055 : 12.92 * v;
}

/**
 * Parse oklch().
 * Examples: oklch(0.7 0.15 200), oklch(70% 0.15 200deg)
 * L: 0–1 (or 0–100%); C: chroma >= 0; H: hue in degrees.
 */
function oklchStringToRgb(str: string): RGBColor | null {
	const m = str.match(/^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)(?:deg)?/i);
	if (!m) return null;

	const rawL = Number(m[1]);
	const L = m[2] === "%" ? rawL / 100 : rawL;
	const C = Number(m[3]);
	const H = (Number(m[4]) * Math.PI) / 180;

	// OKLCH -> OKLab
	const a = C * Math.cos(H);
	const b = C * Math.sin(H);

	// OKLab -> linear sRGB (Ottosson 2020 coefficients)
	const l_ = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
	const m_ = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
	const s_ = Math.pow(L - 0.0894841775 * a - 1.291485548 * b, 3);

	const rLin = 4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_;
	const gLin = -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_;
	const bLin = -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_;

	return {
		r: Math.round(Math.min(1, linearToGamma(rLin)) * 255),
		g: Math.round(Math.min(1, linearToGamma(gLin)) * 255),
		b: Math.round(Math.min(1, linearToGamma(bLin)) * 255),
	};
}

/**
 * Resolve a CSS custom property to a concrete color string by temporarily
 * applying it to an off-screen element and reading the computed value.
 *
 * Returns `rgb(R, G, B)` (compatible with parseCSSColor).
 * Falls back to `rgb(128, 128, 128)` outside a DOM context (SSR).
 */
export function resolveThemeCSSVar(varName: string, el?: HTMLElement): string {
	if (typeof document === "undefined") return "rgb(128, 128, 128)";
	const probe = document.createElement("div");
	probe.style.cssText = "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none";
	probe.style.color = `var(${varName})`;
	(el ?? document.body).appendChild(probe);
	const resolved = getComputedStyle(probe).color;
	probe.remove();
	return resolved || "rgb(128, 128, 128)";
}

/**
 * Parse any CSS color string into an RGB triplet.
 * Handles hex, rgb(), hsl(), oklch(), and named colors (via canvas fallback).
 */
export function parseCSSColor(color: string): RGBColor {
	const trimmed = color.trim();

	const hex = hexToRgb(trimmed);
	if (hex) return hex;

	const rgb = rgbStringToRgb(trimmed.toLowerCase());
	if (rgb) return rgb;

	const hsl = hslStringToRgb(trimmed);
	if (hsl) return hsl;

	const oklch = oklchStringToRgb(trimmed);
	if (oklch) return oklch;

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
 * Build an N-step color table by interpolating through all supplied colors.
 * Step 0 = colors[0], step N-1 = colors[last].
 *
 * Used for exact gradient-position color matching on sparkle adornments.
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
