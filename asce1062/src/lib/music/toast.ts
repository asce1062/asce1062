/**
 * Toast Notification System
 * Simple, lightweight toast notifications for user feedback
 */

type ToastType = "success" | "error" | "info" | "warning";

interface ToastOptions {
	message: string;
	type?: ToastType;
	duration?: number; // milliseconds
}

/**
 * Show a toast notification
 * @param options - Toast configuration
 */
export function showToast(options: ToastOptions | string): void {
	const config: ToastOptions = typeof options === "string" ? { message: options } : options;

	const { message, type = "info", duration = 3000 } = config;

	// Create toast element
	const toast = document.createElement("div");

	// Set base classes
	const baseClasses =
		"fixed bottom-24 left-1/2 -translate-x-1/2 px-4 py-2 shadow-xl border z-[100] text-sm font-medium transition-all duration-300";

	// Type-specific styling
	const typeClasses = {
		success:
			"bg-green-100/95 dark:bg-green-900/95 text-green-900 dark:text-green-100 border-green-500 dark:border-green-600",
		error: "bg-red-100/95 dark:bg-red-900/95 text-red-900 dark:text-red-100 border-red-500 dark:border-red-600",
		warning:
			"bg-yellow-100/95 dark:bg-yellow-900/95 text-yellow-900 dark:text-yellow-100 border-yellow-500 dark:border-yellow-600",
		info: "bg-palette-200/95 dark:bg-palette-900/95 text-palette-50 dark:text-palette-200 border-palette-700 dark:border-palette-500",
	};

	toast.className = `${baseClasses} ${typeClasses[type]} backdrop-blur-lg`;
	toast.textContent = message;

	// Add icon based on type
	const icon = document.createElement("i");
	const iconClasses = {
		success: "icon-check-circle-fill",
		error: "icon-x-circle-fill",
		warning: "icon-exclamation-triangle-fill",
		info: "icon-info-circle-fill",
	};
	icon.className = `${iconClasses[type]} mr-2`;

	// Insert icon before text
	toast.insertBefore(icon, toast.firstChild);

	// Add to DOM
	document.body.appendChild(toast);

	// Animate in
	requestAnimationFrame(() => {
		toast.style.opacity = "0";
		toast.style.transform = "translate(-50%, 10px)";

		requestAnimationFrame(() => {
			toast.style.opacity = "1";
			toast.style.transform = "translate(-50%, 0)";
		});
	});

	// Remove after duration
	setTimeout(() => {
		toast.style.opacity = "0";
		toast.style.transform = "translate(-50%, 10px)";

		setTimeout(() => {
			document.body.removeChild(toast);
		}, 300);
	}, duration);
}

/**
 * Show success toast
 */
export function showSuccess(message: string): void {
	showToast({ message, type: "success" });
}

/**
 * Show error toast
 */
export function showError(message: string): void {
	showToast({ message, type: "error", duration: 4000 }); // Errors stay longer
}

/**
 * Show warning toast
 */
export function showWarning(message: string): void {
	showToast({ message, type: "warning" });
}

/**
 * Show info toast
 */
export function showInfo(message: string): void {
	showToast({ message, type: "info" });
}
