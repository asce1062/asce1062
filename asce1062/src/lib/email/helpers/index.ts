/**
 * Email template helpers.
 *
 * - parseEntryStyle   Safe parser for the styleJson DB column → EntryStyle
 * - getPatternDataUri SVG notecard → inline base64 data URI for email backgrounds
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { EntryStyle } from "@/lib/api/guestbook";

// ---------------------------------------------------------------------------
// Entry style
// ---------------------------------------------------------------------------

export const ENTRY_STYLE_DEFAULTS: EntryStyle = {
	bg: "topography",
	borderColor: "base-300",
	borderWidth: "1px",
	borderStyle: "solid",
	borderRadius: "0.25rem",
};

// Value-constraint patterns for CSS properties that flow into inline styles.
// Rejects anything outside the expected value space to block CSS injection.
const BORDER_WIDTH_RE = /^\d+(\.\d+)?px$/;
const BORDER_RADIUS_RE = /^\d+(\.\d+)?(px|rem|em|%)$/;
const BORDER_STYLE_ALLOWLIST = new Set(["solid", "dashed", "dotted", "double", "none"]);

/**
 * Safely parses a styleJson string into an EntryStyle, falling back to
 * ENTRY_STYLE_DEFAULTS for any missing, wrong-typed, or out-of-allowlist fields.
 * Only whitelisted keys are extracted. Prevents prototype-pollution patterns.
 * CSS property values are constrained to safe patterns to block injection.
 */
export function parseEntryStyle(styleJson: string | undefined): EntryStyle {
	if (!styleJson) return ENTRY_STYLE_DEFAULTS;
	try {
		const parsed = JSON.parse(styleJson);
		return {
			// bg and borderColor are safe: bg is validated at use-time by SAFE_BG_RE;
			// borderColor is a token name looked up in a fixed palette object.
			bg: typeof parsed.bg === "string" ? parsed.bg : ENTRY_STYLE_DEFAULTS.bg,
			borderColor: typeof parsed.borderColor === "string" ? parsed.borderColor : ENTRY_STYLE_DEFAULTS.borderColor,
			// CSS values: constrained to known-safe patterns
			borderWidth:
				typeof parsed.borderWidth === "string" && BORDER_WIDTH_RE.test(parsed.borderWidth)
					? parsed.borderWidth
					: ENTRY_STYLE_DEFAULTS.borderWidth,
			borderStyle:
				typeof parsed.borderStyle === "string" && BORDER_STYLE_ALLOWLIST.has(parsed.borderStyle)
					? parsed.borderStyle
					: ENTRY_STYLE_DEFAULTS.borderStyle,
			borderRadius:
				typeof parsed.borderRadius === "string" && BORDER_RADIUS_RE.test(parsed.borderRadius)
					? parsed.borderRadius
					: ENTRY_STYLE_DEFAULTS.borderRadius,
		};
	} catch {
		return ENTRY_STYLE_DEFAULTS;
	}
}

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
	const color = palette[style.borderColor] ?? palette["base-300"] ?? "#ccc";
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
