import { afterEach, describe, expect, it, vi } from "vitest";
import {
	getSidebarCollapseShortcutLabel,
	initSidebarCollapseShortcut,
	isSidebarCollapseShortcutEvent,
	isTerminalShortcutEvent,
} from "@/scripts/keyboardShortcuts";

describe("isTerminalShortcutEvent", () => {
	it("matches Ctrl+Alt+T / Ctrl+Option+T", () => {
		expect(isTerminalShortcutEvent({ key: "t", ctrlKey: true, altKey: true })).toBe(true);
		expect(isTerminalShortcutEvent({ key: "T", ctrlKey: true, altKey: true })).toBe(true);
	});

	it("rejects incomplete or conflicting modifier combinations", () => {
		expect(isTerminalShortcutEvent({ key: "t", ctrlKey: true, altKey: false })).toBe(false);
		expect(isTerminalShortcutEvent({ key: "t", ctrlKey: false, altKey: true })).toBe(false);
		expect(isTerminalShortcutEvent({ key: "t", ctrlKey: true, altKey: true, shiftKey: true })).toBe(false);
		expect(isTerminalShortcutEvent({ key: "t", ctrlKey: true, altKey: true, metaKey: true })).toBe(false);
		expect(isTerminalShortcutEvent({ key: "k", ctrlKey: true, altKey: true })).toBe(false);
	});
});

describe("isSidebarCollapseShortcutEvent", () => {
	it("matches Cmd+. and Ctrl+.", () => {
		expect(isSidebarCollapseShortcutEvent({ key: ".", metaKey: true })).toBe(true);
		expect(isSidebarCollapseShortcutEvent({ key: ".", ctrlKey: true })).toBe(true);
	});

	it("rejects missing or conflicting modifier combinations", () => {
		expect(isSidebarCollapseShortcutEvent({ key: "." })).toBe(false);
		expect(isSidebarCollapseShortcutEvent({ key: ",", metaKey: true })).toBe(false);
		expect(isSidebarCollapseShortcutEvent({ key: ".", metaKey: true, shiftKey: true })).toBe(false);
		expect(isSidebarCollapseShortcutEvent({ key: ".", ctrlKey: true, altKey: true })).toBe(false);
	});
});

describe("getSidebarCollapseShortcutLabel", () => {
	it("uses the macOS Command symbol for Apple platforms", () => {
		expect(getSidebarCollapseShortcutLabel("MacIntel")).toBe("⌘+.");
		expect(getSidebarCollapseShortcutLabel("iPhone")).toBe("⌘+.");
	});

	it("uses Ctrl for non-Apple platforms", () => {
		expect(getSidebarCollapseShortcutLabel("Win32")).toBe("Ctrl+.");
		expect(getSidebarCollapseShortcutLabel("Linux x86_64")).toBe("Ctrl+.");
	});
});

describe("initSidebarCollapseShortcut", () => {
	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it("registers a global Ctrl/Cmd+. handler and cleans it up", () => {
		let keydownHandler: ((event: KeyboardEvent) => void) | null = null;
		const addEventListener = vi.fn((type: string, handler: EventListenerOrEventListenerObject) => {
			if (type === "keydown") keydownHandler = handler as (event: KeyboardEvent) => void;
		});
		const removeEventListener = vi.fn((type: string, handler: EventListenerOrEventListenerObject) => {
			if (type === "keydown" && handler === keydownHandler) keydownHandler = null;
		});
		vi.stubGlobal("document", { addEventListener, removeEventListener });

		const callback = vi.fn();
		const cleanup = initSidebarCollapseShortcut(callback);
		const preventDefault = vi.fn();
		const handler = keydownHandler as ((event: KeyboardEvent) => void) | null;

		expect(handler).toEqual(expect.any(Function));
		handler?.({ key: ".", ctrlKey: true, preventDefault } as unknown as KeyboardEvent);

		expect(preventDefault).toHaveBeenCalledOnce();
		expect(callback).toHaveBeenCalledOnce();

		cleanup();

		expect(removeEventListener).toHaveBeenCalledWith("keydown", expect.any(Function));
		expect(keydownHandler).toBeNull();
	});
});
