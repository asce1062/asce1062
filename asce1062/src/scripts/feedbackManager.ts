/**
 * Feedback Manager
 * Centralized utility for user-facing feedback: toast notifications,
 * clipboard operations, and icon state toggling.
 */
import { writeTextToClipboard } from "@/scripts/copyToClipboard";

const AUTO_HIDE_DELAY = 3000; // ms. time before a notification auto-hides
const FADE_OUT_DURATION = 300; // ms. matches the fadeOut CSS animation duration

// Auto-hide timers: fires hideNotification() after AUTO_HIDE_DELAY.
const notificationTimers = new Map<string, number>();
// Fade-out completion timers: fires the hidden class add after FADE_OUT_DURATION.
// Tracked separately so showNotification() can cancel an in-flight fade before re-showing.
const notificationHideTimers = new Map<string, number>();

// Per-element restore timers for flashCheckIcon.
// Keyed on primaryIcon so rapid repeated clicks cancel the prior pending restore.
const iconRestoreTimers = new WeakMap<HTMLElement, number>();

export type ShareOrCopyResult = "shared" | "copied" | "cancelled" | "failed";

interface ShareOrCopyOptions {
	shareData: ShareData;
	clipboardText: string;
	notificationId: string;
}

/**
 * Show a notification with auto-hide.
 * Cancels any in-flight hide animation or auto-hide timer before showing,
 * so calling this repeatedly never leaves the notification in a broken state.
 */
export function showNotification(notificationId: string): void {
	const notification = document.getElementById(notificationId);
	if (!notification) {
		console.warn(`[feedbackManager] Notification "${notificationId}" not found`);
		return;
	}

	// Cancel any pending auto-hide timer.
	const autoHide = notificationTimers.get(notificationId);
	if (autoHide !== undefined) {
		clearTimeout(autoHide);
		notificationTimers.delete(notificationId);
	}

	// Cancel any in-flight fade-out completion timer so the element is not
	// hidden mid-re-show by a previous call's deferred DOM mutation.
	const fadeHide = notificationHideTimers.get(notificationId);
	if (fadeHide !== undefined) {
		clearTimeout(fadeHide);
		notificationHideTimers.delete(notificationId);
	}

	// Show: clear both animation and hidden state.
	notification.classList.remove("fadeOut", "hidden");

	// Schedule auto-hide.
	const timeout = window.setTimeout(() => {
		hideNotification(notificationId);
	}, AUTO_HIDE_DELAY);
	notificationTimers.set(notificationId, timeout);
}

/**
 * Hide a notification with a fade-out animation.
 * Cancels any pending auto-hide and any prior in-flight fade-out completion
 * to prevent timer overlap from repeated calls.
 */
export function hideNotification(notificationId: string): void {
	const notification = document.getElementById(notificationId);
	if (!notification) return;

	// Clear auto-hide timer.
	const autoHide = notificationTimers.get(notificationId);
	if (autoHide !== undefined) {
		clearTimeout(autoHide);
		notificationTimers.delete(notificationId);
	}

	// Clear any prior fade-out completion timer before scheduling a new one.
	const prevFade = notificationHideTimers.get(notificationId);
	if (prevFade !== undefined) {
		clearTimeout(prevFade);
	}

	notification.classList.add("fadeOut");

	const fadeTimer = window.setTimeout(() => {
		notificationHideTimers.delete(notificationId);
		// Skip DOM mutation if the element was removed before the timer fired
		// (e.g. Astro page swap removed it).
		if (!notification.isConnected) return;
		notification.classList.add("hidden");
		notification.classList.remove("fadeOut");
	}, FADE_OUT_DURATION);
	notificationHideTimers.set(notificationId, fadeTimer);
}

/**
 * Copy text to clipboard and show a notification on success.
 * Returns false if the Clipboard API is unavailable or the write fails.
 */
export async function copyToClipboard(text: string, notificationId: string): Promise<boolean> {
	if (!navigator.clipboard?.writeText) {
		console.error("[feedbackManager] Clipboard API not available");
		return false;
	}

	const copied = await writeTextToClipboard(text);
	if (copied) {
		showNotification(notificationId);
		return true;
	}

	console.error("[feedbackManager] Failed to copy to clipboard");
	return false;
}

/**
 * Prefer the browser/device native share sheet, with clipboard fallback.
 * User-cancelled native share dialogs are treated as intentional no-ops.
 */
export async function shareOrCopyToClipboard({
	shareData,
	clipboardText,
	notificationId,
}: ShareOrCopyOptions): Promise<ShareOrCopyResult> {
	if (navigator.share) {
		try {
			await navigator.share(shareData);
			return "shared";
		} catch (err) {
			if ((err as DOMException).name === "AbortError") return "cancelled";
		}
	}

	const copied = await copyToClipboard(clipboardText, notificationId);
	return copied ? "copied" : "failed";
}

/**
 * Swap a button's primary icon for a green check, then restore after `delay` ms.
 * Pass the two <i> (or any) elements directly. No class-name convention imposed.
 * Cancels any prior pending restore for the same button, so rapid repeated
 * clicks do not cause flicker or leave icons in inconsistent state.
 *
 * Usage:
 *   const primary = btn.querySelector(".my-icon");
 *   const check   = btn.querySelector(".my-check");
 *   flashCheckIcon(primary, check);
 */
export function flashCheckIcon(primaryIcon: HTMLElement, checkIcon: HTMLElement, delay = 2000): void {
	if (primaryIcon === checkIcon) return;

	// Cancel any prior pending restore for this icon pair.
	const prior = iconRestoreTimers.get(primaryIcon);
	if (prior !== undefined) clearTimeout(prior);

	primaryIcon.classList.add("hidden");
	checkIcon.classList.remove("hidden");

	const timer = window.setTimeout(() => {
		iconRestoreTimers.delete(primaryIcon);
		checkIcon.classList.add("hidden");
		primaryIcon.classList.remove("hidden");
	}, delay);
	iconRestoreTimers.set(primaryIcon, timer);
}

/**
 * Initialize a notification's close button.
 * Guards against duplicate initialization on repeated Astro page loads with
 * a data attribute.
 * Call once per notification component per page load.
 */
export function initShareNotification(notificationId: string): void {
	const closeButton = document.getElementById(`${notificationId}-close`);
	if (!closeButton) {
		console.warn(`[feedbackManager] Close button for "${notificationId}" not found`);
		return;
	}

	// Skip if already initialized on this element instance.
	if (closeButton.dataset.feedbackBound === "true") return;
	closeButton.dataset.feedbackBound = "true";

	closeButton.addEventListener("click", () => {
		hideNotification(notificationId);
	});
}
