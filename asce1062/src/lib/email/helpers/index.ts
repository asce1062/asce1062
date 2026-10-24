/**
 * Email template helpers.
 *
 * - getPatternDataUri SVG notecard → inline base64 data URI for email backgrounds
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { EntryStyle } from "@/lib/api/guestbook";

// ---------------------------------------------------------------------------
// CSS unit conversion for email
// ---------------------------------------------------------------------------

/**
 * Convert a single CSS length value to px for email clients.
 * Most email clients ignore rem/em. convert them to px.
 * px and % values pass through unchanged.
 * 1rem = 1em = 16px (base font size).
 */
export function emailPx(value: string): string {
	return value.replace(/^(\d+(?:\.\d+)?)r?em$/, (_, n) => `${Math.round(parseFloat(n) * 16)}px`);
}

// ---------------------------------------------------------------------------
// Entry border CSS for email
// ---------------------------------------------------------------------------

/**
 * Build a CSS border + border-radius string from a parsed EntryStyle,
 * resolving token names to hex and converting rem to px for email clients.
 */
export function entryBorderCss(style: EntryStyle, palette: Record<string, string>): string {
	const color =
		(Object.hasOwn(palette, style.borderColor) ? palette[style.borderColor] : palette["base-300"]) ?? "#ccc";
	const radius = `border-radius:${emailPx(style.borderRadius)};`;
	if (style.borderStyle === "none") return `border:none;${radius}`;
	return `border:${style.borderWidth} ${style.borderStyle} ${color};${radius}`;
}

// ---------------------------------------------------------------------------
// SVG pattern → base64 data URI
// ---------------------------------------------------------------------------

/** Matches fill="#000" and fill="#000000" (case-insensitive) */
const FILL_RE = /fill="#000(?:000)?"/gi;

/**
 * Only lowercase letters, digits, and hyphens. No path separators or dots.
 * Prevents directory-traversal reads when bg comes from user-supplied styleJson.
 */
const SAFE_BG_RE = /^[a-z0-9-]+$/;

/**
 * Module-level cache for raw SVG strings (keyed by bg name).
 * Fill replacement is applied per-call since body and card use different colors.
 */
const svgCache = new Map<string, string>();

/**
 * Returns a base64-encoded SVG data URI with its fill color replaced, or null
 * if bg is "none" / missing / invalid / the file cannot be read.
 */
export function getPatternDataUri(bg: string | undefined, fillColor: string): string | null {
	if (!bg || bg === "none") return null;
	if (!SAFE_BG_RE.test(bg)) return null;
	try {
		let svgRaw = svgCache.get(bg);
		if (svgRaw === undefined) {
			const svgPath = join(process.cwd(), "public", "notecards", `${bg}.svg`);
			svgRaw = readFileSync(svgPath, "utf-8");
			svgCache.set(bg, svgRaw);
		}
		return `data:image/svg+xml;base64,${Buffer.from(svgRaw.replace(FILL_RE, `fill="${fillColor}"`)).toString("base64")}`;
	} catch {
		return null;
	}
}
