/**
 * Guestbook API utilities
 * Handles Astro DB integration for guestbook entries
 * with moderation classification, rate limiting, and hashing
 */
import { db, Guestbook, GuestbookModerationLog, desc, eq, gte, isNull, isNotNull, or, and } from "astro:db";
import { count } from "drizzle-orm";

export interface EntryStyle {
	bg: string;
	borderColor: string;
	borderWidth: string;
	borderStyle: string;
	borderRadius: string;
}

export type ModerationStatus = "visible" | "pending" | "hidden";

export interface GuestEntry {
	id: number;
	name: string;
	email: string | null;
	url: string | null;
	message: string;
	timestamp: Date;
	isSpam: boolean | null;
	style: string | null;
	/** Always one of ModerationStatus or null for legacy pre-moderation rows */
	status: ModerationStatus | null;
	moderationReason: string | null;
	moderationScore: number | null;
	ipHash: string | null;
	userAgentHash: string | null;
	messageHash: string | null;
	moderatedAt: Date | null;
	moderatedBy: string | null;
	/** Rule version active when entry was classified. 1-indexed, incremented on rule changes */
	moderationVersion: number | null;
	/** Serialized avatar state: "gender=male&avatar=3-54-12-14-15-21". Null when not opted in. */
	avatarState: string | null;
	/** True when the submitter opted to attach their avatar to this entry */
	avatarOptIn: boolean | null;
}

export interface ClassificationResult {
	status: ModerationStatus;
	reasons: string[];
	score: number;
	/** "hard" = at least one hard spam signal; "soft" = only soft flags; "none" = clean */
	severity: "hard" | "soft" | "none";
	/** Number of URLs detected in the message body */
	urlsFound: number;
	/** True if any URL was detected in the message body */
	hasLinks: boolean;
	/** True if this was classified as an honest 2nd-copy duplicate (rate limit exempted) */
	isHonestDuplicate: boolean;
	/** True if at least one hard spam reason is present (mirrors severity === "hard") */
	hasHardReason: boolean;
}

export interface CreateEntryInput {
	name: string;
	email: string;
	url: string;
	message: string;
	style?: string;
	/** Serialized avatar state string. Only stored when avatarOptIn is true. */
	avatarState?: string | null;
	/** Whether the submitter opted to attach their avatar */
	avatarOptIn?: boolean;
	ip?: string;
	userAgent?: string;
}

// ---------------------------------------------------------------------------
// Spam Detection Regexes
// ---------------------------------------------------------------------------

/** Any raw HTML tag */
const HTML_TAG_RE = /<[^>]+>/;

