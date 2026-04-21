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
