/**
 * Avatar State Manager
 *
 * Full-page generator state for /8biticon. Manages URL params, layer selection,
 * and delegates persistence + same-page broadcasting to avatarStore.
 *
 * Every mutation (changeGender, updateLayerValue, randomize) calls syncStore(),
 * which writes to the store (and auto-persists to localStorage if the user has a saved avatar)
 * and dispatches "avatar-state-change" so the sidebar mini widget re-renders
 * in real time while the user edits their avatar.
 *
 * On init the constructor reads from avatarStore (which already loaded from
 * localStorage or defaults), then overlays URL params if present.
 */

import type { Gender, AvatarState } from "@/data/avatarConfig";
import { avatarConfig, getDefaultState, getRandomState } from "@/data/avatarConfig";
import { avatarStore } from "@/scripts/avatarStore";

export class AvatarStateManager {
	private currentGender: Gender;
	private currentState: AvatarState;
	private currentLayer: string;
	private genderRadios: NodeListOf<Element>;
	private onStateChange?: () => void | Promise<void>;
	/** True while syncStore() is running. prevents re-entrant AVATAR_CHANGE_EVENT handling. */
	private _isUpdating = false;

	get isUpdating(): boolean {
		return this._isUpdating;
	}

	constructor(_initialGender: Gender = "male") {
		// Bootstrap from store (already loaded from localStorage or defaults).
		this.currentGender = avatarStore.gender;
		this.currentState = { ...avatarStore.state };
		this.currentLayer = avatarConfig[this.currentGender][0].name;
		this.genderRadios = document.querySelectorAll('input[name="gender"]');

		// Overlay URL params if present; otherwise store state is the right starting point.
		this.loadFromURL();
	}

	getGender(): Gender {
		return this.currentGender;
	}

	getState(): AvatarState {
		return this.currentState;
	}

	getCurrentLayer(): string {
		return this.currentLayer;
	}

	setOnStateChange(callback: () => void | Promise<void>): void {
		this.onStateChange = callback;
	}

	private async notifyStateChange(): Promise<void> {
		if (this.onStateChange) {
			await this.onStateChange();
		}
	}

	async changeGender(newGender: Gender): Promise<void> {
		if (this.currentGender === newGender) return;
		this.currentGender = newGender;
		// Prefer a saved avatar for this gender over defaults so switching gender
		// does not discard a previously saved customisation.
		this.currentState = avatarStore.getSavedStateForGender(newGender) ?? getDefaultState(newGender);
		this.currentLayer = avatarConfig[this.currentGender][0].name;
		this.updateURL();
		this.syncStore();
		await this.notifyStateChange();
	}

	setCurrentLayer(layerName: string): void {
		this.currentLayer = layerName;
	}

	async updateLayerValue(layerName: string, value: number): Promise<void> {
		this.currentState[layerName] = value;
		this.updateURL();
		this.syncStore();
		await this.notifyStateChange();
	}

	async randomize(): Promise<void> {
		this.currentState = getRandomState(this.currentGender);
		this.updateURL();
		// Only persist when no saved avatar exists yet (first-time user).
		// If a saved avatar exists, randomize is a preview-only action; the user must click Save to commit.
		this.syncStore({ persist: !avatarStore.isRemembered() });
		await this.notifyStateChange();
	}

	/** Update the browser URL (replaceState). /8biticon-specific. */
	updateURL(): void {
		const parts = avatarConfig[this.currentGender].map((l) => this.currentState[l.name]);
		const avatarString = parts.join("-");
		const url = new URL(window.location.href);
		url.searchParams.set("gender", this.currentGender);
		url.searchParams.set("avatar", avatarString);
		window.history.replaceState({}, "", url.toString());
	}

	getShareURL(): string {
		return window.location.href;
	}

	/**
	 * Apply a state change that originated from an external surface (e.g. sidebar mini widget).
	 * Updates internal state + radio UI without calling syncStore(), preventing a re-entrant
	 * AVATAR_CHANGE_EVENT loop. The caller is responsible for re-rendering.
	 */
	applyExternalChange(newGender: Gender, newState: AvatarState): void {
		const genderChanged = this.currentGender !== newGender;
		this.currentGender = newGender;
		this.currentState = { ...newState };
		if (genderChanged) {
			this.currentLayer = avatarConfig[this.currentGender][0].name;
			// Sync radio buttons to reflect the new gender.
			this.genderRadios.forEach((radio) => {
				const input = radio as HTMLInputElement;
				input.checked = input.value === newGender;
			});
		}
		this.updateURL();
	}

	/**
	 * Push current state to the store. Auto-persists to localStorage if the user
	 * has a saved avatar for the current gender. Also dispatches "avatar-state-change" so
	 * the sidebar mini widget re-renders in real time while the user edits.
	 *
	 * Pass `{ persist: bool }` to override the auto-persist logic. Used by randomize(),
	 * which has its own rule: only persist when no saved avatar exists yet (first-time user).
	 */
	private syncStore({ persist: overridePersist }: { persist?: boolean } = {}): void {
		this._isUpdating = true;
		try {
			const shouldPersist =
				overridePersist !== undefined
					? overridePersist
					: // Auto-persist only for the current gender's saved avatar.
						// Using isRemembered() (any saved avatar) would cause a gender switch
						// to overwrite a saved avatar of the other gender with defaults.
						avatarStore.getSavedStateForGender(this.currentGender) !== null;
			avatarStore.set(this.currentGender, this.currentState, { persist: shouldPersist });
		} finally {
			this._isUpdating = false;
		}
	}

	/**
	 * Overlay URL params onto the current state. Falls through when params are absent
	 * (store already has the correct initial state from localStorage / defaults).
	 * When URL params are present, syncs them into the store without persisting
	 * (a share link should not overwrite the user's saved avatar).
	 */
	private loadFromURL(): void {
		const url = new URL(window.location.href);
		const genderParam = url.searchParams.get("gender") as Gender;
		const avatarParam = url.searchParams.get("avatar");

		// No URL params → store state is already correct. Nothing to do.
		if (!genderParam && !avatarParam) return;

		if (genderParam && (genderParam === "male" || genderParam === "female")) {
			this.currentGender = genderParam;
			this.genderRadios.forEach((radio) => {
				const input = radio as HTMLInputElement;
				input.checked = input.value === genderParam;
			});
		}

		if (avatarParam) {
			const parts = avatarParam.split("-").map(Number);
			const layers = avatarConfig[this.currentGender];
			if (parts.length === layers.length) {
				layers.forEach((layer, i) => {
					const v = parts[i];
					if (v >= 1 && v <= layer.count) this.currentState[layer.name] = v;
				});
			}
		}

		// Sync URL state into store (no persist. share links don't overwrite saved avatar).
		avatarStore.set(this.currentGender, this.currentState, { persist: false });
	}
}
