/**
 * Palette Copy Functionality
 *
 * Handles copying CSS variable computed values to clipboard
 * with icon toggle feedback (clipboard → checkmark), a brief error state when
 * the copy fails, and a polite screen reader announcement for both outcomes.
 */

import { writeTextToClipboard } from "@/scripts/copyToClipboard";
import { flashCheckIcon } from "@/scripts/feedbackManager";
import { announceStatus, ensureStatusRegion } from "@/scripts/statusAnnouncer";

const RESET_DELAY = 2000;
const COPIED_LABEL = "Copied!";
const FAILED_LABEL = "Copy failed";
const FAILED_ANNOUNCEMENT = "Copy failed. Try again.";
const ERROR_CLASS = "text-error";
const SUCCESS_CLASS = "text-success";

// Pending restores, keyed on the element whose look was changed, so a second
// click cancels the first restore instead of racing it.
const restoreTimers = new WeakMap<HTMLElement, number>();

/**
 * Initialize palette interactions
 */
export function initPaletteCopy(): void {
	// Swatch copy buttons
	const copyButtons = document.querySelectorAll<HTMLButtonElement>(".copy-btn");
	// OKLCH copy buttons (ingredients table)
	const oklchButtons = document.querySelectorAll<HTMLButtonElement>(".oklch-copy");
	if (copyButtons.length === 0 && oklchButtons.length === 0) return;

	// The live region has to exist before its text changes, or the first copy is not announced.
	ensureStatusRegion();

	copyButtons.forEach((btn) => {
		btn.addEventListener("click", () => void handleCopyClick(btn));
	});
	oklchButtons.forEach((btn) => {
		btn.addEventListener("click", () => void handleOklchCopy(btn));
	});
}

/** Run `restore` after the reset delay, replacing any restore still pending for `el`. */
function scheduleRestore(el: HTMLElement, restore: () => void): void {
	const prior = restoreTimers.get(el);
	if (prior !== undefined) clearTimeout(prior);

	const timer = window.setTimeout(() => {
		restoreTimers.delete(el);
		restore();
	}, RESET_DELAY);
	restoreTimers.set(el, timer);
}

/**
 * Handle swatch copy button click
 */
async function handleCopyClick(btn: HTMLButtonElement): Promise<void> {
	const cssVar = btn.getAttribute("data-css-var");
	if (!cssVar) return;

	// Get the computed color value from CSS variable
	const computedValue = window.getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim();

	if (await writeTextToClipboard(computedValue)) {
		btn.classList.remove(ERROR_CLASS);
		showSuccessState(btn);
		announceStatus(`Copied ${computedValue}`);
		return;
	}

	// Failure: the clipboard icon stays and turns the error colour for a moment.
	btn.classList.add(ERROR_CLASS);
	scheduleRestore(btn, () => btn.classList.remove(ERROR_CLASS));
	announceStatus(FAILED_ANNOUNCEMENT);
}

/**
 * Handle OKLCH copy button click (ingredients table)
 */
async function handleOklchCopy(btn: HTMLButtonElement): Promise<void> {
	const oklchValue = btn.getAttribute("data-oklch");
	if (!oklchValue) return;

	const codeElement = btn.querySelector<HTMLElement>("code");
	if (!codeElement) return;

	const copied = await writeTextToClipboard(oklchValue);
	showOklchState(codeElement, oklchValue, copied);
	announceStatus(copied ? `Copied ${oklchValue}` : FAILED_ANNOUNCEMENT);
}

/**
 * Show the copied or failed state for OKLCH values, then put the value back
 */
function showOklchState(codeElement: HTMLElement, originalValue: string, copied: boolean): void {
	codeElement.textContent = copied ? COPIED_LABEL : FAILED_LABEL;
	codeElement.classList.toggle(SUCCESS_CLASS, copied);
	codeElement.classList.toggle(ERROR_CLASS, !copied);

	scheduleRestore(codeElement, () => {
		codeElement.textContent = originalValue;
		codeElement.classList.remove(SUCCESS_CLASS, ERROR_CLASS);
	});
}

/**
 * Show success state (toggle icons)
 */
function showSuccessState(btn: HTMLButtonElement): void {
	const copyIcon = btn.querySelector<HTMLElement>(".copy-icon");
	const checkIcon = btn.querySelector<HTMLElement>(".check-icon");
	if (!copyIcon || !checkIcon) return;
	flashCheckIcon(copyIcon, checkIcon, RESET_DELAY);
}

// Auto-initialize on page load (for Astro view transitions)
document.addEventListener("astro:page-load", initPaletteCopy);
