/**
 * Avatar Store
 *
 * Singleton state bus for the current avatar selection.
 * Single source of truth shared across every avatar surface
 *
 * Persistence (localStorage["avatar-state"]):
 *   - Reads on init; sets initial state.
 *   - Writes only when `persist: true` is passed to set().
 *   - Callers pass persist: avatarStore.isRemembered() to auto-save only when
 *     the user has previously saved an avatar (i.e. a value exists in localStorage).
 *
 * Sync:
 *   - Same-page: every set() dispatches CustomEvent("avatar-state-change") on window.
 *     All widgets listening on the same page re-render from the store immediately.
 *   - Cross-tab: window.storage fires when another tab writes avatar-state.
 *     The store updates its own state and re-dispatches the custom event locally,
 *     so same-page listeners react the same way regardless of the change source.
 *
 * Storage format: "gender=male&avatar=3-54-12-14-15-21"
 */

import type { Gender, AvatarState } from "@/data/avatarConfig";
import { getDefaultState } from "@/data/avatarConfig";
import { getPref, setPref, PREF_KEYS } from "@/lib/prefs";
import { serializeAvatarState, parseAvatarState } from "@/scripts/avatarRenderCore";

export const AVATAR_CHANGE_EVENT = "avatar-state-change";

export interface AvatarChangeDetail {
	gender: Gender;
	state: AvatarState;
}

class AvatarStore {
	private _gender: Gender = "male";
	private _state: AvatarState = getDefaultState("male");

	constructor() {
		const saved = getPref(PREF_KEYS.avatarState);
		if (saved) {
			const parsed = parseAvatarState(saved);
			if (parsed) {
				this._gender = parsed.gender;
				this._state = { ...parsed.state };
			}
		}

		// Cross-tab sync: when another tab writes avatar-state, update our in-memory
		// state and re-dispatch locally so all same-page listeners react uniformly.
		window.addEventListener("storage", (e) => {
			if (e.key !== PREF_KEYS.avatarState) return;
			// Another tab cleared avatar storage. Keep the current in-memory avatar visible
			// rather than resetting to defaults. The user is likely still in an active session.
			// isRemembered() will now return false, but the visible avatar has not changed,
			// so we do not dispatch here.
			if (e.newValue === null) return;
			const parsed = parseAvatarState(e.newValue);
			if (!parsed) return;
			this._gender = parsed.gender;
			this._state = { ...parsed.state };
			this._dispatch();
		});
	}

	get gender(): Gender {
		return this._gender;
	}

	get state(): AvatarState {
		return { ...this._state };
	}

	/** True when the user has previously saved an avatar to localStorage. */
	isRemembered(): boolean {
		return getPref(PREF_KEYS.avatarState) !== null;
	}

	/**
	 * Return the persisted avatar state regardless of gender.
	 * Returns null when the user has not explicitly saved an avatar.
	 */
	getSavedState(): { gender: Gender; state: AvatarState } | null {
		const saved = getPref(PREF_KEYS.avatarState);
		if (!saved) return null;
		const parsed = parseAvatarState(saved);
		if (!parsed) return null;
		return { gender: parsed.gender, state: { ...parsed.state } };
	}

	/**
	 * Return the persisted avatar state if it was saved for the given gender.
	 * Returns null if nothing is saved or the saved avatar is for a different gender.
	 * Use this to prefer a saved avatar over defaults when switching gender.
	 */
	getSavedStateForGender(gender: Gender): AvatarState | null {
		const parsed = this.getSavedState();
		if (!parsed || parsed.gender !== gender) return null;
		return { ...parsed.state };
	}

	/** Reset transient in-memory state to the explicit saved avatar, or defaults when unsaved. */
	resetToSavedOrDefault({ dispatch = true }: { dispatch?: boolean } = {}): void {
		const saved = this.getSavedState();
		this._gender = saved?.gender ?? "male";
		this._state = saved ? { ...saved.state } : getDefaultState(this._gender);
		if (dispatch) {
			this._dispatch();
		}
	}

	/**
	 * Update state. Always dispatches "avatar-state-change" for same-page sync.
	 * Pass { persist: true } to also write to localStorage.
	 */
	set(gender: Gender, state: AvatarState, { persist = false }: { persist?: boolean } = {}): void {
		this._gender = gender;
		this._state = { ...state };
		if (persist) {
			setPref(PREF_KEYS.avatarState, serializeAvatarState(gender, state));
		}
		this._dispatch();
	}

	/** Explicitly commit current state to localStorage (called by Save buttons). */
	saveToStorage(): void {
		setPref(PREF_KEYS.avatarState, serializeAvatarState(this._gender, this._state));
		// Dispatch so any listener that reacts to saved/remembered state stays consistent.
		this._dispatch();
	}

	/** Serialize current state to the storage string format. */
	serialize(): string {
		return serializeAvatarState(this._gender, this._state);
	}

	private _dispatch(): void {
		const detail: AvatarChangeDetail = { gender: this._gender, state: { ...this._state } };
		window.dispatchEvent(new CustomEvent<AvatarChangeDetail>(AVATAR_CHANGE_EVENT, { detail }));
	}
}

// Singleton: evaluated once per page load, shared across all importing modules.
export const avatarStore = new AvatarStore();
