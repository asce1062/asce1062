import { beforeEach, describe, expect, it, vi } from "vitest";

interface BrowserHarness {
	attributes: Record<string, string>;
	setSearch: (search: string) => void;
	storage: Map<string, string>;
}

function setupBrowserGlobals(search: string): BrowserHarness {
	const attributes: Record<string, string> = {};
	const url = new URL(`https://example.test/style${search}#top`);
	let currentUrl = url;
	let historyState: unknown = null;

	const icon = {
		classList: {
			add: vi.fn(),
			remove: vi.fn(),
		},
	};

	const storage = new Map<string, string>();

	vi.stubGlobal("localStorage", {
		getItem: vi.fn((key: string) => storage.get(key) ?? null),
		setItem: vi.fn((key: string, value: string) => storage.set(key, value)),
		removeItem: vi.fn((key: string) => storage.delete(key)),
	});

	vi.stubGlobal("document", {
		documentElement: {
			setAttribute: vi.fn((name: string, value: string) => {
				attributes[name] = value;
			}),
			getAttribute: vi.fn((name: string) => attributes[name] ?? null),
			removeAttribute: vi.fn((name: string) => {
				delete attributes[name];
			}),
		},
		dispatchEvent: vi.fn(),
		getElementById: vi.fn((id: string) => (id === "toggleIcon" ? icon : null)),
	});

	vi.stubGlobal("window", {
		get location() {
			return currentUrl;
		},
		matchMedia: vi.fn(() => ({
			matches: true,
		})),
		history: {
			get state() {
				return historyState;
			},
			replaceState: vi.fn((state: unknown, _title: string, nextUrl: string) => {
				currentUrl = new URL(nextUrl, currentUrl);
				historyState = state;
			}),
		},
	});

	vi.stubGlobal(
		"requestAnimationFrame",
		vi.fn((callback: FrameRequestCallback) => {
			callback(0);
			return 0;
		})
	);

	return {
		attributes,
		setSearch(nextSearch: string) {
			currentUrl = new URL(`https://example.test/style${nextSearch}#top`);
		},
		storage,
	};
}

describe("themeManager URL theme overrides", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
		vi.resetModules();
	});

	it("keeps the full URL but stops using the URL theme after a manual toggle", async () => {
		setupBrowserGlobals("?theme=dark&flavor=crt-green");
		const { handleThemeToggle, initThemeFromUrl, getCurrentTheme } = await import("@/scripts/themeManager");

		handleThemeToggle();
		initThemeFromUrl();

		expect(window.location.search).toBe("?theme=dark&flavor=crt-green");
		expect(getCurrentTheme()).toBe("light");
		expect(document.documentElement.getAttribute("data-theme")).toBe("light");
	});

	it("persists URL flavor so later theme-only URLs retain the active flavor", async () => {
		const { setSearch, storage } = setupBrowserGlobals("?theme=light&flavor=amber");
		const { initThemeFromUrl } = await import("@/scripts/themeManager");

		initThemeFromUrl();
		setSearch("?theme=dark");
		initThemeFromUrl();

		expect(storage.get("theme-flavor")).toBe("amber");
		expect(document.documentElement.getAttribute("data-flavor")).toBe("amber");
	});
});
