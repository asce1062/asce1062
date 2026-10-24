import { describe, expect, it } from "vitest";
import { buildTerminalPromptMirrorParts } from "@/lib/navBrand/promptMirror";

describe("buildTerminalPromptMirrorParts", () => {
	it("places the block cursor over the character at the native caret", () => {
		expect(buildTerminalPromptMirrorParts("theme light dos", 6)).toEqual({
			beforeCaret: "theme ",
			cursorChar: "l",
			afterCaret: "ight dos",
			completionAfterCursor: "",
		});
	});

	it("uses the first suggestion character as the cursor when the caret is at the end", () => {
		expect(buildTerminalPromptMirrorParts("theme light d", 13, "os")).toEqual({
			beforeCaret: "theme light d",
			cursorChar: "o",
			afterCaret: "",
			completionAfterCursor: "s",
		});
	});

	it("keeps an occupied cursor cell at the end of input without a suggestion", () => {
		expect(buildTerminalPromptMirrorParts("help", 99)).toEqual({
			beforeCaret: "help",
			cursorChar: " ",
			afterCaret: "",
			completionAfterCursor: "",
		});
	});
});

describe("buildTerminalPromptMirrorParts with emoji", () => {
	it("puts a whole emoji under the block cursor, never half a surrogate pair", () => {
		const parts = buildTerminalPromptMirrorParts("search 🚀 now", 7);
		expect(parts.cursorChar).toBe("🚀");
		expect(parts.afterCaret).toBe(" now");
	});

	it("keeps multi-code-point graphemes together", () => {
		const family = "👨‍👩‍👧";
		const parts = buildTerminalPromptMirrorParts(`a${family}b`, 1);
		expect(parts.cursorChar).toBe(family);
		expect(parts.afterCaret).toBe("b");
	});

	it("takes a whole grapheme from the completion when the caret is at the end", () => {
		const parts = buildTerminalPromptMirrorParts("go", 2, "🚀ship");
		expect(parts.cursorChar).toBe("🚀");
		expect(parts.completionAfterCursor).toBe("ship");
	});
});
