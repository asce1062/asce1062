/**
 * Entry Actions
 * Handles guestbook entry action menus: toggle, clipboard, share, anchor highlight
 */

import { copyToClipboard } from "@/scripts/feedbackManager";

const NOTIFICATION_ID = "entry-action-notification";

// AbortController prevents document-level listeners from accumulating across
// Astro soft navigations (initEntryActions is called on every astro:page-load).
let _ac: AbortController | null = null;

/** Close all open action menus */
function closeAllMenus(): void {
	document.querySelectorAll<HTMLButtonElement>(".entry-actions-trigger[aria-expanded='true']").forEach((trigger) => {
		trigger.setAttribute("aria-expanded", "false");
		const menu = trigger.nextElementSibling as HTMLElement | null;
		if (menu) menu.hidden = true;
	});
}

/** Toggle a specific action menu */
function toggleMenu(trigger: HTMLButtonElement): void {
	const isOpen = trigger.getAttribute("aria-expanded") === "true";
	closeAllMenus();
	if (!isOpen) {
		trigger.setAttribute("aria-expanded", "true");
		const menu = trigger.nextElementSibling as HTMLElement | null;
		if (menu) {
			menu.hidden = false;
			// Auto-focus first menu item for keyboard accessibility (ARIA menu pattern)
			const firstItem = menu.querySelector<HTMLElement>('[role="menuitem"]');
			firstItem?.focus();
		}
	}
}

/** Copy entry style JSON to clipboard */
async function handleCopyStyle(button: HTMLElement): Promise<void> {
	const rawStyle = button.dataset.style || "";
	let styleObj: Record<string, string>;

	const defaults = {
		bg: "topography",
		borderColor: "base-300",
		borderWidth: "1px",
		borderStyle: "solid",
		borderRadius: "0rem",
	};

	try {
		styleObj = rawStyle ? { ...defaults, ...JSON.parse(rawStyle) } : defaults;
	} catch {
		styleObj = defaults;
	}

	await copyToClipboard(JSON.stringify(styleObj, null, 2), NOTIFICATION_ID);
}

/** Copy entry message text to clipboard */
async function handleCopyMessage(button: HTMLElement): Promise<void> {
	const message = button.dataset.message || "";
	await copyToClipboard(message, NOTIFICATION_ID);
}

/** Copy a link to /8biticon pre-loaded with this entry's avatar */
async function handleCopyAvatar(button: HTMLElement): Promise<void> {
	const avatarState = button.dataset.avatarState;
	if (!avatarState) return;
	const url = `${window.location.origin}/8biticon?${avatarState}`;
	await copyToClipboard(url, NOTIFICATION_ID);
}

/** Share entry via Web Share API or clipboard fallback */
async function handleShareEntry(button: HTMLElement): Promise<void> {
	const entryId = button.dataset.entryId;
	const entryName = button.dataset.entryName || "someone";
	const permalink = `https://alexmbugua.me/guestbook#entry-${entryId}`;

	if (navigator.share) {
		try {
			await navigator.share({
				title: `Guestbook entry by ${entryName}`,
				url: permalink,
			});
			return;
		} catch (err) {
			// User cancelled or share failed. Fall back to clipboard
			if ((err as DOMException).name === "AbortError") return;
		}
	}

	await copyToClipboard(permalink, NOTIFICATION_ID);
}

/** Dispatch action from a menu item click */
async function dispatchAction(target: HTMLElement): Promise<void> {
	const action = target.dataset.action;
	if (!action) return;

	closeAllMenus();

	switch (action) {
		case "copy-style":
			await handleCopyStyle(target);
			break;
		case "copy-message":
			await handleCopyMessage(target);
			break;
		case "copy-avatar":
			await handleCopyAvatar(target);
			break;
		case "share-entry":
			await handleShareEntry(target);
			break;
	}
}

/** Highlight and scroll to entry if URL has #entry-{id} */
function handleAnchorHighlight(): void {
	const hash = window.location.hash;
	if (!hash.startsWith("#entry-")) return;

	const target = document.querySelector(hash);
	if (!target) return;

	target.scrollIntoView({ behavior: "smooth", block: "center" });
	target.classList.add("entry--highlighted");
	target.addEventListener(
		"animationend",
		() => {
			target.classList.remove("entry--highlighted");
		},
		{ once: true }
	);
}

/** Navigate between menu items with ArrowUp/ArrowDown (ARIA menu keyboard pattern) */
function handleMenuKeyNav(e: KeyboardEvent, menu: HTMLElement): void {
	const items = Array.from(menu.querySelectorAll<HTMLElement>('[role="menuitem"]'));
	if (items.length === 0) return;

	const focused = document.activeElement as HTMLElement | null;
	const idx = focused ? items.indexOf(focused) : -1;

	if (e.key === "ArrowDown") {
		e.preventDefault();
		items[(idx + 1) % items.length]?.focus();
	} else if (e.key === "ArrowUp") {
		e.preventDefault();
		items[(idx - 1 + items.length) % items.length]?.focus();
	}
}

/** Initialize all entry action menus */
export function initEntryActions(): void {
	// Tear down previous document-level listeners before re-init
	_ac?.abort();
	_ac = new AbortController();
	const { signal } = _ac;

	// Menu triggers — per-element listeners, no AbortController needed (elements are replaced on nav)
	document.querySelectorAll<HTMLButtonElement>(".entry-actions-trigger").forEach((trigger) => {
		trigger.addEventListener("click", (e) => {
			e.stopPropagation();
			toggleMenu(trigger);
		});
	});

	// Action buttons
	document.querySelectorAll<HTMLElement>(".entry-action[data-action]").forEach((action) => {
		action.addEventListener("click", (e) => {
			e.stopPropagation();
			dispatchAction(action);
		});
	});

	// Close on outside click
	document.addEventListener(
		"click",
		() => {
			closeAllMenus();
		},
		{ signal }
	);

	// Keyboard: Escape closes menus; ArrowUp/ArrowDown navigate open menus
	document.addEventListener(
		"keydown",
		(e) => {
			if (e.key === "Escape") {
				closeAllMenus();
				return;
			}

			if (e.key === "ArrowDown" || e.key === "ArrowUp") {
				const openMenu = document.querySelector<HTMLElement>(".entry-actions-menu:not([hidden])");
				if (openMenu) handleMenuKeyNav(e, openMenu);
			}
		},
		{ signal }
	);

	// Anchor highlight
	handleAnchorHighlight();
}
