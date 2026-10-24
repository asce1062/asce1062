/**
 * Shared constants and helpers for email templates and builders.
 */
import isEmail from "validator/lib/isEmail";
import { SITE, SOCIAL } from "@/config/site-config";

/** Canonical site root. Matches astro.config.mjs `site` value. */
export const BASE_URL = SITE.url;

/**
 * GitHub Issues URL derived from SOCIAL.repo.
 * SOCIAL.repo points to a tree path; strip /tree/... suffix to get the repo root.
 * Falls back to "" if SOCIAL.repo is absent or does not contain "/tree/".
 */
const _repoRoot = SOCIAL.repo?.split("/tree/")[0] ?? "";
export const GITHUB_ISSUES_URL = _repoRoot ? `${_repoRoot}/issues` : "";

/** Characters shown in the message preview before truncation (admin notify HTML + plain text). */
export const MAX_ADMIN_PREVIEW_CHARS = 500;

/** Characters shown in the entry-copy email before truncation (HTML + plain text). */
export const MAX_COPY_MSG_CHARS = 1_000;

/** Emit a warning when a rendered HTML email exceeds this size (bytes). */
export const HTML_SIZE_WARN_BYTES = 100_000;

/** Max length for any user-supplied string used in an email header (Subject, name, etc.). */
const MAX_HEADER_CHARS = 120;

/**
 * Validates a user-supplied URL for safe use in email anchor hrefs.
 * Only http: and https: schemes are allowed.
 * Rejects javascript:, data:, etc.
 * Returns undefined for invalid/empty values so callers can omit the link.
 */
export function sanitizeUrl(url: string | null | undefined): string | undefined {
	if (!url) return undefined;
	try {
		// Return the normalized href, not the input: the parser drops embedded
		// newlines, which would otherwise forge lines in plain-text bodies.
		const parsed = new URL(url);
		return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.href : undefined;
	} catch {
		return undefined;
	}
}

/**
 * Every character that can start a new line or act as a control: C0/C1 controls
 * (CR, LF, NEL U+0085, NUL, ESC...) plus the Unicode line and paragraph separators.
 */
// eslint-disable-next-line no-control-regex
const LINE_BREAK_OR_CONTROL_RE = /[\u0000-\u001F\u007F-\u009F\u2028\u2029]+/g;

/**
 * Bidi embedding/override (U+202A-U+202E) and isolate (U+2066-U+2069) controls.
 * They can make a name render as a different string ("Ada\u202Egnp.exe").
 * Plain direction marks (LRM/RLM) are left alone: RTL text uses them legitimately.
 */
const BIDI_CONTROL_RE = /[\u202A-\u202E\u2066-\u2069]/g;

/** Truncate by code point so a surrogate pair is never split. */
function sliceCodePoints(text: string, max: number): string {
	const codePoints = Array.from(text);
	return codePoints.length <= max ? text : codePoints.slice(0, max).join("");
}

/**
 * Collapse a user-supplied value onto one line: line breaks and controls become a
 * space, bidi overrides are removed, whitespace runs collapse, ends are trimmed.
 * Apply to short fields (name, email) placed in plain-text bodies, so a value can
 * never add a line such as a forged "Status:" header.
 */
export function singleLine(value: string): string {
	return value.replace(LINE_BREAK_OR_CONTROL_RE, " ").replace(BIDI_CONTROL_RE, "").replace(/\s+/g, " ").trim();
}

/**
 * Sanitizes a string for use in an email header value.
 * Applies singleLine (header injection, spoofing controls) and truncates to
 * MAX_HEADER_CHARS code points.
 * Returns undefined for empty/falsy input so callers can omit the header entirely.
 * Apply to any user-supplied value that ends up in Subject, From name, etc.
 */
export function sanitizeHeaderValue(value: string | undefined): string | undefined {
	if (!value) return undefined;
	const cleaned = sliceCodePoints(singleLine(value), MAX_HEADER_CHARS).trim();
	return cleaned || undefined;
}

/**
 * Validates and sanitizes an email address for use in To / Reply-To / From headers.
 * Strips CR/LF (header injection defense), trims whitespace, then validates with
 * validator.js (RFC 5321 / RFC 5322 compliant).
 * Returns undefined for empty, malformed, or invalid addresses.
 */
export function parseEmailAddress(value: string | undefined): string | undefined {
	if (!value) return undefined;
	const trimmed = value.replace(LINE_BREAK_OR_CONTROL_RE, "").replace(BIDI_CONTROL_RE, "").trim();
	if (!trimmed) return undefined;
	// validator.isEmail handles RFC-compliant validation including quoted strings,
	// IP literals, and IDN.
	return isEmail(trimmed) ? trimmed : undefined;
}

/**
 * Truncates text to max code points, appending "…" if cut.
 * Code points, not UTF-16 units: a split surrogate pair serializes as a lone
 * "\ud83d" that strict JSON parsers (the email API) can reject.
 * Shared by all email builders.
 */
export function truncate(text: string, max: number): string {
	const cut = sliceCodePoints(text, max);
	return cut === text ? text : cut + "…";
}

/**
 * Strips Unicode C0/C1 control characters from user-supplied text.
 * Preserves \t, \n, \r which are meaningful in plain-text email.
 * Apply to message content before including in plain-text email bodies.
 */
export function sanitizeUserText(text: string): string {
	// eslint-disable-next-line no-control-regex
	return text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, "");
}

/**
 * Word-wraps text at `width` columns (default 72) for plain-text email clients.
 * Existing newlines are preserved; only lines exceeding `width` are wrapped at
 * word boundaries. Words longer than `width` are not broken.
 */
export function wrapText(text: string, width = 72): string {
	return text
		.split("\n")
		.map((line) => {
			if (line.length <= width) return line;
			const words = line.split(" ");
			const wrapped: string[] = [];
			let current = "";
			for (const word of words) {
				const next = current ? `${current} ${word}` : word;
				if (next.length > width && current) {
					wrapped.push(current);
					current = word;
				} else {
					current = next;
				}
			}
			if (current) wrapped.push(current);
			return wrapped.join("\n");
		})
		.join("\n");
}
