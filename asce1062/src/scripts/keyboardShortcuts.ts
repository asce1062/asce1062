/**
 * Keyboard Shortcuts Manager
 * Handles keyboard shortcut functionality across the site
 */

export interface ShortcutConfig {
	key: string;
	ctrl?: boolean;
	meta?: boolean;
	shift?: boolean;
	alt?: boolean;
	callback: () => void;
	description?: string;
}

/**
 * Register a keyboard shortcut
 */
export function registerShortcut(config: ShortcutConfig): () => void {
	const handler = (e: KeyboardEvent) => {
		// Check if key matches (case-insensitive)
		const keyMatch = e.key.toLowerCase() === config.key.toLowerCase();
		if (!keyMatch) return;

		// Special handling: if both ctrl and meta are specified, match EITHER (Ctrl OR Cmd)
		const hasCtrlOrMeta = config.ctrl && config.meta;
		if (hasCtrlOrMeta) {
			// Match Ctrl+Key on Windows/Linux OR Cmd+Key on Mac
			const modifierMatch = (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey;
			if (modifierMatch) {
				e.preventDefault();
				config.callback();
			}
			return;
		}

		// Standard modifier key checking for other combinations
		const ctrlMatch = config.ctrl ? e.ctrlKey : !e.ctrlKey;
		const metaMatch = config.meta ? e.metaKey : !e.metaKey;
		const shiftMatch = config.shift ? e.shiftKey : !e.shiftKey;
		const altMatch = config.alt ? e.altKey : !e.altKey;

		if (ctrlMatch && metaMatch && shiftMatch && altMatch) {
			e.preventDefault();
			config.callback();
		}
	};

	document.addEventListener("keydown", handler);

	// Return cleanup function
	return () => {
		document.removeEventListener("keydown", handler);
	};
}

/**
 * Focus search input with Ctrl+K or Cmd+K
 * Common pattern for search functionality
 */
export function initSearchShortcut(
	searchInputSelector: string = ".pagefind-ui__search-input",
	fallbackDelay: number = 100
): () => void {
	return registerShortcut({
		key: "k",
		ctrl: true,
		meta: true, // Will match either Ctrl or Cmd
		description: "Focus search input",
		callback: () => {
			const searchInput = document.querySelector(searchInputSelector) as HTMLInputElement;

			if (searchInput) {
				searchInput.focus();
			} else {
				// Fallback: try again after a delay (for dynamically loaded content)
				setTimeout(() => {
					const delayedInput = document.querySelector(searchInputSelector) as HTMLInputElement;
					delayedInput?.focus();
				}, fallbackDelay);
			}
		},
	});
}

/**
 * Register multiple shortcuts at once
 */
export function registerShortcuts(configs: ShortcutConfig[]): () => void {
	const cleanupFunctions = configs.map(registerShortcut);

	// Return cleanup function that removes all shortcuts
	return () => {
		cleanupFunctions.forEach((cleanup) => cleanup());
	};
}