/** BBCode link syntax */
const BBCODE_RE = /\[url\s*=/i;

/** URL detector. Global flag, only used with .match() / .replace() to avoid lastIndex footguns */
const URL_RE_GLOBAL = /\b(?:https?:\/\/|www\.)[^\s<>()]+[^\s<>().,;:!?]/gi;

/** Common URL shorteners */
const SHORTENER_RE = /\b(bit\.ly|tinyurl\.com|t\.co|goo\.gl|is\.gd|rb\.gy|cutt\.ly|shorturl\.at)\b/i;

/** Obfuscated links (spacing/typo tricks) */
const OBFUSCATED_LINK_RE = /\b(hxxp|https?\s+:\s*\/\/|https?\s*:\s+\/\/|https?\s*:\s*\/\s+\/|www\s+\.)/i;

/** "dot com" style text obfuscation */
const DOT_COM_RE = /\b(dot|d0t)\s*(com|net|org|io)\b/i;

// ---------------------------------------------------------------------------
// Reason constants
// ---------------------------------------------------------------------------

/**
 * Hard spam reason names. Each alone is sufficient to auto-hide an entry.
 * Must stay in sync with the hard spam check section in classifyEntry.
 */
const HARD_REASON_NAMES: ReadonlySet<string> = new Set([
	"html_tag",
	"bbcode",
	"url_shortener",
	"obfuscated_link",
	"dot_com_obfuscation",
]);

/**
 * Reasons that are purely about the submitter's name/URL, not message content.
 * Entries flagged ONLY with these are ignored when counting duplicates since
 * the guest may be correcting a form-level mistake.
 */
const FORM_ONLY_REASONS: ReadonlySet<string> = new Set(["name_is_url", "suspicious_name"]);

/**
 * Exhaustive set of every valid reason string the classifier can produce.
 * Whenever this set changes, increment CURRENT_MODERATION_VERSION so old rows
 * can be identified and backfilled if needed.
 */
const ALL_REASON_NAMES: ReadonlySet<string> = new Set([
	// Hard signals. Each alone causes hidden
	"html_tag",
	"bbcode",
	"url_shortener",
	"obfuscated_link",
	"dot_com_obfuscation",
	// Link analysis
	"link_only",
	"multiple_urls",
	// Soft name/content flags
	"name_is_url",
	"suspicious_name",
	"long_with_links",
	// Rate / duplicate
	"duplicate",
	"rate_limited",
]);

/**
 * Schema version for the classification ruleset.
 * Bump this constant whenever scoring weights, thresholds, or reason names change
 * so rows classified under old rules can be identified in the DB.
 */
const CURRENT_MODERATION_VERSION = 1;

/**
 * Canonical moderatedBy actor values:
 * 	- Use these constants, never raw strings.
 * 	- Add entries here before using a new actor
 * 	- Use descriptive names, not "bot", "auto", etc.
 *
 *  system  - Automated retroactive correction/backfill (post-insert patch, retroFlagSameMsgEntries)
 *  admin   - Manual action via the admin UI (updateEntryStatus default)
 *  future: a stable user-ID string for multi-admin support
 */
const MODERATED_BY = {
	system: "system",
	admin: "admin",
} as const;

// ---------------------------------------------------------------------------
// Normalization helpers
// ---------------------------------------------------------------------------

/**
 * Canonical NFKC normalization for moderation pattern matching.
 * Collapses homoglyphs (ｈello → hello) and consecutive whitespace.
 */
function normalizeForModeration(s: string): string {
	return s.trim().normalize("NFKC").replace(/\s+/g, " ");
}

/**
 * Same as normalizeForModeration with a final trim() for use in hash inputs.
 * Using a distinct function prevents hash/classifier normalization from drifting.
 */
function normalizeForHash(s: string): string {
	return normalizeForModeration(s).trim();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Secret pepper used to pseudonymize visitor data.
// Unlike a salt, this is a shared secret stored outside the database.
function getPepper(): string {
	const pepper = import.meta.env.GUESTBOOK_HASH_PEPPER;

	if (!pepper) {
		if (!import.meta.env.PROD) return "guestbook-default-pepper";
		throw new Error("GUESTBOOK_HASH_PEPPER is required in production");
	}

	return pepper;
}

export async function hashValue(value: string): Promise<string> {
	const data = new TextEncoder().encode(value + getPepper());
	const buf = await crypto.subtle.digest("SHA-256", data);
	const hex = Array.from(new Uint8Array(buf))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
	if (import.meta.env.DEV && hex.length !== 64) {
		console.warn(
			`[guestbook] hashValue produced unexpected length ${hex.length} (expected 64). Check GUESTBOOK_HASH_PEPPER`
		);
	}
	return hex;
}

/**
 * Safe JSON parse for moderationReason columns.
 * Returns an empty array on null, non-array values, or parse errors.
 */
export function safeParseReasons(s: string | null): string[] {
	if (!s) return [];
	try {
		const v = JSON.parse(s);
		return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
	} catch {
		return [];
	}
}

const VALID_STATUSES = new Set<ModerationStatus>(["visible", "pending", "hidden"]);

/**
 * Runtime assertion that a string is a valid ModerationStatus.
 * Throws at write-time to prevent invalid values from reaching the DB.
 */
export function assertStatus(s: string): asserts s is ModerationStatus {
	if (!VALID_STATUSES.has(s as ModerationStatus)) {
		throw new Error(`[guestbook] Invalid status value: "${s}"`);
	}
}

/**
 * Validate that every reason string produced by the classifier is a known value.
 * Throws on unknown strings. This is a programming error, not user input.
 * Add new reasons to ALL_REASON_NAMES before using them in classifyEntry.
 */
function assertReasons(reasons: string[]): void {
	for (const r of reasons) {
		if (!ALL_REASON_NAMES.has(r)) {
			throw new Error(
				`[guestbook] Unknown moderation reason: "${r}". Add it to ALL_REASON_NAMES and bump CURRENT_MODERATION_VERSION.`
			);
		}
	}
}

function isFormOnlyFlagged(reasons: string[]): boolean {
	return reasons.length > 0 && reasons.every((r) => FORM_ONLY_REASONS.has(r));
}

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const RATE_LIMIT_MAX = 2;

/**
 * Count recent posts from an IP within the rate-limit window.
 * Exempts only honest 2nd-copy mistakes (["duplicate"] alone);
 * 3rd+ copies (["duplicate", "rate_limited"]) count against the limit.
 */
async function countRecentPostsByIp(ipHash: string, windowStart: Date): Promise<number> {
	const rows = await db
		.select({ moderationReason: Guestbook.moderationReason })
		.from(Guestbook)
		.where(and(eq(Guestbook.ipHash, ipHash), gte(Guestbook.timestamp, windowStart)));
	return rows.filter((r) => {
		const reasons = safeParseReasons(r.moderationReason);
		return !(reasons.includes("duplicate") && !reasons.includes("rate_limited"));
	}).length;
}

// ---------------------------------------------------------------------------
// Duplicate detection
// ---------------------------------------------------------------------------

const DUPLICATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

/**
 * Count how many times this exact message (by messageHash) has been submitted
 * from this IP within the duplicate window, excluding form-only flagged entries.
 * Uses SQL-level filtering on ipHash + messageHash + timestamp (no per-row hashing).
 */
async function countSameMessageFromIp(messageHash: string, ipHash: string, windowStart: Date): Promise<number> {
	const rows = await db
		.select({ moderationReason: Guestbook.moderationReason })
		.from(Guestbook)
		.where(
			and(eq(Guestbook.ipHash, ipHash), eq(Guestbook.messageHash, messageHash), gte(Guestbook.timestamp, windowStart))
		);
	let count = 0;
	for (const row of rows) {
		if (isFormOnlyFlagged(safeParseReasons(row.moderationReason))) continue;
		count++;
	}
	return count;
}

/**
 * When a 3rd+ copy of the same message is detected, retroactively add
 * "rate_limited" to all prior entries from this IP that have "duplicate"
 * but not yet "rate_limited". Uses the same window passed from classification
 * so behavior is deterministic regardless of when retroactive flagging runs.
 */
async function retroFlagSameMsgEntries(
	ipHash: string,
	messageHash: string,
	windowStart: Date,
	now: Date = new Date()
): Promise<void> {
	const rows = await db
		.select({
			id: Guestbook.id,
			moderationReason: Guestbook.moderationReason,
			moderationScore: Guestbook.moderationScore,
		})
		.from(Guestbook)
		.where(
			and(eq(Guestbook.ipHash, ipHash), eq(Guestbook.messageHash, messageHash), gte(Guestbook.timestamp, windowStart))
		);

	for (const row of rows) {
		const reasons = safeParseReasons(row.moderationReason);
		if (!reasons.includes("duplicate") || reasons.includes("rate_limited")) continue;

		reasons.push("rate_limited");
		const newScore = Math.min((row.moderationScore ?? 0) + 4, 10);
		const newStatus: ModerationStatus = newScore >= 10 ? "hidden" : "pending";

		await db
			.update(Guestbook)
			.set({
				moderationReason: JSON.stringify(Array.from(new Set(reasons)).sort()),
				moderationScore: newScore,
				status: newStatus,
				isSpam: newStatus === "hidden",
				moderationVersion: CURRENT_MODERATION_VERSION,
				moderatedAt: now,
				moderatedBy: MODERATED_BY.system,
			})
			.where(eq(Guestbook.id, row.id));
	}
}

// ---------------------------------------------------------------------------
// Classification engine
// ---------------------------------------------------------------------------

/**
 * Classify a guestbook entry into visible / pending / hidden.
 *
 * Scoring:
 *  - Hard spam signals → hidden (score >= 10, clamped to 10 for readability)
 *  - Soft flags → pending (score >= 3)
 *  - Clean → visible (score < 3)
 *
 * `now` is accepted explicitly so classification is deterministic and testable.
 * `messageHash` should be pre-computed by the caller, if absent, skip duplicate check.
 *
 * Check order:
 *  1. Hard spam (html/bbcode/shortener/obfuscated/dot-com)
 *  2. URL pattern analysis (link_only, multiple_urls)
 *  3. Soft name/content flags
 *  4. Duplicate detection  ← before rate limit so 2nd-copy duplicates are exempt
 *  5. Rate limiting        ← skipped entirely for honest 2nd-copy duplicates
 *  6. link_only mitigation ← prevent soft-only stacking into auto-hide
 *  7. Clamp, canonicalize, compute severity
 */
export async function classifyEntry(input: {
	name: string;
	url: string;
	message: string;
	ipHash: string | null;
	userAgentHash: string | null;
	messageHash?: string | null;
	now?: Date;
}): Promise<ClassificationResult> {
	const now = input.now ?? new Date();
	const reasons: string[] = [];
	let score = 0;

	if (!input.messageHash) {
		console.warn("[guestbook] classifyEntry called without messageHash. Duplicate detection skipped");
	}

	// normalizeForModeration: NFKC + whitespace collapse. Same function used by createGuestEntry.
	// classifyEntry owns this normalization, callers pass the raw (trimmed) message.
	const msg = normalizeForModeration(input.message || "");
	const name = normalizeForModeration(input.name || "");

	// --- Hard spam checks (each alone is score >= 10 → hidden) ---

	if (HTML_TAG_RE.test(msg)) {
		reasons.push("html_tag");
		score += 10;
	}
	if (BBCODE_RE.test(msg)) {
		reasons.push("bbcode");
		score += 10;
	}
	if (SHORTENER_RE.test(msg)) {
		reasons.push("url_shortener");
		score += 10;
	}
	if (OBFUSCATED_LINK_RE.test(msg)) {
		reasons.push("obfuscated_link");
		score += 10;
	}
	if (DOT_COM_RE.test(msg)) {
		reasons.push("dot_com_obfuscation");
		score += 10;
	}

	// URL analysis .match() on a global regex always resets lastIndex safely
	const urls = msg.match(URL_RE_GLOBAL) ?? [];

	// Link-only: URL present but < 20 chars of surrounding text.
	// Score 8 (pending) rather than 10, gives admin a chance to review legit one-link posts.
	// Strip common URL wrapper punctuation (parens, brackets, quotes) from the non-URL remnant
	// so that "(https://example.com)" doesn't inflate the surrounding-text count.
	if (urls.length > 0) {
		const nonUrlText = msg
			.replace(URL_RE_GLOBAL, "")
			.replace(/[()[\]{}<>'".,;:!?]/g, "")
			.trim();
		if (nonUrlText.length < 20) {
			reasons.push("link_only");
			score += 8;
		}
	}

	// 2+ URLs. Weight by message length and whether the submitter filled in the URL field.
	// If they declared their site via the dedicated URL input, multiple links in the message
	// are likely intentional (own site + something else) rather than spam.
	const hasOwnUrl = /^(https?:\/\/|www\.)/i.test((input.url || "").trim());
	if (urls.length >= 2) {
		reasons.push("multiple_urls");
		score += !hasOwnUrl && msg.length < 200 ? 5 : 2;
	}

	// --- Soft flags (push toward pending) ---

	// Name looks like a URL:
	// 	- starts with protocol/www, OR
	// 	- has no spaces,
	// 	- is longer than 6 chars, and
	// 	- ends with a recognized TLD
	const looksLikeUrl =
		/^(https?:\/\/|www\.)/.test(name) ||
		(name.length > 6 &&
			!name.includes(" ") &&
			/\.(com|net|org|io|co|dev|app|xyz|me|info|biz|online|site|tech|pro)\b/i.test(name));
	if (looksLikeUrl) {
		reasons.push("name_is_url");
		score += 5;
	}

	// Name has excessive symbols (> 50% non-alphanumeric).
	// Strips spaces and common name punctuation (-_'.) first to avoid
	// false-positives on hyphenated names or names with apostrophes.
	const nameStripped = name.replace(/[\s\-_'.]/g, "");
	if (nameStripped.length > 0) {
		const symbolCount = nameStripped.replace(/[a-zA-Z0-9]/g, "").length;
		if (symbolCount / nameStripped.length > 0.5) {
			reasons.push("suspicious_name");
			score += 3;
		}
	}

	// Very long message with links
	if (msg.length > 2000 && urls.length >= 1) {
		reasons.push("long_with_links");
		score += 3;
	}

	// --- Duplicate detection (before rate limit so 2nd-copy can be exempted) ---

	// - 2nd copy: honest mistake → "duplicate" only, rate limit skipped
	// - 3rd+ copy: intentional → "duplicate" + "rate_limited", pushed to hidden
	let isHonestDuplicate = false;
	if (input.ipHash && input.messageHash) {
		const windowStart = new Date(now.getTime() - DUPLICATE_WINDOW_MS);
		const dupeCount = await countSameMessageFromIp(input.messageHash, input.ipHash, windowStart);
		if (dupeCount === 1) {
			reasons.push("duplicate");
			score += 5;
			isHonestDuplicate = true; // 2nd copy: exempt from rate limit below
		} else if (dupeCount >= 2) {
			reasons.push("duplicate");
			reasons.push("rate_limited");
			score += 10;
		}
	}

	// --- Rate limiting (skipped for honest 2nd-copy duplicates) ---

	if (input.ipHash && !isHonestDuplicate) {
		const windowStart = new Date(now.getTime() - RATE_LIMIT_WINDOW_MS);
		const recentCount = await countRecentPostsByIp(input.ipHash, windowStart);
		if (recentCount >= RATE_LIMIT_MAX) {
			reasons.push("rate_limited");
			score += 4;
		}
	}

	// --- link_only mitigation ---
	// Prevent soft-signal stacking from auto-hiding a post that has no hard spam patterns.
	// Without this, link_only (8) + multiple_urls short (5) = 13 → hidden, which is too aggressive.
	const hasHardReason = reasons.some((r) => HARD_REASON_NAMES.has(r));
	if (!hasHardReason && reasons.includes("link_only") && score >= 10) {
		score = 9; // keep as pending; admin reviews rather than auto-hiding
	}

	// --- Finalize ---

	// Clamp score to 10 for consistent display (multiple hard signals can stack, 10 is the threshold)
	score = Math.min(score, 10);

	// Determine status
	let status: ModerationStatus;
	if (score >= 10) {
		status = "hidden";
	} else if (score >= 3) {
		status = "pending";
	} else {
		status = "visible";
	}

	// Deduplicate and sort reasons for stable storage and display
	const canonicalReasons = Array.from(new Set(reasons)).sort();

	// Programming-error guard: every emitted reason must be in ALL_REASON_NAMES.
	// If this throws, add the new reason there and bump CURRENT_MODERATION_VERSION.
	assertReasons(canonicalReasons);

	// Derive severity for UI without re-parsing reasons downstream
	const severity: "hard" | "soft" | "none" = hasHardReason ? "hard" : canonicalReasons.length > 0 ? "soft" : "none";

	return {
		status,
		reasons: canonicalReasons,
		score,
		severity,
		urlsFound: urls.length,
		hasLinks: urls.length > 0,
		isHonestDuplicate,
		hasHardReason,
	};
}

// ---------------------------------------------------------------------------
// Data access
// ---------------------------------------------------------------------------

/**
 * Fetch all visible guestbook entries, newest first.
 * Double-guards on isSpam so a status/isSpam inconsistency from a bug never
 * leaks a hidden entry to the public page.
 */
export async function getGuestEntries(): Promise<GuestEntry[]> {
	const rows = await db
		.select()
		.from(Guestbook)
		.where(and(eq(Guestbook.status, "visible"), or(eq(Guestbook.isSpam, false), isNull(Guestbook.isSpam))))
		.orderBy(desc(Guestbook.timestamp));
	return rows as unknown as GuestEntry[];
}

/**
 * Fetch entries for admin review. Returns pending, hidden, and moderated-visible entries.
 */
export async function getModeratedEntries(filter: "pending" | "hidden" | "all" = "all"): Promise<GuestEntry[]> {
	if (filter === "pending") {
		const rows = await db
			.select()
			.from(Guestbook)
			.where(eq(Guestbook.status, "pending"))
			.orderBy(desc(Guestbook.timestamp));
		return rows as unknown as GuestEntry[];
	}

	if (filter === "hidden") {
		const rows = await db
			.select()
			.from(Guestbook)
			.where(eq(Guestbook.status, "hidden"))
			.orderBy(desc(Guestbook.timestamp));
		return rows as unknown as GuestEntry[];
	}

	// "all". pending + hidden + visible entries that carry a moderationReason (admin-reviewed)
	const rows = await db
		.select()
		.from(Guestbook)
		.where(
			or(
				eq(Guestbook.status, "pending"),
				eq(Guestbook.status, "hidden"),
				and(eq(Guestbook.status, "visible"), isNotNull(Guestbook.moderationReason))
			)
		)
		.orderBy(desc(Guestbook.timestamp));
	return rows as unknown as GuestEntry[];
}

/**
 * Count entries currently awaiting review.
 */
export async function countPendingEntries(): Promise<number> {
	const result = await db.select({ value: count() }).from(Guestbook).where(eq(Guestbook.status, "pending"));
	return result[0]?.value ?? 0;
}

/**
 * Update entry moderation status (admin action).
 *
 * Writes a row to GuestbookModerationLog before clearing any flags so the
 * original classifier output is always preserved for audit / analytics, even
 * when action === "approve_clear" nulls the Guestbook columns.
 *
 * Options:
 *  - `clearFlags`
 * 			- when true, also nulls out moderationReason and moderationScore.
 *    	- Use when approving a legitimately flagged entry to remove the "scarlet letter".
 *    	- Default keeps flags for audit trail.
 *  - `moderatedBy`
 * 			- identity of the actor. Defaults to "admin" for manual admin actions
 * 			- can be set to "system" for automated retroactive corrections
 * 			- can be set to a future stable user-ID for multi-admin support
 */
export async function updateEntryStatus(
	id: number,
	status: ModerationStatus,
	options?: { clearFlags?: boolean; moderatedBy?: string }
): Promise<void> {
	assertStatus(status);
	const actor = options?.moderatedBy ?? MODERATED_BY.admin;
	const clearFlags = options?.clearFlags ?? false;
	const at = new Date();

	// Derive a human-readable action label for the log.
	const action = status === "hidden" ? "hide" : clearFlags ? "approve_clear" : "approve";

	// Read current state before mutating. The log row needs the pre-action values.
	const [current] = await db.select().from(Guestbook).where(eq(Guestbook.id, id)).limit(1);

	// Apply the status change (and optionally clear flags) to the Guestbook row.
	await db
		.update(Guestbook)
		.set({
			status,
			isSpam: status === "hidden",
			moderatedAt: at,
			moderatedBy: actor,
			...(clearFlags ? { moderationReason: null, moderationScore: null } : {}),
		})
		.where(eq(Guestbook.id, id));

	// Append an immutable audit row. Written after the update so a failed log
	// insert never blocks the status change (best-effort audit).
	await db.insert(GuestbookModerationLog).values({
		entryId: id,
		action,
		fromStatus: current?.status ?? null,
		toStatus: status,
		reasonsBefore: current?.moderationReason ?? null,
		scoreBefore: current?.moderationScore ?? null,
		// After "approve_clear" the flags are gone from Guestbook; log preserves them above.
		// For "approve" / "hide" the flags are unchanged, so after === before.
		reasonsAfter: clearFlags ? null : (current?.moderationReason ?? null),
		scoreAfter: clearFlags ? null : (current?.moderationScore ?? null),
		actor,
		at,
	});
}

/**
 * Return moderation history, newest first.
 * Pass an entryId to scope to a single entry. Omit for the full audit log.
 */
export async function getModerationLog(entryId?: number) {
	if (entryId !== undefined) {
		return db
			.select()
			.from(GuestbookModerationLog)
			.where(eq(GuestbookModerationLog.entryId, entryId))
			.orderBy(desc(GuestbookModerationLog.at));
	}
	return db.select().from(GuestbookModerationLog).orderBy(desc(GuestbookModerationLog.at));
}

/**
 * Insert a new guestbook entry with moderation classification.
 * Returns the classification result for use by the notification system.
 */
export async function createGuestEntry(
	entry: CreateEntryInput
): Promise<{ classification: ClassificationResult; entryId: number; submittedAt: Date }> {
	// Anchor "now" once so all time windows in this request are consistent.
	const now = new Date();

	const ipHash = entry.ip ? await hashValue(entry.ip) : null;
	const userAgentHash = entry.userAgent ? await hashValue(entry.userAgent) : null;
	const trimmedMessage = entry.message.trim();
	// Hash the normalized form so homoglyph/whitespace bypass attempts map to the same hash.
	// classifyEntry receives the raw trimmedMessage and does its own normalizeForModeration internally.
	const messageHash = await hashValue(normalizeForHash(trimmedMessage));
	if (!messageHash) throw new Error("[guestbook] messageHash computation failed. Cannot create entry");

	const classification = await classifyEntry({
		name: entry.name,
		url: entry.url,
		message: trimmedMessage, // raw. classifyEntry normalizes internally
		ipHash,
		userAgentHash,
		messageHash,
		now,
	});

	assertStatus(classification.status);

	// Mutable so the post-insert correction can keep it in sync with what was stored.
	let finalClassification = classification;

	if (classification.status !== "visible") {
		// Omit message content from production logs to avoid leaking PII.
		const msgSnippet = import.meta.env.DEV ? ` message=${trimmedMessage.slice(0, 100)}` : "";
		console.warn(
			`[guestbook] Entry flagged as "${classification.status}" (${classification.severity}) for "${entry.name}": ` +
				`reasons=[${classification.reasons.join(", ")}] score=${classification.score}${msgSnippet}`
		);
	}

	const result = await db.insert(Guestbook).values({
		name: entry.name.trim().replace(/\s+/g, " "),
		email: entry.email.trim() || null,
		url: entry.url.trim() || null,
		message: trimmedMessage,
		messageHash,
		isSpam: classification.status === "hidden",
		style: entry.style || null,
		avatarState: entry.avatarOptIn ? entry.avatarState || null : null,
		avatarOptIn: entry.avatarOptIn ?? false,
		status: classification.status,
		moderationReason: classification.reasons.length > 0 ? JSON.stringify(classification.reasons) : null,
		moderationScore: classification.score,
		ipHash,
		userAgentHash,
		moderationVersion: CURRENT_MODERATION_VERSION,
	});

	const entryId = Number(result.lastInsertRowid);

	// Single timestamp for all system-initiated moderation writes in this request
	// so retro-flag updates and post-insert corrections share a consistent moderatedAt.
	const systemNow = new Date();

	// Non-race 3rd+ path: classifier already set both "duplicate" and "rate_limited"
	// (pre-insert dupeCount was >= 2). Escalate prior duplicate-only entries now.
	// This path and the post-insert correction below are mutually exclusive:
	// the correction only runs when "rate_limited" is absent from classification.reasons.
	if (ipHash && classification.reasons.includes("duplicate") && classification.reasons.includes("rate_limited")) {
		const dupeWindowStart = new Date(now.getTime() - DUPLICATE_WINDOW_MS);
		await retroFlagSameMsgEntries(ipHash, messageHash, dupeWindowStart, systemNow);
	}

	// Post-insert race-condition correction.
	// Covers two scenarios where the pre-insert classification may be under-flagged:
	//   (A) no "duplicate" at all → concurrent submit beat us and is missed entirely
	//   (B) "duplicate" but no "rate_limited" → was honest 2nd copy, but DB now shows 3rd+
	//
	// Score increments mirror classifyEntry/retroFlagSameMsgEntries:
	//   2nd copy → +5  (same as classifyEntry dupeCount === 1)
	//   3rd+ no dupe → +10 (same as classifyEntry dupeCount >= 2)
	//   3rd+ has dupe → +4  (same as retroFlagSameMsgEntries delta)
	//
	// actualDupeCount includes the just-inserted row, so >= 2 = at least one prior copy.
	if (ipHash && !classification.reasons.includes("rate_limited")) {
		const dupeWindowStart = new Date(now.getTime() - DUPLICATE_WINDOW_MS);
		const actualDupeCount = await countSameMessageFromIp(messageHash, ipHash, dupeWindowStart);

		const alreadyHasDuplicate = classification.reasons.includes("duplicate");
		let addReasons: string[] = [];
		let scoreIncrement = 0;

		if (!alreadyHasDuplicate) {
			// (A) Missed entirely
			if (actualDupeCount >= 3) {
				addReasons = ["duplicate", "rate_limited"];
				scoreIncrement = 10;
			} else if (actualDupeCount >= 2) {
				addReasons = ["duplicate"];
				scoreIncrement = 5;
			}
		} else if (actualDupeCount >= 3) {
			// (B) Honest 2nd copy should now be 3rd+
			addReasons = ["rate_limited"];
			scoreIncrement = 4;
		}

		if (addReasons.length > 0) {
			const correctedReasons = Array.from(new Set([...classification.reasons, ...addReasons])).sort();
			assertReasons(correctedReasons);
			const correctedScore = Math.min(classification.score + scoreIncrement, 10);
			const correctedStatus: ModerationStatus =
				correctedScore >= 10 ? "hidden" : correctedScore >= 3 ? "pending" : "visible";
			const correctedSeverity: "hard" | "soft" | "none" = classification.hasHardReason
				? "hard"
				: correctedReasons.length > 0
					? "soft"
					: "none";

			await db
				.update(Guestbook)
				.set({
					moderationReason: correctedReasons.length > 0 ? JSON.stringify(correctedReasons) : null,
					moderationScore: correctedScore,
					status: correctedStatus,
					isSpam: correctedStatus === "hidden",
					moderationVersion: CURRENT_MODERATION_VERSION,
					moderatedAt: systemNow,
					moderatedBy: MODERATED_BY.system,
				})
				.where(eq(Guestbook.id, entryId));

			// Keep the returned value in sync with what was actually stored in the DB.
			// Callers that act on classification (e.g. send notifications) see the final state.
			finalClassification = {
				...classification,
				status: correctedStatus,
				reasons: correctedReasons,
				score: correctedScore,
				severity: correctedSeverity,
				// isHonestDuplicate: strictly 2nd copy. Duplicate present, no rate_limited, exactly 2 in DB
				isHonestDuplicate:
					correctedReasons.includes("duplicate") && !correctedReasons.includes("rate_limited") && actualDupeCount === 2,
				hasHardReason: classification.hasHardReason,
				// Message content unchanged. Carry through rather than re-compute
				urlsFound: classification.urlsFound,
				hasLinks: classification.hasLinks,
			};

			// Escalate any prior duplicate-only rows when we now know this is 3rd+.
			// Safe to call unconditionally: the outer guard (!classification.reasons.includes("rate_limited"))
			// ensures the non-race path above did not already run retroFlagSameMsgEntries.
			if (correctedReasons.includes("rate_limited")) {
				await retroFlagSameMsgEntries(ipHash, messageHash, dupeWindowStart, systemNow);
			}
		}
	}

	return { classification: finalClassification, entryId, submittedAt: now };
}

// ---------------------------------------------------------------------------
// Notification idempotency helpers
// ---------------------------------------------------------------------------

/**
 * Returns the current notification timestamps for an entry.
 * Used to gate email sends on route retry / double-submit.
 */
export async function getNotificationFlags(
	entryId: number
): Promise<{ adminNotifiedAt: Date | null; copySentAt: Date | null }> {
	const row = await db
		.select({ adminNotifiedAt: Guestbook.adminNotifiedAt, copySentAt: Guestbook.copySentAt })
		.from(Guestbook)
		.where(eq(Guestbook.id, entryId))
		.get();
	return { adminNotifiedAt: row?.adminNotifiedAt ?? null, copySentAt: row?.copySentAt ?? null };
}

/** Mark admin notification as sent. */
export async function markAdminNotified(entryId: number): Promise<void> {
	await db.update(Guestbook).set({ adminNotifiedAt: new Date() }).where(eq(Guestbook.id, entryId));
}

/** Mark entry copy email as sent. */
export async function markCopySent(entryId: number): Promise<void> {
	await db.update(Guestbook).set({ copySentAt: new Date() }).where(eq(Guestbook.id, entryId));
}
