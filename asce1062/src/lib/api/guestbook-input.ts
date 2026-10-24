/**
 * Guestbook input boundary.
 *
 * Every user-controlled guestbook field passes through here before it is
 * stored, rendered or emailed:
 *  - readGuestbookForm   FormData -> typed, length-capped fields
 *  - sanitizeEntryUrl    http(s)-only, normalized link URL
 *  - parseEntryStyle     style JSON -> EntryStyle restricted to customizer values
 *  - normalizeAvatarState avatar param string -> canonical form or null
 *
 * The renderers call the same parsers again for rows stored before this
 * boundary existed.
 */
import { borderStyles, patterns, radiusValues, swatchColors } from "@/config/guestbook";
import type { EntryStyle } from "@/lib/api/guestbook";
import { parseAvatarState, serializeAvatarState } from "@/scripts/avatarRenderCore";

export const ENTRY_LIMITS = {
	name: 100,
	/** RFC 5321 path limit */
	email: 254,
	url: 2048,
	message: 2000,
	style: 500,
	avatarState: 200,
} as const;

export const ENTRY_STYLE_DEFAULTS: EntryStyle = {
	bg: "topography",
	borderColor: "base-300",
	borderWidth: "1px",
	borderStyle: "solid",
	borderRadius: "0.25rem",
};

// Allowlists mirror what the customizer UI can produce (src/config/guestbook.ts).
// Anything else falls back to the default, so a value can never smuggle CSS.
const BG_VALUES: ReadonlySet<string> = new Set(["none", ...patterns]);
const BORDER_COLORS: ReadonlySet<string> = new Set(swatchColors);
const BORDER_STYLES: ReadonlySet<string> = new Set(borderStyles);
const BORDER_RADII: ReadonlySet<string> = new Set(radiusValues);
const BORDER_WIDTH_RE = /^\d(\.5)?px$/;

function pickAllowed(value: unknown, allowed: ReadonlySet<string>, fallback: string): string {
	return typeof value === "string" && allowed.has(value) ? value : fallback;
}

/** Parse stored or submitted style JSON. Never throws; unknown values become defaults. */
export function parseEntryStyle(styleJson: string | null | undefined): EntryStyle {
	if (!styleJson) return ENTRY_STYLE_DEFAULTS;
	let parsed: unknown;
	try {
		parsed = JSON.parse(styleJson);
	} catch {
		return ENTRY_STYLE_DEFAULTS;
	}
	if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return ENTRY_STYLE_DEFAULTS;

	const raw = parsed as Record<string, unknown>;
	return {
		bg: pickAllowed(raw.bg, BG_VALUES, ENTRY_STYLE_DEFAULTS.bg),
		borderColor: pickAllowed(raw.borderColor, BORDER_COLORS, ENTRY_STYLE_DEFAULTS.borderColor),
		borderWidth:
			typeof raw.borderWidth === "string" && BORDER_WIDTH_RE.test(raw.borderWidth)
				? raw.borderWidth
				: ENTRY_STYLE_DEFAULTS.borderWidth,
		borderStyle: pickAllowed(raw.borderStyle, BORDER_STYLES, ENTRY_STYLE_DEFAULTS.borderStyle),
		borderRadius: pickAllowed(raw.borderRadius, BORDER_RADII, ENTRY_STYLE_DEFAULTS.borderRadius),
	};
}

/** Canonical JSON for a parsed style: known keys only, fixed order. */
export function serializeEntryStyle(style: EntryStyle): string {
	return JSON.stringify({
		bg: style.bg,
		borderColor: style.borderColor,
		borderWidth: style.borderWidth,
		borderStyle: style.borderStyle,
		borderRadius: style.borderRadius,
	});
}

/**
 * Accept only absolute http(s) URLs. Returns the WHATWG-normalized href, which
 * drops embedded tabs/newlines and percent-encodes spaces, or null.
 */
export function sanitizeEntryUrl(raw: string | null | undefined): string | null {
	const trimmed = raw?.trim();
	if (!trimmed || trimmed.length > ENTRY_LIMITS.url) return null;
	let parsed: URL;
	try {
		parsed = new URL(trimmed);
	} catch {
		return null;
	}
	if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
	return parsed.href.length <= ENTRY_LIMITS.url ? parsed.href : null;
}

/** Canonical avatar param string, or null when it does not describe a real avatar. */
export function normalizeAvatarState(raw: string | null | undefined): string | null {
	if (!raw || raw.length > ENTRY_LIMITS.avatarState) return null;
	const parsed = parseAvatarState(raw);
	return parsed ? serializeAvatarState(parsed.gender, parsed.state) : null;
}

export interface GuestbookFormFields {
	name: string;
	email: string;
	url: string | null;
	message: string;
	/** Canonical style JSON, or null when the form sent none */
	style: string | null;
	/** Canonical avatar state, only when the submitter opted in */
	avatarState: string | null;
	avatarOptIn: boolean;
	theme: "light" | "dark";
	sendCopy: boolean;
	/** Name and message present and within limits, honeypot empty */
	isSubmittable: boolean;
}

function field(formData: FormData, key: string): string {
	const value = formData.get(key);
	return typeof value === "string" ? value : "";
}

/** Read the guestbook POST body. Missing fields become empty, never null. */
export function readGuestbookForm(formData: FormData): GuestbookFormFields {
	const name = field(formData, "name").trim();
	const message = field(formData, "message").trim();
	const email = field(formData, "email").trim();
	const style = field(formData, "style");
	const avatarOptIn = formData.get("avatarOptIn") === "on";

	return {
		name,
		email: email.length <= ENTRY_LIMITS.email ? email : "",
		url: sanitizeEntryUrl(field(formData, "url")),
		message,
		style: style && style.length <= ENTRY_LIMITS.style ? serializeEntryStyle(parseEntryStyle(style)) : null,
		avatarState: avatarOptIn ? normalizeAvatarState(field(formData, "avatarState")) : null,
		avatarOptIn,
		theme: formData.get("theme") === "dark" ? "dark" : "light",
		sendCopy: formData.get("send-copy") === "on",
		isSubmittable:
			!field(formData, "bot-field") &&
			name.length > 0 &&
			name.length <= ENTRY_LIMITS.name &&
			message.length > 0 &&
			message.length <= ENTRY_LIMITS.message,
	};
}
