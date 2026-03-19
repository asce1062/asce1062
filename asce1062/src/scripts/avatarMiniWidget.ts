/**
 * Avatar Mini Widget Controller
 *
 * Binds any rendered AvatarMiniWidget.astro element (identified by
 * [data-widget-id]) to the avatarStore. Multiple instances on the same page
 * (sidebar + guestbook) stay in sync automatically because they all listen to
 * the same "avatar-state-change" event.
 *
 * Usage:
 *   const ac = bindAvatarMiniWidget("sidebar");
 *   // later, on cleanup:
 *   ac.abort();
 *
 *   bindAvatarMiniWidget("guestbook", {
 *     onStateChange: (gender, state) => { ... },
 *     onInteract:    () => { ... },
 *   });
 */

import type { Gender, AvatarState } from "@/data/avatarConfig";
import { getDefaultState, getRandomState } from "@/data/avatarConfig";
import { avatarStore, AVATAR_CHANGE_EVENT } from "@/scripts/avatarStore";
import { renderToCanvas, buildAvatarURL } from "@/scripts/avatarRenderCore";
import { flashCheckIcon } from "@/scripts/feedbackManager";

export interface MiniWidgetOptions {
	/** Called after every re-render (store change from any source). */
	onStateChange?: (gender: Gender, state: AvatarState) => void;
	/** Called only when the user directly clicks randomize or a gender button. */
	onInteract?: () => void;
}

export function bindAvatarMiniWidget(instanceId: string, options: MiniWidgetOptions = {}): AbortController {
	const ac = new AbortController();
	const { signal } = ac;

	const root = document.querySelector<HTMLElement>(`[data-widget-id="${instanceId}"]`);
	if (!root) return ac;

	// Guard against duplicate binding on the same node.
	if (root.dataset.widgetBound === "true") {
		console.warn(`[avatarMiniWidget] Widget "${instanceId}" already bound. Call abort() before rebinding.`);
	}
	root.dataset.widgetBound = "true";
	signal.addEventListener("abort", () => delete root.dataset.widgetBound, { once: true });

	const canvas = root.querySelector<HTMLCanvasElement>("canvas");
	const link = root.querySelector<HTMLAnchorElement>(".avatar-mini-edit");
	const randomizeBtn = root.querySelector<HTMLButtonElement>(".avatar-mini-randomize");
	const saveBtn = root.querySelector<HTMLButtonElement>(".avatar-mini-save");
	const genderBtns = root.querySelectorAll<HTMLButtonElement>(".avatar-mini-gender");

	if (!canvas) return ac;

	function setActiveGender(g: Gender): void {
		genderBtns.forEach((b) => b.classList.toggle("nav-avatar-btn--active", b.dataset.gender === g));
	}

	// Sequence counter to discard stale async renders (e.g. rapid randomize/gender clicks).
	let renderSeq = 0;

	async function renderFromStore(): Promise<void> {
		const seq = ++renderSeq;
		const { gender, state } = avatarStore;
		await renderToCanvas(canvas!, gender, state);
		if (seq !== renderSeq) return; // a newer render completed; discard this stale result
		if (link) link.href = buildAvatarURL(gender, state);
		setActiveGender(gender);
		options.onStateChange?.(gender, state);
	}

	// Initial render from current store state.
	renderFromStore().catch((err) => console.error(`[avatarMiniWidget] Initial render failed (${instanceId}):`, err));

	// Re-render on every store change (from any widget on the page or cross-tab).
	window.addEventListener(
		AVATAR_CHANGE_EVENT,
		() => renderFromStore().catch((err) => console.error(`[avatarMiniWidget] Re-render failed (${instanceId}):`, err)),
		{ signal }
	);

	// Randomize. Only persists to localStorage when no saved avatar exists yet (first-time user).
	// If a saved avatar exists, randomize is a preview-only action; the user must click Save to commit.
	randomizeBtn?.addEventListener(
		"click",
		() => {
			options.onInteract?.();
			const newState = getRandomState(avatarStore.gender);
			avatarStore.set(avatarStore.gender, newState, { persist: !avatarStore.isRemembered() });
		},
		{ signal }
	);

	// Save to localStorage. Toggle floppy → check → floppy as feedback
	saveBtn?.addEventListener(
		"click",
		() => {
			avatarStore.saveToStorage();
			const saveIcon = saveBtn.querySelector<HTMLElement>(".avatar-mini-save-icon");
			const checkIcon = saveBtn.querySelector<HTMLElement>(".avatar-mini-save-check");
			if (saveIcon && checkIcon) flashCheckIcon(saveIcon, checkIcon);
		},
		{ signal }
	);

	// Gender switch. Validate markup value before treating as domain type.
	// Mirrors AvatarStateManager.changeGender: prefer a saved avatar for the target gender
	// over defaults, and only persist when a saved avatar already exists for that gender.
	// This prevents a gender switch from overwriting a saved avatar of the other gender.
	genderBtns.forEach((btn) => {
		btn.addEventListener(
			"click",
			() => {
				const next = btn.dataset.gender;
				if (next !== "male" && next !== "female") return;
				if (next === avatarStore.gender) return;
				options.onInteract?.();
				const savedForNext = avatarStore.getSavedStateForGender(next);
				avatarStore.set(next, savedForNext ?? getDefaultState(next), { persist: savedForNext !== null });
			},
			{ signal }
		);
	});

	return ac;
}
