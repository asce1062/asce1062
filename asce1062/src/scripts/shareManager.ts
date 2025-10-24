/**
 * Share Manager
 * Centralized utility for handling clipboard operations and share notifications
 */

const AUTO_HIDE_DELAY = 3000; // 3 seconds
const notificationTimers = new Map<string, number>();

/**
 * Show a notification with auto-hide
 */
export function showNotification(notificationId: string): void {
	const notification = document.getElementById(notificationId);
	if (!notification) {
		console.error(`[shareManager] Notification with id "${notificationId}" not found`);
		return;
	}

	// Clear any existing timeout for this notification
	const existingTimeout = notificationTimers.get(notificationId);
	if (existingTimeout !== undefined) {
		clearTimeout(existingTimeout);
	}

	// Show notification
	notification.classList.remove("fadeOut", "hidden");

	// Set auto-hide timer
	const timeout = window.setTimeout(() => {
		hideNotification(notificationId);
		notificationTimers.delete(notificationId);
	}, AUTO_HIDE_DELAY);

	notificationTimers.set(notificationId, timeout);
}

/**
 * Hide a notification
 */
export function hideNotification(notificationId: string): void {
	const notification = document.getElementById(notificationId);
	if (!notification) return;

	// Clear timeout if it exists
	const existingTimeout = notificationTimers.get(notificationId);
	if (existingTimeout !== undefined) {
		clearTimeout(existingTimeout);
		notificationTimers.delete(notificationId);
	}

	// Add fade out animation
	notification.classList.add("fadeOut");

	// Hide after animation completes
	setTimeout(() => {
		notification.classList.add("hidden");
		notification.classList.remove("fadeOut");
	}, 300);
}

/**
 * Copy text to clipboard and show notification
 */
export async function copyToClipboard(text: string, notificationId: string): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(text);
		showNotification(notificationId);
		return true;
	} catch (err) {
		console.error("[shareManager] Failed to copy to clipboard:", err);
		return false;
	}
}

/**
 * Initialize share notification close button
 * Call this for each notification component
 */
export function initShareNotification(notificationId: string): void {
	const closeButton = document.getElementById(`${notificationId}-close`);
	if (!closeButton) {
		console.error(`[shareManager] Close button for "${notificationId}" not found`);
		return;
	}

	// Remove old listener if it exists (prevents duplicates)
	closeButton.replaceWith(closeButton.cloneNode(true));
	const newCloseButton = document.getElementById(`${notificationId}-close`);

	newCloseButton?.addEventListener("click", () => {
		hideNotification(notificationId);
	});
}
