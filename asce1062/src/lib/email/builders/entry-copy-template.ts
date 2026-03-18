/**
 * Entry copy email builder.
 * Email sent to the guest when they opt in to receive a copy of their entry.
 * HTML is rendered from EntryCopyEmail.astro. This file owns subject + plain-text.
 */
import type { ModerationStatus } from "@/lib/api/guestbook";
import EntryCopyEmail from "@/lib/email/templates/EntryCopyEmail.astro";
import { renderEmailHtml } from "@/lib/email/render";
import { BASE_URL, MAX_COPY_MSG_CHARS, truncate, sanitizeUserText, wrapText } from "@/config/email-config";

export interface EntryCopyTemplateInput {
	name: string;
	message: string;
	style?: string;
	avatarState?: string | null;
	status: ModerationStatus;
	entryId: number;
	theme: "light" | "dark";
}

const siteHost = new URL(BASE_URL).hostname;

export async function renderEntryCopyEmail(
	input: EntryCopyTemplateInput
): Promise<{ subject: string; html: string; text: string }> {
	const entryUrl = `${BASE_URL}/guestbook#entry-${input.entryId}`;
	const subject = `Your guestbook entry on ${siteHost}`;

	// Use a public URL so clients (which strip data: URIs) can fetch the image
	const avatarImageDataUri = input.avatarState
		? `${BASE_URL}/api/avatar.png?state=${encodeURIComponent(input.avatarState)}`
		: null;

	const html = await renderEmailHtml(EntryCopyEmail, { ...input, avatarImageDataUri });

	const text = [
		`Hi ${input.name},`,
		"",
		`You opted in to receive a copy of your guestbook entry on ${siteHost}.`,
		"",
		"---",
		wrapText(truncate(sanitizeUserText(input.message), MAX_COPY_MSG_CHARS)),
		"---",
		"",
		input.status === "pending"
			? "Your entry is pending review. It will appear on the guestbook once approved."
			: input.status === "hidden"
				? "Your entry was flagged for review and may not appear on the guestbook."
				: `View your entry: ${entryUrl}`,
		"",
		`${BASE_URL}/guestbook`,
	].join("\n");

	return { subject, html, text };
}
