/**
 * Copy button for every AsciiWidget on the page.
 *
 * Reads data-ascii-current (set by each page's init script) from the widget
 * root and copies it to the clipboard. Success swaps the clipboard icon for a
 * check; failure tints the button with the error colour for a moment. Both
 * outcomes are announced to screen readers.
 *
 * BROWSER-ONLY. Import only from client-side <script> blocks.
 */

import { writeTextToClipboard } from "@/scripts/copyToClipboard";
import { flashCheckIcon } from "@/scripts/feedbackManager";
import { announceStatus, ensureStatusRegion } from "@/scripts/statusAnnouncer";

const RESET_DELAY = 2000;
const ERROR_CLASS = "text-error";
const COPIED_ANNOUNCEMENT = "ASCII art copied";
const FAILED_ANNOUNCEMENT = "Copy failed. Try again.";

const errorRestoreTimers = new WeakMap<HTMLElement, number>();

interface AsciiVariant {
	text: string;
	font: string;
	art: string;
}

/**
 * Format the variant for copying:
 *
 * 1. Visual art. literal newlines. For pasting anywhere and it reads correctly.
 * 2. Valid JSON in a ```json code fence. Properly escaped \n json and can be
 *    parsed without modification.
 */
function formatVariant(raw: string): string {
	const { text, font, art } = JSON.parse(raw) as AsciiVariant;

	const visual = `[${font}]\n\n` + "```figlet\n" + art + "\n```";
	const json = "```json\n" + JSON.stringify({ text, font, art }, null, 2) + "\n```";

	return visual + "\n\n" + json;
}

function showCopied(btn: HTMLButtonElement): void {
	btn.classList.remove(ERROR_CLASS);
	const copyIcon = btn.querySelector<HTMLElement>(".ascii-copy-icon");
	const checkIcon = btn.querySelector<HTMLElement>(".ascii-check-icon");
	if (copyIcon && checkIcon) flashCheckIcon(copyIcon, checkIcon, RESET_DELAY);
}

function showFailed(btn: HTMLButtonElement): void {
	const prior = errorRestoreTimers.get(btn);
	if (prior !== undefined) clearTimeout(prior);

	btn.classList.add(ERROR_CLASS);
	errorRestoreTimers.set(
		btn,
		window.setTimeout(() => {
			errorRestoreTimers.delete(btn);
			btn.classList.remove(ERROR_CLASS);
		}, RESET_DELAY)
	);
}

async function handleCopyClick(btn: HTMLButtonElement): Promise<void> {
	const widgetId = btn.dataset.widgetId;
	const raw = widgetId ? document.getElementById(widgetId)?.dataset.asciiCurrent : undefined;
	if (!raw) return;

	if (await writeTextToClipboard(formatVariant(raw))) {
		showCopied(btn);
		announceStatus(COPIED_ANNOUNCEMENT);
		return;
	}

	showFailed(btn);
	announceStatus(FAILED_ANNOUNCEMENT);
}

export function initAsciiCopy(): void {
	const buttons = document.querySelectorAll<HTMLButtonElement>(".ascii-widget-copy");
	if (buttons.length === 0) return;

	// The live region has to exist before its text changes, or the first copy is not announced.
	ensureStatusRegion();
	buttons.forEach((btn) => btn.addEventListener("click", () => void handleCopyClick(btn)));
}
