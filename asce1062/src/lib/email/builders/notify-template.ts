/**
 * Admin notification email builder.
 * HTML is rendered from NotifyEmail.astro. This file owns subject + plain-text.
 */
import type { ClassificationResult } from "@/lib/api/guestbook";
import NotifyEmail from "@/components/email/NotifyEmail.astro";
import { renderEmailHtml } from "@/lib/email/render";
import {
	BASE_URL,
	MAX_ADMIN_PREVIEW_CHARS,
	truncate,
	sanitizeHeaderValue,
	sanitizeUrl,
	sanitizeUserText,
	wrapText,
} from "@/config/email-config";

export interface NotifyTemplateInput {
	name: string;
	email: string;
	url: string;
	message: string;
	style?: string;
	avatarState?: string | null;
	classification: ClassificationResult;
	entryId: number;
	submittedAt: Date;
	theme: "light" | "dark";
}

const STATUS_EMOJI: Record<string, string> = {
	visible: "✅",
	pending: "⚠️",
	hidden: "🚫",
};

export async function renderNotifyEmail(
	input: NotifyTemplateInput
): Promise<{ subject: string; html: string; text: string }> {
	const { classification } = input;
	const emoji = STATUS_EMOJI[classification.status] ?? "❓";
	const reasons = classification.reasons.length > 0 ? classification.reasons.join(", ") : "none";
	const entryUrl = `${BASE_URL}/guestbook#entry-${input.entryId}`;
	const reviewUrl = `${BASE_URL}/admin/guestbook`;

	const safeName = sanitizeHeaderValue(input.name) ?? "(unknown)";
	const subject = `${emoji} Guestbook: ${safeName} (${classification.status})`;
	// Validate user-supplied URL. Only http/https allowed. invalid → omit link entirely
	const safeUrl = sanitizeUrl(input.url);

	// Use a public URL so clients (which strip data: URIs) can fetch the image.
	// gender and avatar are passed as separate params to avoid double-encoding
	// issues with Netlify's function infrastructure (it re-splits %26 in values).
	const avatarImageDataUri = (() => {
		if (!input.avatarState) return null;
		const p = new URLSearchParams(input.avatarState);
		const gender = p.get("gender");
		const avatar = p.get("avatar");
		return gender && avatar ? `${BASE_URL}/api/avatar.png?gender=${gender}&avatar=${avatar}` : null;
	})();

	const html = await renderEmailHtml(NotifyEmail, { ...input, url: safeUrl, avatarImageDataUri });

	const text = [
		`New guestbook entry from ${input.name}`,
		"",
		`Status:  ${classification.status.toUpperCase()}`,
		`Score:   ${classification.score}`,
		`Reasons: ${reasons}`,
		"",
		"--- Entry Details ---",
		`Name:    ${input.name}`,
		input.email ? `Email:   ${input.email}` : null,
		safeUrl ? `URL:     ${safeUrl}` : null,
		`Time:    ${input.submittedAt.toISOString()}`,
		"",
		"--- Message ---",
		wrapText(truncate(sanitizeUserText(input.message), MAX_ADMIN_PREVIEW_CHARS)),
		"",
		"--- Links ---",
		classification.status === "visible"
			? `Entry:     ${entryUrl}`
			: `Entry:     ${entryUrl} (not visible until approved)`,
		`Guestbook: ${BASE_URL}/guestbook`,
		classification.status !== "visible" ? `Review:    ${reviewUrl}` : null,
	]
		.filter((l) => l !== null)
		.join("\n");

	return { subject, html, text };
}
