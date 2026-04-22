/**
 * Keyboard Shortcuts Manager
 * Handles keyboard shortcut functionality across the site
 */
import { NAVBRAND_OPEN_TERMINAL_EVENT, type NavBrandTerminalOpenDetail } from "@/lib/navBrand/terminalEvents";

export interface ShortcutConfig {
	key: string;
	ctrl?: boolean;
	meta?: boolean;
	shift?: boolean;
	alt?: boolean;
	callback: () => void;
	description?: string;
}

function isEditableShortcutTarget(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false;
	if (target.isContentEditable) return true;

	const tagName = target.tagName.toLowerCase();
	return tagName === "input" || tagName === "textarea" || tagName === "select";
}

type TerminalShortcutEventLike = Pick<KeyboardEvent, "key"> &
	Partial<Pick<KeyboardEvent, "ctrlKey" | "altKey" | "metaKey" | "shiftKey">>;

/**
 * Match the global terminal launcher.
 *
 * Browsers expose macOS Option as `altKey`, so this covers Ctrl+Alt+T on
 * Windows/Linux and Ctrl+Option+T on macOS with one exact modifier contract.
 */
export function isTerminalShortcutEvent(event: TerminalShortcutEventLike): boolean {
	return (
		event.key.toLowerCase() === "t" &&
		event.ctrlKey === true &&
		event.altKey === true &&
		event.metaKey !== true &&
		event.shiftKey !== true
	);
}

/**
 * Register a keyboard shortcut
 */
export function registerShortcut(config: ShortcutConfig): () => void {
	const handler = (e: KeyboardEvent) => {
		// e.key is undefined on synthetic events fired by autofill/autocomplete
		if (!e.key) return;
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
 * Open or focus search when `/` is pressed outside editable controls.
 *
 * The navbrand interaction layer advertises slash-search hints, so this helper
 * keeps the affordance truthful on pages with either the floating Pagefind modal
 * or the dedicated `/search` page.
 */
export function initSlashSearchShortcut(callback: () => void): () => void {
	const handler = (e: KeyboardEvent) => {
		if (!e.key || e.key !== "/") return;
		if (e.ctrlKey || e.metaKey || e.altKey) return;
		if (isEditableShortcutTarget(e.target)) return;

		e.preventDefault();
		callback();
	};

	document.addEventListener("keydown", handler);

	return () => {
		document.removeEventListener("keydown", handler);
	};
}

/**
 * Launch the navbrand terminal from anywhere with Ctrl+Alt+T / Ctrl+Option+T.
 */
export function initTerminalShortcut(): () => void {
	const handler = (e: KeyboardEvent) => {
		if (!e.key || !isTerminalShortcutEvent(e)) return;
		if (isEditableShortcutTarget(e.target)) return;

		e.preventDefault();
		document.dispatchEvent(
			new CustomEvent<NavBrandTerminalOpenDetail>(NAVBRAND_OPEN_TERMINAL_EVENT, {
				detail: {
					source: "keyboard-shortcut",
					trigger: "keyboard",
				},
				bubbles: true,
			})
		);
	};

	document.addEventListener("keydown", handler);

	return () => {
		document.removeEventListener("keydown", handler);
	};
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
