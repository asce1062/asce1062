/**
 * Guestbook email notifications via Resend API.
 *
 * Public API:
 *  - notifyNewEntry()  Admin notification on every new submission (best-effort)
 *  - sendEntryCopy()   Optional copy sent to the guest when they opt in
 *
 * Both functions return a typed result. They never throw.
 * Callers decide whether to fail the submission or continue on error.
 *
 * Required env vars:
 *  - RESEND_API_KEY
 *  - GUESTBOOK_FROM_EMAIL   verified sender with display name,
 *                           e.g. "Guestbook <guestbook@alexmbugua.me>"
 *
 * Optional env vars:
 *  - GUESTBOOK_NOTIFY_TO       admin recipient (defaults to SOCIAL.email)
 *  - GUESTBOOK_REPLY_TO        dedicated reply-to alias for copy emails,
 *                              e.g. "ping@alexmbugua.me". Falls back to GUESTBOOK_NOTIFY_TO.
 *  - GUESTBOOK_EMAIL_TIMEOUT_MS  per-attempt timeout in ms, body read included (default 4000)
 *  - GUESTBOOK_EMAIL_RETRIES     max retry count for 429/5xx/network errors (default 2, max 5)
 *  - GUESTBOOK_EMAIL_DEADLINE_MS total budget for all attempts and backoff (default 6000, max 8000)
 *
 * Idempotency:
 * 	- The Resend Idempotency-Key deduplicates retried sends.
 * 	- Callers record delivery (adminNotifiedAt / copySentAt) after a successful send.
 *  - Idempotency keys are stable across retries and include the submission timestamp
 *    to prevent reuse if the DB is reset and entry IDs are recycled.
 *
 * Entry copy policy:
 *  - Copies go only to entries that are visible. The recipient address is never
 *    verified, so mailing an entry the classifier held would let anyone send that
 *    content from this domain to any inbox. Held entries get their copy when an
 *    admin approves them (guestbook-copy.ts).
 *  - Always validate the recipient address before sending.
 *
 * In guestbook.ts see:
 * 	- markAdminNotified
 * 	- claimUnsentCopy / releaseCopyClaim (via guestbook-copy.ts)
 */
import type { ClassificationResult, ModerationStatus } from "./guestbook";
import { SOCIAL } from "@/config/site-config";
import { parseEmailAddress, sanitizeHeaderValue } from "@/config/email-config";
import { renderNotifyEmail } from "@/lib/email/builders/notify-template";
import { renderEntryCopyEmail } from "@/lib/email/builders/entry-copy-template";

const RESEND_API = "https://api.resend.com/emails";
const RETRY_BASE_DELAY_MS = 500;

/**
 * Transient network error codes worth retrying. Node's fetch (undici) rejects
 * with TypeError("fetch failed") and puts these on err.cause.code, not in
 * err.message.
 */
const TRANSIENT_ERROR_PATTERN = /ECONNRESET|ETIMEDOUT|ENOTFOUND|ECONNREFUSED|EAI_AGAIN|UND_ERR_/i;

/**
 * Total time all attempts may take, backoff included. The guestbook POST awaits
 * delivery before redirecting, so this must fit inside the serverless function
 * limit (10s by default on Netlify) together with the database work.
 */
const DEFAULT_SEND_DEADLINE_MS = 6_000;
const MAX_SEND_DEADLINE_MS = 8_000;
/** Do not start an attempt with less time than this left in the budget. */
const MIN_ATTEMPT_MS = 500;

export type EmailResult =
	{ ok: true; rid?: string } | { ok: false; reason: string; status?: number; code?: string; rid?: string };

export interface NotifyInput {
	name: string;
	email: string;
	url: string | null;
	message: string;
	style?: string | null;
	avatarState?: string | null;
	classification: ClassificationResult;
	entryId: number;
	theme: "light" | "dark";
	submittedAt: Date;
}

export interface EntryCopyInput {
	name: string;
	/** Guest's email address. Validated internally before sending */
	email: string;
	message: string;
	style?: string | null;
	avatarState?: string | null;
	/** Current moderation status. Only visible entries are copied. */
	status: ModerationStatus;
	entryId: number;
	theme: "light" | "dark";
	/** When the entry was submitted. Used in the idempotency key. */
	submittedAt: Date;
}

