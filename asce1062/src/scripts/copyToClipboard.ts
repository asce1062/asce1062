/**
 * Copy to clipboard utility with notification
 */

export interface CopyToClipboardOptions {
	notificationId: string;
	notificationDuration?: number;
}

export class CopyToClipboard {
	private notification: HTMLElement | null;
	private notificationTimeout: number | null = null;
	private duration: number;

	constructor(options: CopyToClipboardOptions) {
		this.notification = document.getElementById(options.notificationId);
		this.duration = options.notificationDuration || 3000;
	}

	/**
	 * Copy text to clipboard
	 */
	async copy(text: string): Promise<boolean> {
		try {
			await navigator.clipboard.writeText(text);
			this.showNotification();
			return true;
		} catch (err) {
			console.error("Failed to copy to clipboard:", err);
			return false;
		}
	}

	/**
	 * Show notification
	 */
	private showNotification(): void {
		if (!this.notification) return;

		if (this.notificationTimeout) {
			clearTimeout(this.notificationTimeout);
			this.notificationTimeout = null;
		}

		this.notification.classList.remove("fadeOut", "hidden");

		this.notificationTimeout = window.setTimeout(() => {
			this.hideNotification();
		}, this.duration);
	}

	/**
	 * Hide notification
	 */
	hideNotification(): void {
		if (!this.notification) return;

		if (this.notificationTimeout) {
			clearTimeout(this.notificationTimeout);
			this.notificationTimeout = null;
		}

		this.notification.classList.add("fadeOut");

		setTimeout(() => {
			this.notification!.classList.add("hidden");
			this.notification!.classList.remove("fadeOut");
		}, 300);
	}
}
