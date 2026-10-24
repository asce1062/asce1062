/**
 * Entry copy delivery.
 *
 * A copy goes out only while the entry is visible (see the copy policy in
 * guestbook-notify.ts): on submit for entries that went live straight away, and
 * on approval for entries the classifier held. Approving also retries a copy
 * whose submit-time send failed.
 *
 * The copy is claimed (copySentAt set) before sending, so concurrent callers
 * such as a double-clicked Approve send at most once. A failed send releases
 * the claim. If the function dies between claim and send, the copy is lost
 * rather than duplicated.
 */
import { claimUnsentCopy, releaseCopyClaim } from "./guestbook";
import { sendEntryCopy, type EmailResult } from "./guestbook-notify";

/**
 * Send the copy the guest asked for, if the entry is visible and none went out yet.
 * Returns null when there is nothing to send. Never throws: callers have already
 * committed the entry or the approval and must not report those as failed.
 */
export async function deliverRequestedCopy(entryId: number): Promise<EmailResult | null> {
	let claimedAt: Date | undefined;
	try {
		const copy = await claimUnsentCopy(entryId);
		if (!copy) return null;
		claimedAt = copy.claimedAt;

		const result = await sendEntryCopy({
			name: copy.name,
			email: copy.email,
			message: copy.message,
			style: copy.style,
			avatarState: copy.avatarState,
			status: "visible",
			entryId: copy.id,
			theme: copy.theme,
			submittedAt: copy.submittedAt,
		});
		if (!result.ok) {
			console.warn(`[guestbook] entry copy not sent for entry ${entryId}: ${result.reason}`);
			await releaseCopyClaim(entryId, claimedAt);
		}
		return result;
	} catch (err) {
		console.error(`[guestbook] entry copy delivery error for entry ${entryId}:`, err);
		if (claimedAt) {
			await releaseCopyClaim(entryId, claimedAt).catch((releaseErr) =>
				console.error(`[guestbook] entry copy claim not released for entry ${entryId}:`, releaseErr)
			);
		}
		return { ok: false, reason: "delivery_error" };
	}
}
