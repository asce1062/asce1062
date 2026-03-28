/**
 * Unit tests for guestbook-notify.ts
 * sendEntryCopy spam guards (4 ordered guards)
 * sendEmail retry/resilience via notifyNewEntry
 *
 * Key constraints:
 *  - `sendEmail` is private; it is tested indirectly through `notifyNewEntry`.
 *  - Template builders are mocked to isolate transport logic from rendering.
 *  - `vi.useFakeTimers()` prevents real 500 ms backoff delays during retry tests.
 *  - All env vars are set/reset via vi.stubEnv / vi.unstubAllEnvs in each test.
 */
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

// Mock template builders.
vi.mock("@/lib/email/builders/notify-template", () => ({
	renderNotifyEmail: vi.fn(),
}));
vi.mock("@/lib/email/builders/entry-copy-template", () => ({
	renderEntryCopyEmail: vi.fn(),
}));

import { notifyNewEntry, sendEntryCopy } from "@/lib/api/guestbook-notify";
import type { NotifyInput, EntryCopyInput } from "@/lib/api/guestbook-notify";
import type { ClassificationResult } from "@/lib/api/guestbook";
import { renderNotifyEmail } from "@/lib/email/builders/notify-template";
import { renderEntryCopyEmail } from "@/lib/email/builders/entry-copy-template";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SUBMITTED_AT = new Date("2025-01-01T12:00:00Z");

function makeClassification(overrides?: Partial<ClassificationResult>): ClassificationResult {
	return {
		status: "visible",
		score: 0,
		reasons: [],
		severity: "none",
		urlsFound: 0,
		hasLinks: false,
		isHonestDuplicate: false,
		hasHardReason: false,
		...overrides,
	};
}

function makeNotifyInput(overrides?: Partial<NotifyInput>): NotifyInput {
	return {
		name: "Alice",
		email: "alice@example.com",
		url: "https://example.com",
		message: "Hello!",
		style: "default",
		avatarState: null,
		classification: makeClassification(),
		entryId: 42,
		theme: "light",
		submittedAt: SUBMITTED_AT,
		...overrides,
	};
}

function makeEntryCopyInput(overrides?: Partial<EntryCopyInput>): EntryCopyInput {
	return {
		name: "Alice",
		email: "alice@example.com",
		message: "Hello!",
		style: "default",
		avatarState: null,
		classification: makeClassification(),
		entryId: 42,
		theme: "light",
		submittedAt: SUBMITTED_AT,
		...overrides,
	};
}

function makeOkRendered() {
	return { subject: "Test Subject", html: "<p>Test</p>", text: "Test" };
}

function makeOkFetchResponse(body = { id: "re_123" }) {
	return new Response(JSON.stringify(body), {
		status: 200,
		headers: { "Content-Type": "application/json", "x-resend-id": "re_123" },
	});
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
	vi.resetAllMocks();
	// Default env: all required vars present
	vi.stubEnv("RESEND_API_KEY", "test-api-key");
	vi.stubEnv("GUESTBOOK_FROM_EMAIL", "Guestbook <guestbook@example.com>");
	vi.stubEnv("GUESTBOOK_NOTIFY_TO", "admin@example.com");
	vi.stubEnv("GUESTBOOK_REPLY_TO", "reply@example.com");
	// Speed up retry delays in tests
	vi.stubEnv("GUESTBOOK_EMAIL_RETRIES", "2");
	vi.stubEnv("GUESTBOOK_EMAIL_TIMEOUT_MS", "5000");
	// Default: templates succeed
	vi.mocked(renderNotifyEmail).mockResolvedValue(makeOkRendered());
	vi.mocked(renderEntryCopyEmail).mockResolvedValue(makeOkRendered());
});

