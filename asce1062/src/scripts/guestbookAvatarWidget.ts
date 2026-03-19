/**
 * Guestbook Avatar Widget
 *
 * Wires the guestbook form's AvatarMiniWidget to the avatarStore and handles
 * the opt-in checkbox, hidden input, and random-generation fallback.
 *
 * Opt-in behavior:
 *   - Checking "Include avatar in this entry" saves the current store state to
 *     localStorage (so future visits load the same avatar).
 *   - If opted-in but the user has not interacted with the widget at all AND no
 *     previously saved avatar exists, a notice is shown and a fully random state
 *     (either gender) is generated at submit time.
 *   - The hidden input #avatar-state-input is kept in sync with the store on every
 *     change; it does NOT write to localStorage on its own.
 */

import type { Gender } from "@/data/avatarConfig";
import { getRandomState } from "@/data/avatarConfig";
import { bindAvatarMiniWidget } from "@/scripts/avatarMiniWidget";
import { avatarStore } from "@/scripts/avatarStore";

// Aborted and re-created on each page-load to prevent listener accumulation across navigations.
let _ac: AbortController | null = null;

export function initGuestbookAvatarWidget(): void {
	_ac?.abort();
	_ac = new AbortController();
	const { signal } = _ac;

	const avatarStateInput = document.getElementById("avatar-state-input") as HTMLInputElement | null;
	const optInCheckbox = document.getElementById("avatar-opt-in") as HTMLInputElement | null;
	const randomNotice = document.getElementById("avatar-random-notice") as HTMLElement | null;
	const form = document.getElementById("form") as HTMLFormElement | null;

	if (!avatarStateInput) return;

	// True when the user has previously saved an avatar OR has interacted with the
	// widget this session. When false at submit time, a random fallback is generated.
	let hasDeliberateChoice = avatarStore.isRemembered();

	function updateHiddenInput(): void {
		avatarStateInput!.value = avatarStore.serialize();
	}

	function updateNotice(): void {
		if (!randomNotice || !optInCheckbox) return;
		randomNotice.style.display = optInCheckbox.checked && !hasDeliberateChoice ? "" : "none";
	}

	const widgetAc = bindAvatarMiniWidget("guestbook", {
		onStateChange: () => {
			updateHiddenInput();
			updateNotice();
		},
		onInteract: () => {
			hasDeliberateChoice = true;
			updateNotice();
		},
	});
	// Tear down the mini widget when this initializer is re-run on navigation.
	signal.addEventListener("abort", () => widgetAc.abort(), { once: true });

	// Set initial hidden input value.
	updateHiddenInput();
	updateNotice();

	// Checking opt-in saves the current avatar to localStorage for first-time users only.
	// If a saved avatar already exists, opting in just submits the current in-memory state
	// without overwriting localStorage — so a returning user who randomized before opting in
	// does not lose their saved avatar.
	optInCheckbox?.addEventListener(
		"change",
		() => {
			updateNotice();
			if (optInCheckbox.checked && !avatarStore.isRemembered()) {
				avatarStore.saveToStorage();
			}
		},
		{ signal }
	);

	// At submit time, if opted-in but never interacted, generate a random avatar
	// spanning both genders before the form data is read by the browser.
	// Guard prevents duplicate generation if the submit event fires more than once.
	let submitFallbackApplied = false;
	form?.addEventListener(
		"submit",
		() => {
			if (!optInCheckbox?.checked || hasDeliberateChoice || submitFallbackApplied) return;
			submitFallbackApplied = true;
			const gender: Gender = Math.random() < 0.5 ? "male" : "female";
			const state = getRandomState(gender);
			// set without persist. This is a one-off submit-time generation, not a save.
			avatarStore.set(gender, state);
			avatarStateInput!.value = avatarStore.serialize();
		},
		{ signal }
	);
}
