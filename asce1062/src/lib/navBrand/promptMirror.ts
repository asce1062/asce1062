import { splitGraphemes } from "@/lib/textEffects/utils";

export type TerminalPromptMirrorParts = {
	beforeCaret: string;
	cursorChar: string;
	afterCaret: string;
	completionAfterCursor: string;
};

/**
 * Split terminal input into visual mirror parts around the native input caret.
 * The real input keeps browser editing semantics; the mirror uses this pure
 * model to paint our custom block cursor at the same character position.
 */
export function buildTerminalPromptMirrorParts(
	value: string,
	caretPosition: number | null | undefined,
	completion = ""
): TerminalPromptMirrorParts {
	// Native caret offsets sit on code point boundaries, so slicing at the caret is
	// safe. The cell under the block cursor must be a whole grapheme, though: a
	// UTF-16 [0] would paint half an emoji.
	const caret = Math.max(0, Math.min(value.length, caretPosition ?? value.length));
	const beforeCaret = value.slice(0, caret);
	const afterCaret = value.slice(caret);
	const nextGrapheme = splitGraphemes(afterCaret)[0];
	const completionGrapheme = splitGraphemes(completion)[0];
	const cursorChar = nextGrapheme ?? completionGrapheme ?? " ";

	return {
		beforeCaret,
		cursorChar,
		afterCaret: nextGrapheme ? afterCaret.slice(nextGrapheme.length) : "",
		completionAfterCursor: nextGrapheme || !completionGrapheme ? "" : completion.slice(completionGrapheme.length),
	};
}