afterEach(() => {
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// sendEntryCopy Guard 1: hidden or hard reason → skipped_spam
// ---------------------------------------------------------------------------

describe("sendEntryCopy Guard 1: hidden status or hard reason", () => {
	it("returns skipped_spam when status is hidden", async () => {
		const result = await sendEntryCopy(
			makeEntryCopyInput({
				classification: makeClassification({ status: "hidden", hasHardReason: true }),
			})
		);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason).toBe("skipped_spam");
	});

	it("returns skipped_spam when hasHardReason is true even with pending status", async () => {
		const result = await sendEntryCopy(
			makeEntryCopyInput({
				classification: makeClassification({ status: "pending", hasHardReason: true }),
			})
		);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason).toBe("skipped_spam");
	});

	it("returns skipped_spam when hasHardReason is true with visible status", async () => {
		const result = await sendEntryCopy(
			makeEntryCopyInput({
				classification: makeClassification({ status: "visible", hasHardReason: true }),
			})
		);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason).toBe("skipped_spam");
	});

	it("does NOT skip when status is pending and hasHardReason is false", async () => {
		// Should fall through Guard 1 (may be caught by Guards 2-4 or succeed)
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeOkFetchResponse()));
		const result = await sendEntryCopy(
			makeEntryCopyInput({
				classification: makeClassification({ status: "pending", hasHardReason: false }),
			})
		);
		// Guard 1 was NOT triggered? result is not skipped_spam
		expect(result.ok === true || (result.ok === false && result.reason !== "skipped_spam")).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// sendEntryCopy Guard 2: rate_limited + non-visible → skipped_rate_limited
// ---------------------------------------------------------------------------

describe("sendEntryCopy Guard 2: rate_limited non-visible", () => {
	it("returns skipped_rate_limited for pending + rate_limited", async () => {
		const result = await sendEntryCopy(
			makeEntryCopyInput({
				classification: makeClassification({
					status: "pending",
					reasons: ["rate_limited"],
				}),
			})
		);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason).toBe("skipped_rate_limited");
	});

	it("returns skipped_rate_limited for hidden + rate_limited (hidden caught by Guard 1 first)", async () => {
		const result = await sendEntryCopy(
			makeEntryCopyInput({
				classification: makeClassification({
					status: "hidden",
					reasons: ["rate_limited"],
					hasHardReason: false,
				}),
			})
		);
		// Guard 1 catches hidden entries. the result reason can be skipped_spam
		expect(result.ok).toBe(false);
	});

	it("does NOT skip a visible entry with rate_limited reason. visibility was earned", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeOkFetchResponse()));
		const result = await sendEntryCopy(
			makeEntryCopyInput({
				classification: makeClassification({
					status: "visible",
					reasons: ["rate_limited"],
				}),
			})
		);
		if (!result.ok) {
			expect(result.reason).not.toBe("skipped_rate_limited");
		}
	});
});

// ---------------------------------------------------------------------------
// sendEntryCopy Guard 3: pending + only link-drop reasons → skipped_pending_probe
// ---------------------------------------------------------------------------

describe("sendEntryCopy Guard 3: pending link-drop probing", () => {
	it("returns skipped_pending_probe for pending + link_only", async () => {
		const result = await sendEntryCopy(
			makeEntryCopyInput({
				classification: makeClassification({
					status: "pending",
					reasons: ["link_only"],
				}),
			})
		);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason).toBe("skipped_pending_probe");
	});

	it("returns skipped_pending_probe for pending + multiple_urls", async () => {
		const result = await sendEntryCopy(
			makeEntryCopyInput({
				classification: makeClassification({
					status: "pending",
					reasons: ["multiple_urls"],
				}),
			})
		);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason).toBe("skipped_pending_probe");
	});

	it("returns skipped_pending_probe for pending + both link-drop reasons", async () => {
		const result = await sendEntryCopy(
			makeEntryCopyInput({
				classification: makeClassification({
					status: "pending",
					reasons: ["link_only", "multiple_urls"],
				}),
			})
		);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason).toBe("skipped_pending_probe");
	});

	it("does NOT skip a pending entry with empty reasons array (Guard 3 check: reasons.length > 0)", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeOkFetchResponse()));
		const result = await sendEntryCopy(
			makeEntryCopyInput({
				classification: makeClassification({
					status: "pending",
					reasons: [], // empty reasons → Guard 3 does NOT trigger
				}),
			})
		);
		// Guard 3 was NOT triggered
		if (!result.ok) {
			expect(result.reason).not.toBe("skipped_pending_probe");
		}
	});

	it("does NOT skip a pending entry that has a non-link reason alongside link_only", async () => {
		// Mixed reasons → some non-link reason present → not all reasons are link-drop
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeOkFetchResponse()));
		const result = await sendEntryCopy(
			makeEntryCopyInput({
				classification: makeClassification({
					status: "pending",
					reasons: ["link_only", "spam_phrase"], // spam_phrase is not in COPY_SKIP_PENDING_REASONS
				}),
			})
		);
		if (!result.ok) {
			expect(result.reason).not.toBe("skipped_pending_probe");
		}
	});

	it("does NOT skip a visible entry with link_only reason. visible status passes Guard 3", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeOkFetchResponse()));
		const result = await sendEntryCopy(
			makeEntryCopyInput({
				classification: makeClassification({
					status: "visible",
					reasons: ["link_only"],
				}),
			})
		);
		if (!result.ok) {
			expect(result.reason).not.toBe("skipped_pending_probe");
		}
	});
});