type EmailKind = "admin_notify" | "entry_copy";

interface SendEmailPayload {
	kind: EmailKind;
	/** Entry ID. Used in log labels for correlation. Never sent to the API. */
	entryId: number;
	/** Stable idempotency key for this logical send. Passed as HTTP request header
	 *  so Resend deduplicates if our DB write fails after a successful send. */
	idempotencyKey: string;
	from: string;
	to: string[];
	reply_to?: string;
	subject: string;
	html: string;
	text: string;
	headers?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/**
 * Extract a useful request ID from a Resend response for log correlation.
 * Checks headers in order of specificity.
 * @returns undefined if none found.
 */
function extractRequestId(res: Response): string | undefined {
	return res.headers.get("x-resend-id") ?? res.headers.get("x-request-id") ?? res.headers.get("cf-ray") ?? undefined;
}

/**
 * Safely parse a short error code from a Resend error response body.
 * Never logs subject, body, or recipient data.
 */
async function safeErrorCode(res: Response): Promise<string> {
	try {
		const body = await res.json();
		if (typeof body?.code === "string") return body.code.slice(0, 40);
		if (typeof body?.error === "string") return body.error.slice(0, 40);
		if (typeof body?.message === "string") return body.message.slice(0, 40);
	} catch {
		// not JSON. This is fine.
	}
	return `http_${res.status}`;
}

/**
 * Read a numeric tuning env var. Unset, empty or non-numeric values give the
 * fallback; "0" is a real value (`Number(x) || fallback` would discard it).
 */
function envNumber(value: unknown, fallback: number): number {
	if (typeof value !== "string" || value.trim() === "") return fallback;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : fallback;
}

/** Message plus, for undici errors, the cause's code and message. */
function describeFetchError(err: unknown): string {
	if (!(err instanceof Error)) return String(err);
	const cause = err.cause as { code?: unknown; message?: unknown } | undefined;
	const causeCode = typeof cause?.code === "string" ? cause.code : "";
	const causeMessage = typeof cause?.message === "string" ? cause.message : "";
	return [err.message, causeCode, causeMessage].filter(Boolean).join(" ").slice(0, 200);
}

/**
 * Returns true for errors that are likely transient and worth retrying:
 * our own AbortError (timeout), undici's generic "fetch failed" network error,
 * and common TCP/DNS failure codes (on the error or its cause).
 * Everything else (invalid URL, policy blocks, etc.) is treated as permanent.
 */
function isTransientError(err: unknown): boolean {
	if (err instanceof Error && err.name === "AbortError") return true;
	if (err instanceof TypeError && err.message === "fetch failed") return true;
	return TRANSIENT_ERROR_PATTERN.test(describeFetchError(err));
}

// ---------------------------------------------------------------------------
// Core sender: timeout + retry + jitter
// ---------------------------------------------------------------------------

/**
 * Send a single email via Resend with timeout, exponential backoff + jitter, and retries.
 *
 * Retry policy:
 *  - HTTP 429 / 5xx → retry up to maxRetries
 *  - AbortError (timeout) or transient network error → retry up to maxRetries
 *  - Other fetch errors (invalid URL, policy block) → break immediately (won't recover)
 *  - HTTP 4xx except 429 → break immediately (bad payload, won't recover)
 *
 * Always returns a result. Never throws.
 */
async function sendEmail(payload: SendEmailPayload): Promise<EmailResult> {
	const apiKey = import.meta.env.RESEND_API_KEY;
	const tag = `[guestbook-notify:${payload.kind}:${payload.entryId}]`;
	if (!apiKey) {
		console.warn(`${tag} Missing RESEND_API_KEY. Skipping`);
		return { ok: false, reason: "missing_api_key" };
	}

	// Read tuning config at call time so it can be adjusted without code changes
	const deadlineMs = Math.min(
		MAX_SEND_DEADLINE_MS,
		Math.max(1_000, envNumber(import.meta.env.GUESTBOOK_EMAIL_DEADLINE_MS, DEFAULT_SEND_DEADLINE_MS))
	);
	const fetchTimeoutMs = Math.min(
		deadlineMs,
		Math.max(1_000, envNumber(import.meta.env.GUESTBOOK_EMAIL_TIMEOUT_MS, 4_000))
	);
	const maxRetries = Math.min(5, Math.max(0, Math.floor(envNumber(import.meta.env.GUESTBOOK_EMAIL_RETRIES, 2))));
	const deadline = Date.now() + deadlineMs;

	// Build the Resend payload, omitting internal fields and undefined optional fields
	const { kind: _kind, entryId: _entryId, idempotencyKey, reply_to, headers, ...base } = payload;
	const resendPayload = {
		...base,
		...(reply_to !== undefined ? { reply_to } : {}),
		...(headers !== undefined ? { headers } : {}),
	};

	let lastReason = "unknown";
	let lastStatus: number | undefined;
	let lastCode: string | undefined;
	let lastRid: string | undefined;

	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		if (attempt > 0) {
			// Exponential backoff with ±30% jitter to spread retries under rate-limit
			const jitter = 0.7 + Math.random() * 0.6;
			const backoffMs = RETRY_BASE_DELAY_MS * 2 ** (attempt - 1) * jitter;
			if (deadline - Date.now() - backoffMs < MIN_ATTEMPT_MS) break; // budget spent
			await new Promise((r) => setTimeout(r, backoffMs));
		}

		const remainingMs = deadline - Date.now();
		if (remainingMs < MIN_ATTEMPT_MS) break;

		// One timer covers the request AND reading the response body: an error
		// body that stalls would otherwise hang the guestbook POST indefinitely.
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), Math.min(fetchTimeoutMs, remainingMs));
		try {
			let res: Response;
			try {
				res = await fetch(RESEND_API, {
					method: "POST",
					headers: {
						Authorization: `Bearer ${apiKey}`,
						"Content-Type": "application/json",
						Accept: "application/json",
						// Stable across retries. Resend deduplicates if our DB write fails after success
						"Idempotency-Key": idempotencyKey,
					},
					body: JSON.stringify(resendPayload),
					signal: controller.signal,
				});
			} catch (err) {
				lastReason = describeFetchError(err);
				const transient = isTransientError(err);
				console.warn(`${tag} fetch_error attempt=${attempt + 1}/${maxRetries + 1} transient=${transient}`);
				if (!transient) break; // Permanent error. Retrying won't help
				continue;
			}

			lastRid = extractRequestId(res);

			if (res.ok) {
				await res.body?.cancel().catch(() => {}); // body unused; release the connection
				return { ok: true, ...(lastRid ? { rid: lastRid } : {}) };
			}

			const errorCode = await safeErrorCode(res);
			lastStatus = res.status;
			lastCode = errorCode;
			lastReason = `status=${res.status} code=${errorCode}${lastRid ? ` rid=${lastRid}` : ""}`;

			const shouldRetry = res.status === 429 || res.status >= 500;
			console.warn(`${tag} api_error attempt=${attempt + 1}/${maxRetries + 1} ${lastReason}`);
			if (!shouldRetry) break; // 4xx (not 429). Bad payload. Retrying won't help
		} finally {
			clearTimeout(timeout);
		}
	}

	return {
		ok: false,
		reason: lastReason,
		...(lastStatus !== undefined ? { status: lastStatus } : {}),
		...(lastCode !== undefined ? { code: lastCode } : {}),
		...(lastRid !== undefined ? { rid: lastRid } : {}),
	};
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Send the admin notification email for a new guestbook submission.
 * Best-effort. Always returns a result, never throws.
 */
