export type TerminalFocusTargetRole = "input" | "content" | "control" | "resize" | "completion" | "external";

export type TerminalFocusReason = "open" | "restore" | "submit" | "completion" | "interaction" | "lifecycle";

export type TerminalFocusPolicyInput = {
	open: boolean;
	windowHidden: boolean;
	targetRole?: TerminalFocusTargetRole;
	reason: TerminalFocusReason;
};

const FOCUS_PRESERVING_TARGETS = new Set<TerminalFocusTargetRole>(["control", "resize", "completion", "external"]);

export function shouldPreserveTerminalOutputSelection(targetRole: TerminalFocusTargetRole): boolean {
	return targetRole === "content";
}

export function shouldRouteTerminalKeyboardToInput({
	open,
	windowHidden,
	targetRole,
	key,
	ctrlKey = false,
	metaKey = false,
	altKey = false,
}: {
	open: boolean;
	windowHidden: boolean;
	targetRole: TerminalFocusTargetRole;
	key: string;
	ctrlKey?: boolean;
	metaKey?: boolean;
	altKey?: boolean;
}): boolean {
	if (!open || windowHidden) return false;
	if (targetRole !== "content") return false;
	if (ctrlKey || metaKey || altKey) return false;
	return key.length === 1 || key === "Backspace";
}

/**
 * Terminal focus is intentionally sticky only while the full terminal window is
 * visible. Minimized/docked lifecycle work must not focus the input because
 * mobile browsers can interpret that as a request to open the software keyboard.
 */
export function shouldFocusTerminalInput({
	open,
	windowHidden,
	targetRole = "content",
	reason,
}: TerminalFocusPolicyInput): boolean {
	if (!open || windowHidden) return false;
	if (reason === "lifecycle") return false;
	if (FOCUS_PRESERVING_TARGETS.has(targetRole)) return false;
	return true;
}
