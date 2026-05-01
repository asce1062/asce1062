import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDefaultState, type AvatarState } from "@/data/avatarConfig";
import { PREF_KEYS } from "@/lib/prefs";
import { serializeAvatarState } from "@/scripts/avatarRenderCore";

class TestStorage {
	private store = new Map<string, string>();

	getItem(key: string): string | null {
		return this.store.get(key) ?? null;
	}

	setItem(key: string, value: string): void {
		this.store.set(key, value);
	}

	removeItem(key: string): void {
		this.store.delete(key);
	}

	clear(): void {
		this.store.clear();
	}
}

function makeState(values: number[]): AvatarState {
	return {
		face: values[0],
		clothes: values[1],
		hair: values[2],
		eye: values[3],
		mouth: values[4],
		background: values[5],
	};
}

function setupBrowser(href = "https://example.com/8biticon"): TestStorage {
	const storage = new TestStorage();
	const listeners = new Map<string, EventListener[]>();
	const history = {
		replaceState: vi.fn((_state: unknown, _unused: string, url: string) => {
			window.location.href = url;
		}),
	};

	vi.stubGlobal("localStorage", storage);
	vi.stubGlobal(
		"CustomEvent",
		class CustomEvent<T = unknown> extends Event {
			detail: T;

			constructor(type: string, init?: CustomEventInit<T>) {
				super(type);
				this.detail = init?.detail as T;
			}
		}
	);
	vi.stubGlobal("document", {
		querySelectorAll: vi.fn(() => []),
	});
	vi.stubGlobal("window", {
		location: { href },
		history,
		addEventListener: vi.fn((type: string, listener: EventListener) => {
			const current = listeners.get(type) ?? [];
			current.push(listener);
			listeners.set(type, current);
		}),
		dispatchEvent: vi.fn((event: Event) => {
			for (const listener of listeners.get(event.type) ?? []) {
				listener(event);
			}
			return true;
		}),
	});

	return storage;
}

async function loadModules() {
	vi.resetModules();
	const [{ AvatarStateManager }, { avatarStore }] = await Promise.all([
		import("@/scripts/avatarStateManager"),
		import("@/scripts/avatarStore"),
	]);
	return { AvatarStateManager, avatarStore };
}

describe("AvatarStateManager", () => {
	beforeEach(() => {
		setupBrowser();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("starts from defaults when only unsaved in-memory avatar state exists", async () => {
		const { AvatarStateManager, avatarStore } = await loadModules();
		avatarStore.set("male", makeState([1, 1, 1, 1, 1, 1]));

		const manager = new AvatarStateManager("male");

		expect(manager.getGender()).toBe("male");
		expect(manager.getState()).toEqual(getDefaultState("male"));
	});

	it("starts from localStorage when a saved avatar exists", async () => {
		const saved = serializeAvatarState("female", makeState([4, 20, 10, 12, 3, 2]));
		localStorage.setItem(PREF_KEYS.avatarState, saved);
		const { AvatarStateManager } = await loadModules();

		const manager = new AvatarStateManager("male");

		expect(manager.getGender()).toBe("female");
		expect(manager.getState()).toEqual(makeState([4, 20, 10, 12, 3, 2]));
	});

	it("does not write exploratory layer changes into the browser URL", async () => {
		const { AvatarStateManager } = await loadModules();
		const manager = new AvatarStateManager("male");

		await manager.updateLayerValue("face", 1);

		expect(window.history.replaceState).not.toHaveBeenCalled();
		expect(window.location.href).toBe("https://example.com/8biticon");
	});

	it("can reset unsaved in-memory avatar state back to saved/default source", async () => {
		const { avatarStore } = await loadModules();
		avatarStore.set("male", makeState([1, 1, 1, 1, 1, 1]));

		avatarStore.resetToSavedOrDefault();

		expect(avatarStore.gender).toBe("male");
		expect(avatarStore.state).toEqual(getDefaultState("male"));
	});
});
