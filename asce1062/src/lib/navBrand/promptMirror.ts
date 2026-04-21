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
	const caret = Math.max(0, Math.min(value.length, caretPosition ?? value.length));
	const beforeCaret = value.slice(0, caret);
	const afterCaret = value.slice(caret);
	const cursorChar = afterCaret[0] ?? completion[0] ?? " ";
	const completionStart = afterCaret.length > 0 ? "" : completion.slice(1);

	return {
		beforeCaret,
		cursorChar,
		afterCaret: afterCaret.slice(1),
		completionAfterCursor: completionStart,
	};
}
