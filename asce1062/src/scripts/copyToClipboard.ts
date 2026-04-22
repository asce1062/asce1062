/**
 * Copy to clipboard utilities.
 *
 * `writeTextToClipboard` is the shared low-level browser primitive. UI surfaces
 * decide how to acknowledge success: the legacy class shows a notification,
 * while the terminal prints inline command output.
 */

export interface CopyToClipboardOptions {
	notificationId: string;
	notificationDuration?: number;
}

export async function writeTextToClipboard(text: string): Promise<boolean> {
	if (!navigator.clipboard?.writeText) return false;

	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch {
		return false;
	}
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
		const copied = await writeTextToClipboard(text);
		if (copied) {
			this.showNotification();
			return true;
		}

		console.error("Failed to copy to clipboard");
		return false;
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
