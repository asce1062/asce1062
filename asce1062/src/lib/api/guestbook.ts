/**
 * Guestbook API utilities
 * Handles Astro DB integration for guestbook entries
 */
import { db, Guestbook, desc, eq, isNull, or } from "astro:db";

export interface EntryStyle {
	bg: string;
	borderColor: string;
	borderWidth: string;
	borderStyle: string;
	borderRadius: string;
}

export interface GuestEntry {
	id: number;
	name: string;
	email: string | null;
	url: string | null;
	message: string;
	timestamp: Date;
	isSpam: boolean | null;
	style: string | null;
}

// Basic Spam Detection

/**
 * Any raw HTML tag
 * Real guestbook entries don't need HTML
 */
const HTML_TAG_RE = /<[^>]+>/;

/**
 * BBCode link syntax
 * Catches [url=...] or [url]...[/url]
 */
const BBCODE_RE = /\[url\s*=/i;

/**
 * URL detector
 * Catches http://, https://, and www.
 * Avoids trailing punctuation
 */
const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>()]+[^\s<>().,;:!?]/gi;

/**
 * Common URL shorteners
 * Suspicious for guestbook entries
 */
const SHORTENER_RE = /\b(bit\.ly|tinyurl\.com|t\.co|goo\.gl|is\.gd|rb\.gy|cutt\.ly|shorturl\.at)\b/i;

/**
 * Obfuscated links
 * Requires actual spacing/splitting to avoid matching normal URLs
 */
const OBFUSCATED_LINK_RE = /\b(hxxp|https?\s+:\s*\/\/|https?\s*:\s+\/\/|https?\s*:\s*\/\s*\/|www\s+\.)/i;

/**
 * "dot com" style obfuscation
 * "example dot com"
 */
const DOT_COM_RE = /\b(dot|d0t)\s*(com|net|org|io)\b/i;

/**
 * Check if a message looks like spam.
 *
 * Rules (order: fast checks first, heuristics last):
 * 1. Any raw HTML tags
 * 2. BBCode link syntax
 * 3. URL shorteners (always blocked)
 * 4. Obfuscated links (hxxp://, spaced protocols)
 * 5. "dot com" obfuscation
 * 6. Link-only posts (single URL with < 20 chars of real text)
 */
function isSpamMessage(message: string): boolean {
	if (typeof message !== "string") return true;
	const trimmed = message.trim();
	if (!trimmed) return true;

	// Instant reject
	// No legitimate guest uses HTML or BBCode
	if (HTML_TAG_RE.test(trimmed)) return true;
	if (BBCODE_RE.test(trimmed)) return true;

	// Shorteners and obfuscation
	// Always suspicious
	if (SHORTENER_RE.test(trimmed)) return true;
	if (OBFUSCATED_LINK_RE.test(trimmed)) return true;
	if (DOT_COM_RE.test(trimmed)) return true;

	// Link-only posts
	// Any URLs present but barely any real text around them
	const urls = trimmed.match(URL_RE) ?? [];
	if (urls.length > 0) {
		const nonUrlText = trimmed.replace(URL_RE, "").trim();
		if (nonUrlText.length < 20) return true;
	}

	return false;
}

/**
 * Fetch all visible (non-spam) guestbook entries, newest first
 */
export async function getGuestEntries(): Promise<GuestEntry[]> {
	return db
		.select()
		.from(Guestbook)
		.where(or(eq(Guestbook.isSpam, false), isNull(Guestbook.isSpam)))
		.orderBy(desc(Guestbook.timestamp));
}

/**
 * Insert a new guestbook entry with automatic spam detection
 */
export async function createGuestEntry(entry: {
	name: string;
	email: string;
	url: string;
	message: string;
	style?: string;
}) {
	const spam = isSpamMessage(entry.message);

	if (spam) {
		console.warn(`[guestbook] Spam detected for "${entry.name}": ${entry.message.slice(0, 100)}`);
	}

	await db.insert(Guestbook).values({
		name: entry.name.trim(),
		email: entry.email.trim() || null,
		url: entry.url.trim() || null,
		message: entry.message,
		isSpam: spam,
		style: entry.style || null,
	});
}

/**
 * Format date for guestbook entry display
 */
export function formatEntryDate(date: Date): string {
	return date.toLocaleDateString("en-us", {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}
