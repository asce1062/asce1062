import { describe, expect, it } from "vitest";
import {
	shouldFocusTerminalInput,
	shouldPreserveTerminalOutputSelection,
	shouldRouteTerminalKeyboardToInput,
} from "@/lib/navBrand/terminalFocus";

describe("shouldFocusTerminalInput", () => {
	it("allows focus for explicit open and restore while the terminal window is visible", () => {
		expect(shouldFocusTerminalInput({ open: true, windowHidden: false, reason: "open" })).toBe(true);
		expect(shouldFocusTerminalInput({ open: true, windowHidden: false, reason: "restore" })).toBe(true);
	});

	it("blocks focus when the terminal is minimized, closed, or only rebinding lifecycle handlers", () => {
		expect(shouldFocusTerminalInput({ open: false, windowHidden: true, reason: "open" })).toBe(false);
		expect(shouldFocusTerminalInput({ open: true, windowHidden: true, reason: "restore" })).toBe(false);
		expect(shouldFocusTerminalInput({ open: true, windowHidden: false, reason: "lifecycle" })).toBe(false);
	});

	it("keeps output interaction sticky without stealing focus from controls", () => {
		expect(
			shouldFocusTerminalInput({ open: true, windowHidden: false, targetRole: "content", reason: "interaction" })
		).toBe(true);
		expect(
			shouldFocusTerminalInput({ open: true, windowHidden: false, targetRole: "control", reason: "interaction" })
		).toBe(false);
		expect(
			shouldFocusTerminalInput({ open: true, windowHidden: false, targetRole: "resize", reason: "interaction" })
		).toBe(false);
		expect(
			shouldFocusTerminalInput({ open: true, windowHidden: false, targetRole: "completion", reason: "interaction" })
		).toBe(false);
	});
});

describe("shouldPreserveTerminalOutputSelection", () => {
	it("preserves selection for selectable terminal content only", () => {
		expect(shouldPreserveTerminalOutputSelection("content")).toBe(true);
		expect(shouldPreserveTerminalOutputSelection("input")).toBe(false);
		expect(shouldPreserveTerminalOutputSelection("control")).toBe(false);
		expect(shouldPreserveTerminalOutputSelection("completion")).toBe(false);
		expect(shouldPreserveTerminalOutputSelection("resize")).toBe(false);
		expect(shouldPreserveTerminalOutputSelection("external")).toBe(false);
	});
});

describe("shouldRouteTerminalKeyboardToInput", () => {
	it("routes printable output-area typing back to the terminal input", () => {
		expect(
			shouldRouteTerminalKeyboardToInput({
				open: true,
				windowHidden: false,
				targetRole: "content",
				key: "a",
			})
		).toBe(true);
		expect(
			shouldRouteTerminalKeyboardToInput({
				open: true,
				windowHidden: false,
				targetRole: "content",
				key: "Backspace",
			})
		).toBe(true);
	});

	it("does not intercept shortcuts, hidden windows, or terminal controls", () => {
		expect(
			shouldRouteTerminalKeyboardToInput({
				open: true,
				windowHidden: false,
				targetRole: "content",
				key: "c",
				metaKey: true,
			})
		).toBe(false);
		expect(
			shouldRouteTerminalKeyboardToInput({
				open: true,
				windowHidden: false,
				targetRole: "control",
				key: "a",
			})
		).toBe(false);
		expect(
			shouldRouteTerminalKeyboardToInput({
				open: false,
				windowHidden: true,
				targetRole: "content",
				key: "a",
			})
		).toBe(false);
	});
});
