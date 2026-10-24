/**
 * Unit tests for guestbook-notify.ts
 * sendEntryCopy visibility policy and recipient validation
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
		status: "visible",
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
// sendEntryCopy: only visible entries are copied
// ---------------------------------------------------------------------------

describe("sendEntryCopy visibility policy", () => {
	it.each(["pending", "hidden"] as const)("skips a %s entry without contacting Resend", async (status) => {
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
		const result = await sendEntryCopy(makeEntryCopyInput({ status }));
		expect(result).toEqual({ ok: false, reason: "skipped_not_visible" });
		expect(fetchMock).not.toHaveBeenCalled();
		expect(renderEntryCopyEmail).not.toHaveBeenCalled();
	});

	it("sends a visible entry to the guest", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeOkFetchResponse()));
		const result = await sendEntryCopy(makeEntryCopyInput({ status: "visible" }));
		expect(result.ok).toBe(true);
		const [, init] = vi.mocked(global.fetch).mock.calls[0] as [string, RequestInit];
		expect(JSON.parse(String(init.body))).toMatchObject({ to: ["alice@example.com"] });
	});
});

// ---------------------------------------------------------------------------
// sendEntryCopy: invalid recipient
// ---------------------------------------------------------------------------

describe("sendEntryCopy recipient validation", () => {
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

	it("proceeds past recipient validation for a valid email", async () => {
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
		// 1 initial + 5 retries is the ceiling; the total deadline (max 8s) stops it
		// sooner, since the backoff alone for 5 retries is ~15s.
		const attempts = vi.mocked(global.fetch).mock.calls.length;
		expect(attempts).toBeGreaterThanOrEqual(2);
		expect(attempts).toBeLessThanOrEqual(6);
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

// ---------------------------------------------------------------------------
// Real network failure shapes, stalled bodies and the total time budget
// ---------------------------------------------------------------------------

/** A fetch mock that only settles when its AbortSignal fires, like a hung socket. */
function hangingFetch(respond?: (signal: AbortSignal) => Response) {
	return vi.fn(
		(_url: string, init: RequestInit) =>
			new Promise<Response>((resolve, reject) => {
				const signal = init.signal as AbortSignal;
				if (respond) return resolve(respond(signal));
				signal.addEventListener("abort", () =>
					reject(Object.assign(new Error("The operation was aborted"), { name: "AbortError" }))
				);
			})
	);
}

describe("notifyNewEntry. network failure shapes and time budget", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("retries undici's TypeError('fetch failed') whose code is on err.cause", async () => {
		const cause = Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" });
		const undiciError = new TypeError("fetch failed", { cause });
		vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(undiciError).mockResolvedValueOnce(makeOkFetchResponse()));

		const resultPromise = notifyNewEntry(makeNotifyInput());
		await vi.runAllTimersAsync();

		expect((await resultPromise).ok).toBe(true);
		expect(global.fetch).toHaveBeenCalledTimes(2);
	});

	it("reports the cause code rather than the generic 'fetch failed'", async () => {
		vi.stubEnv("GUESTBOOK_EMAIL_RETRIES", "0");
		const cause = Object.assign(new Error("getaddrinfo ENOTFOUND api.resend.com"), { code: "ENOTFOUND" });
		vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed", { cause })));

		const resultPromise = notifyNewEntry(makeNotifyInput());
		await vi.runAllTimersAsync();
		const result = await resultPromise;

		expect(result.ok).toBe(false);
		expect(!result.ok && result.reason).toContain("ENOTFOUND");
	});

	it("does not hang when an error response body stalls", async () => {
		vi.stubEnv("GUESTBOOK_EMAIL_RETRIES", "0");
		vi.stubEnv("GUESTBOOK_EMAIL_TIMEOUT_MS", "2000");
		const stalledBody = (signal: AbortSignal) =>
			new Response(
				new ReadableStream({
					start(controller) {
						signal.addEventListener("abort", () => controller.error(new Error("aborted")));
					},
				}),
				{ status: 503 }
			);
		vi.stubGlobal("fetch", hangingFetch(stalledBody));

		let settled = false;
		const resultPromise = notifyNewEntry(makeNotifyInput()).then((r) => {
			settled = true;
			return r;
		});
		// Rendering runs first (real async work). Only move the clock once the
		// request is in flight, otherwise the timer may not exist yet.
		await vi.waitFor(() => expect(global.fetch).toHaveBeenCalled());
		await vi.advanceTimersByTimeAsync(2_500);

		expect(settled).toBe(true);
		const result = await resultPromise;
		expect(!result.ok && result.status).toBe(503);
	});

	it("gives up once the total deadline is spent, whatever the retry count", async () => {
		vi.stubEnv("GUESTBOOK_EMAIL_RETRIES", "5");
		vi.stubEnv("GUESTBOOK_EMAIL_TIMEOUT_MS", "10000");
		vi.stubEnv("GUESTBOOK_EMAIL_DEADLINE_MS", "3000");
		vi.stubGlobal("fetch", hangingFetch());

		const start = Date.now();
		let finishedAt = 0;
		const resultPromise = notifyNewEntry(makeNotifyInput()).then((r) => {
			finishedAt = Date.now();
			return r;
		});
		await vi.runAllTimersAsync();
		const result = await resultPromise;

		expect(result.ok).toBe(false);
		expect(finishedAt - start).toBeLessThanOrEqual(3_000);
	});
});

describe("notifyNewEntry. tuning env vars", () => {
	it("GUESTBOOK_EMAIL_RETRIES=0 disables retries", async () => {
		vi.stubEnv("GUESTBOOK_EMAIL_RETRIES", "0");
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 500 })));

		const result = await notifyNewEntry(makeNotifyInput());

		expect(result.ok).toBe(false);
		expect(global.fetch).toHaveBeenCalledTimes(1);
	});
});