export async function notifyNewEntry(input: NotifyInput): Promise<EmailResult> {
	const tag = `[guestbook-notify:admin_notify:${input.entryId}]`;

	const from = sanitizeHeaderValue(import.meta.env.GUESTBOOK_FROM_EMAIL);
	if (!from) {
		console.warn(`${tag} Missing GUESTBOOK_FROM_EMAIL. Skipping`);
		return { ok: false, reason: "missing_from_email" };
	}

	const to = parseEmailAddress(import.meta.env.GUESTBOOK_NOTIFY_TO || SOCIAL.email);
	if (!to) {
		console.warn(`${tag} No valid admin recipient configured. Skipping`);
		return { ok: false, reason: "missing_admin_to" };
	}

	let rendered: { subject: string; html: string; text: string };
	try {
		rendered = await renderNotifyEmail({ ...input, avatarState: input.avatarState ?? null });
	} catch (err) {
		// Log only error type. Never log err.message (may capture rendered props in some environments)
		console.error(`${tag} template_error: ${err instanceof Error ? err.name : typeof err}`);
		return { ok: false, reason: "template_error" };
	}
	const { subject, html, text } = rendered;

	return sendEmail({
		kind: "admin_notify",
		entryId: input.entryId,
		idempotencyKey: `admin-${input.entryId}-${input.submittedAt.getTime()}`,
		from,
		to: [to],
		// Reply-To the guest so the admin can respond directly (validated before use)
		reply_to: parseEmailAddress(input.email),
		subject,
		html,
		text,
		headers: {
			// Prevent OOO/vacation auto-reply storms and improve mailbox classification
			"Auto-Submitted": "auto-generated",
			"X-Auto-Response-Suppress": "All",
			"X-Transactional": "1",
			"X-Entity-Ref-ID": String(input.entryId),
			"X-Guestbook-Entry-ID": String(input.entryId),
			"X-Guestbook-Email-Kind": "admin_notify",
		},
	});
}