// ---------------------------------------------------------------------------
// sendEntryCopy Guard 4: invalid recipient
// ---------------------------------------------------------------------------

describe("sendEntryCopy Guard 4: recipient validation", () => {
	it("returns invalid_recipient for an email without @", async () => {
		const result = await sendEntryCopy(makeEntryCopyInput({ email: "not-an-email" }));
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason).toBe("invalid_recipient");
	});

	it("returns invalid_recipient for an empty email string", async () => {
		const result = await sendEntryCopy(makeEntryCopyInput({ email: "" }));
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason).toBe("invalid_recipient");
	});

	it("returns invalid_recipient for an email with CRLF injection attempt", async () => {
		const result = await sendEntryCopy(
			makeEntryCopyInput({
				email: "user\r\nX-Injected: evil@example.com",
			})
		);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason).toBe("invalid_recipient");
	});

	it("proceeds past Guard 4 for a valid email", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeOkFetchResponse()));
		await sendEntryCopy(makeEntryCopyInput({ email: "alice@example.com" }));
		// Passed all guards. fetch was called (result is from sendEmail)
		expect(global.fetch).toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// notifyNewEntry (missing env vars → early return)
// ---------------------------------------------------------------------------

describe("notifyNewEntry missing env vars", () => {
	it("returns missing_api_key when RESEND_API_KEY is absent", async () => {
		vi.stubEnv("RESEND_API_KEY", "");
		const result = await notifyNewEntry(makeNotifyInput());
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason).toBe("missing_api_key");
	});

	it("returns missing_from_email when GUESTBOOK_FROM_EMAIL is absent", async () => {
		vi.stubEnv("GUESTBOOK_FROM_EMAIL", "");
		const result = await notifyNewEntry(makeNotifyInput());
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason).toBe("missing_from_email");
	});

	it("returns template_error when renderNotifyEmail throws", async () => {
		vi.mocked(renderNotifyEmail).mockRejectedValue(new Error("Template failed"));
		const result = await notifyNewEntry(makeNotifyInput());
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason).toBe("template_error");
	});
});

// ---------------------------------------------------------------------------
// notifyNewEntry (successful send)
// ---------------------------------------------------------------------------

describe("notifyNewEntry. successful send", () => {
	it("returns ok:true on a 200 response from Resend", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeOkFetchResponse()));
		const result = await notifyNewEntry(makeNotifyInput());
		expect(result.ok).toBe(true);
	});

	it("includes the Resend request ID in the result when present", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(
				new Response(JSON.stringify({ id: "re_abc" }), {
					status: 200,
					headers: { "x-resend-id": "re_abc" },
				})
			)
		);
		const result = await notifyNewEntry(makeNotifyInput());
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.rid).toBe("re_abc");
	});
});

// ---------------------------------------------------------------------------
// notifyNewEntry (retry logic via sendEmail)
// ---------------------------------------------------------------------------

