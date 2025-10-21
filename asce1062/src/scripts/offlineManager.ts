/**
 * Offline state management utility
 * Handles saving the user's last visited page and redirecting back when online
 */

const LAST_PAGE_KEY = "offline_last_page";

export class OfflineManager {
	/**
	 * Save the current page URL before being redirected to offline page
	 */
	static saveLastPage(url: string = window.location.href): void {
		try {
			sessionStorage.setItem(LAST_PAGE_KEY, url);
		} catch (err) {
			console.error("Failed to save last page:", err);
		}
	}

	/**
	 * Get the last visited page URL
	 */
	static getLastPage(): string | null {
		try {
			return sessionStorage.getItem(LAST_PAGE_KEY);
		} catch (err) {
			console.error("Failed to get last page:", err);
			return null;
		}
	}

	/**
	 * Clear the saved last page
	 */
	static clearLastPage(): void {
		try {
			sessionStorage.removeItem(LAST_PAGE_KEY);
		} catch (err) {
			console.error("Failed to clear last page:", err);
		}
	}

	/**
	 * Check if the browser is currently online
	 */
	static isOnline(): boolean {
		return navigator.onLine;
	}

	/**
	 * Try to redirect back to the last page if online
	 * Returns true if redirect happened, false otherwise
	 */
	static async tryRedirectToLastPage(): Promise<boolean> {
		if (!this.isOnline()) {
			return false;
		}

		const lastPage = this.getLastPage();
		if (!lastPage) {
			// No last page saved, go to home
			window.location.href = "/";
			return true;
		}

		try {
			// Test if the page is accessible
			const response = await fetch(lastPage, { method: "HEAD" });
			if (response.ok) {
				// Page is accessible, redirect to it
				this.clearLastPage();
				window.location.href = lastPage;
				return true;
			}
		} catch (err) {
			console.error("Failed to check page accessibility:", err);
		}

		// If we can't access the last page, go to home
		this.clearLastPage();
		window.location.href = "/";
		return true;
	}

	/**
	 * Set up listeners for online/offline events
	 */
	static setupListeners(onOnline?: () => void, onOffline?: () => void): () => void {
		const handleOnline = () => {
			if (onOnline) {
				onOnline();
			}
		};

		const handleOffline = () => {
			if (onOffline) {
				onOffline();
			}
		};

		window.addEventListener("online", handleOnline);
		window.addEventListener("offline", handleOffline);

		// Return cleanup function
		return () => {
			window.removeEventListener("online", handleOnline);
			window.removeEventListener("offline", handleOffline);
		};
	}
}