/**
 * Send an entry copy to the guest who opted in.
 *
 * Skips entries that are not visible (pending and hidden wait for approval)
 * and invalid or missing recipient addresses.
 */
export async function sendEntryCopy(input: EntryCopyInput): Promise<EmailResult> {
	const tag = `[guestbook-notify:entry_copy:${input.entryId}]`;
	if (input.status !== "visible") return { ok: false, reason: "skipped_not_visible" };

	const recipientEmail = parseEmailAddress(input.email);
	if (!recipientEmail) return { ok: false, reason: "invalid_recipient" };

	const from = sanitizeHeaderValue(import.meta.env.GUESTBOOK_FROM_EMAIL);
	if (!from) {
		console.warn(`${tag} Missing GUESTBOOK_FROM_EMAIL. Skipping`);
		return { ok: false, reason: "missing_from_email" };
	}

	const adminEmail = import.meta.env.GUESTBOOK_NOTIFY_TO || SOCIAL.email;
	// Dedicated reply-to alias keeps reply address stable even if NOTIFY_TO changes
	const replyToEmail = parseEmailAddress(import.meta.env.GUESTBOOK_REPLY_TO || adminEmail);
	if (!replyToEmail) {
		console.warn(`${tag} No valid reply-to address configured. Skipping`);
		return { ok: false, reason: "missing_reply_to" };
	}

	let rendered: { subject: string; html: string; text: string };
	try {
		rendered = await renderEntryCopyEmail({
			name: input.name,
			message: input.message,
			style: input.style,
			avatarState: input.avatarState ?? null,
			entryId: input.entryId,
			theme: input.theme,
		});
	} catch (err) {
		// Log only error type. Never log err.message (may capture rendered props in some environments)
		console.error(`${tag} template_error: ${err instanceof Error ? err.name : typeof err}`);
		return { ok: false, reason: "template_error" };
	}
	const { subject, html, text } = rendered;

	return sendEmail({
		kind: "entry_copy",
		entryId: input.entryId,
		idempotencyKey: `copy-${input.entryId}-${input.submittedAt.getTime()}`,
		from,
		to: [recipientEmail],
		// Reply-To the site owner so the guest can reach the admin
		reply_to: replyToEmail,
		subject,
		html,
		text,
		headers: {
			// Prevent OOO/vacation auto-reply storms and improve mailbox classification
			"Auto-Submitted": "auto-generated",
			"X-Auto-Response-Suppress": "All",
			"X-Transactional": "1",
			"X-Entity-Ref-ID": `copy-${input.entryId}`,
			"X-Guestbook-Entry-ID": String(input.entryId),
			"X-Guestbook-Email-Kind": "entry_copy",
		},
	});
}
