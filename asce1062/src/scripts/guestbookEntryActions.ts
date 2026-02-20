/**
 * Entry Actions
 * Handles guestbook entry action menus: toggle, clipboard, share, anchor highlight
 */

import { copyToClipboard } from "@/scripts/shareManager";

const NOTIFICATION_ID = "entry-action-notification";

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
		if (menu) menu.hidden = false;
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
		borderRadius: "0.25rem",
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
			// User cancelled or share failed — fall back to clipboard
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

/** Initialize all entry action menus */
export function initEntryActions(): void {
	// Menu triggers
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
	document.addEventListener("click", () => {
		closeAllMenus();
	});

	// Close on Escape
	document.addEventListener("keydown", (e) => {
		if (e.key === "Escape") closeAllMenus();
	});

	// Anchor highlight
	handleAnchorHighlight();
}