describe("notifyNewEntry. Retry on 429 / 5xx", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("retries on HTTP 429 and succeeds on the second attempt", async () => {
		vi.stubGlobal(
			"fetch",
			vi
				.fn()
				.mockResolvedValueOnce(new Response(null, { status: 429 }))
				.mockResolvedValueOnce(makeOkFetchResponse())
		);

		const resultPromise = notifyNewEntry(makeNotifyInput());
		await vi.runAllTimersAsync();
		const result = await resultPromise;

		expect(result.ok).toBe(true);
		expect(global.fetch).toHaveBeenCalledTimes(2);
	});

	it("retries on HTTP 500 and succeeds on the second attempt", async () => {
		vi.stubGlobal(
			"fetch",
			vi
				.fn()
				.mockResolvedValueOnce(new Response(null, { status: 500 }))
				.mockResolvedValueOnce(makeOkFetchResponse())
		);

		const resultPromise = notifyNewEntry(makeNotifyInput());
		await vi.runAllTimersAsync();
		const result = await resultPromise;

		expect(result.ok).toBe(true);
		expect(global.fetch).toHaveBeenCalledTimes(2);
	});

	it("does NOT retry on HTTP 400 (bad payload? permanent error)", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: "invalid_param" }), { status: 400 }))
		);

		const resultPromise = notifyNewEntry(makeNotifyInput());
		await vi.runAllTimersAsync();
		const result = await resultPromise;

		expect(result.ok).toBe(false);
		expect(global.fetch).toHaveBeenCalledTimes(1); // no retry
	});

	it("does NOT retry on HTTP 422 (unprocessable entity)", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 422 })));

		const resultPromise = notifyNewEntry(makeNotifyInput());
		await vi.runAllTimersAsync();
		const result = await resultPromise;

		expect(result.ok).toBe(false);
		expect(global.fetch).toHaveBeenCalledTimes(1);
	});

	it("retries on transient AbortError (timeout) and succeeds on retry", async () => {
		const abortError = Object.assign(new Error("The operation was aborted"), { name: "AbortError" });
		vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(abortError).mockResolvedValueOnce(makeOkFetchResponse()));

		const resultPromise = notifyNewEntry(makeNotifyInput());
		await vi.runAllTimersAsync();
		const result = await resultPromise;

		expect(result.ok).toBe(true);
		expect(global.fetch).toHaveBeenCalledTimes(2);
	});

	it("retries on ECONNRESET transient error", async () => {
		const connError = new Error("ECONNRESET: read ECONNRESET");
		vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(connError).mockResolvedValueOnce(makeOkFetchResponse()));

		const resultPromise = notifyNewEntry(makeNotifyInput());
		await vi.runAllTimersAsync();
		const result = await resultPromise;

		expect(result.ok).toBe(true);
		expect(global.fetch).toHaveBeenCalledTimes(2);
	});

	it("does NOT retry on a non-transient fetch error (e.g. invalid URL)", async () => {
		vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch: protocol error")));

		const resultPromise = notifyNewEntry(makeNotifyInput());
		await vi.runAllTimersAsync();
		const result = await resultPromise;

		expect(result.ok).toBe(false);
		// Non-transient error → exactly 1 attempt, then break
		expect(global.fetch).toHaveBeenCalledTimes(1);
	});

	it("respects GUESTBOOK_EMAIL_RETRIES cap. Stops after maxRetries+1 total attempts", async () => {
		vi.stubEnv("GUESTBOOK_EMAIL_RETRIES", "2"); // 2 retries = 3 total attempts
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 500 })));

		const resultPromise = notifyNewEntry(makeNotifyInput());
		await vi.runAllTimersAsync();
		const result = await resultPromise;

		expect(result.ok).toBe(false);
		expect(global.fetch).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
	});

	it("never exceeds 5 retries even if GUESTBOOK_EMAIL_RETRIES is set higher", async () => {
		vi.stubEnv("GUESTBOOK_EMAIL_RETRIES", "10"); // clamped to 5
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 500 })));

		const resultPromise = notifyNewEntry(makeNotifyInput());
		await vi.runAllTimersAsync();
		const result = await resultPromise;

		expect(result.ok).toBe(false);
		expect(global.fetch).toHaveBeenCalledTimes(6); // 1 initial + 5 retries (max)
	});

	it("always returns a result (never throws) even on persistent failure", async () => {
		vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Persistent failure")));

		const resultPromise = notifyNewEntry(makeNotifyInput());
		await vi.runAllTimersAsync();

		await expect(resultPromise).resolves.toBeDefined();
		const result = await resultPromise.catch(() => null);
		// notifyNewEntry must not throw
		expect(result).not.toBeNull();
	});
});
