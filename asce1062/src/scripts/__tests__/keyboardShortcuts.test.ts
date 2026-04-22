import { describe, expect, it } from "vitest";
import { isTerminalShortcutEvent } from "@/scripts/keyboardShortcuts";

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
