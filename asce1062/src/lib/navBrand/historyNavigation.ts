export type TerminalHistoryNavigationDirection = "previous" | "next";

export type TerminalHistoryNavigationSession = {
	active: boolean;
	draft: string;
	filter: string;
	matches: string[];
	index: number;
};

export function createTerminalHistoryNavigationSession(): TerminalHistoryNavigationSession {
	return {
		active: false,
		draft: "",
		filter: "",
		matches: [],
		index: -1,
	};
}

export function resetTerminalHistoryNavigationSession(): TerminalHistoryNavigationSession {
	return createTerminalHistoryNavigationSession();
}

function normalizeHistoryPrefix(value: string): string {
	return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function getHistoryMatches(history: readonly string[], filter: string): string[] {
	const normalizedFilter = normalizeHistoryPrefix(filter);
	const newestFirst = [...history].reverse();
	if (!normalizedFilter) return newestFirst;
	return newestFirst.filter((command) => normalizeHistoryPrefix(command).startsWith(normalizedFilter));
}

export function navigateTerminalHistory(options: {
	direction: TerminalHistoryNavigationDirection;
	history: readonly string[];
	input: string;
	session: TerminalHistoryNavigationSession;
}): { value: string; session: TerminalHistoryNavigationSession } {
	const { direction, history, input, session } = options;
	const activeSession = session.active
		? session
		: {
				active: true,
				draft: input,
				filter: input,
				matches: getHistoryMatches(history, input),
				index: -1,
			};

	if (activeSession.matches.length === 0) {
		return {
			value: input,
			session: createTerminalHistoryNavigationSession(),
		};
	}

	if (direction === "previous") {
		const index = Math.min(activeSession.index + 1, activeSession.matches.length - 1);
		return {
			value: activeSession.matches[index] ?? input,
			session: {
				...activeSession,
				index,
			},
		};
	}

	const index = activeSession.index - 1;
	if (index < 0) {
		return {
			value: activeSession.draft,
			session: createTerminalHistoryNavigationSession(),
		};
	}

	return {
		value: activeSession.matches[index] ?? input,
		session: {
			...activeSession,
			index,
		},
	};
}
