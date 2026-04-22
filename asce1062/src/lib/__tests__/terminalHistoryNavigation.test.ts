import { describe, expect, it } from "vitest";
import {
	createTerminalHistoryNavigationSession,
	navigateTerminalHistory,
	resetTerminalHistoryNavigationSession,
} from "@/lib/navBrand/historyNavigation";

describe("navigateTerminalHistory", () => {
	it("cycles backward through full command history from an empty input", () => {
		let session = createTerminalHistoryNavigationSession();
		const history = ["help", "theme dark", "cd blog"];

		let result = navigateTerminalHistory({ direction: "previous", history, input: "", session });
		expect(result.value).toBe("cd blog");

		session = result.session;
		result = navigateTerminalHistory({ direction: "previous", history, input: result.value, session });
		expect(result.value).toBe("theme dark");

		session = result.session;
		result = navigateTerminalHistory({ direction: "previous", history, input: result.value, session });
		expect(result.value).toBe("help");
	});

	it("cycles forward toward the original draft and restores it after the newest match", () => {
		let session = createTerminalHistoryNavigationSession();
		const history = ["help", "theme dark", "cd blog"];

		let result = navigateTerminalHistory({ direction: "previous", history, input: "theme", session });
		expect(result.value).toBe("theme dark");

		session = result.session;
		result = navigateTerminalHistory({ direction: "next", history, input: result.value, session });
		expect(result.value).toBe("theme");
		expect(result.session.active).toBe(false);
	});

	it("filters history by the whole draft prefix captured when navigation starts", () => {
		let session = createTerminalHistoryNavigationSession();
		const history = ["theme amber", "theme dark", "theme light dos", "cd blog", "theme light"];

		let result = navigateTerminalHistory({ direction: "previous", history, input: "theme l", session });
		expect(result.value).toBe("theme light");

		session = result.session;
		result = navigateTerminalHistory({ direction: "previous", history, input: result.value, session });
		expect(result.value).toBe("theme light dos");
	});

	it("keeps the original filter stable while cycling through replaced input values", () => {
		let session = createTerminalHistoryNavigationSession();
		const history = ["theme amber", "theme dark", "theme light dos"];

		let result = navigateTerminalHistory({ direction: "previous", history, input: "theme", session });
		expect(result.value).toBe("theme light dos");

		session = result.session;
		result = navigateTerminalHistory({ direction: "previous", history, input: result.value, session });
		expect(result.value).toBe("theme dark");

		session = result.session;
		result = navigateTerminalHistory({ direction: "previous", history, input: result.value, session });
		expect(result.value).toBe("theme amber");
	});

	it("leaves input unchanged when no matching history exists", () => {
		const result = navigateTerminalHistory({
			direction: "previous",
			history: ["help", "cd blog"],
			input: "theme",
			session: createTerminalHistoryNavigationSession(),
		});

		expect(result.value).toBe("theme");
		expect(result.session.active).toBe(false);
	});

	it("resets to an inactive navigation session", () => {
		expect(resetTerminalHistoryNavigationSession()).toEqual({
			active: false,
			draft: "",
			filter: "",
			matches: [],
			index: -1,
		});
	});
});
