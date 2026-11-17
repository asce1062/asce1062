import { describe, expect, it } from "vitest";
import { serializeStyle } from "@/lib/haunted/serializeStyle";

describe("serializeStyle", () => {
	it("serialises camelCase and custom properties", () => {
		expect(
			serializeStyle({
				display: "flex",
				"--pattern-url": "url(/notecards/dots.svg)",
				borderColor: "var(--color-primary)",
				borderRadius: "8px",
				padding: "1rem 2rem",
			})
		).toBe(
			"display: flex; --pattern-url: url(/notecards/dots.svg); border-color: var(--color-primary); border-radius: 8px; padding: 1rem 2rem"
		);
	});

	it("keeps custom property names case-sensitive", () => {
		expect(serializeStyle({ "--myToken": "1px" })).toBe("--myToken: 1px");
	});

	it("returns an empty string for an empty object", () => {
		expect(serializeStyle({})).toBe("");
	});

	it.each([
		["a second declaration", "red; background: url(https://evil.example/x)"],
		["a block", "red } body { display: none"],
		["a comment opener", "red /* swallow"],
		["an escape", "r\\65 d"],
		["markup", "red</style><script>"],
		["a line break", "red\ncolor: blue"],
		["an unclosed bracket", "url(/x.svg"],
		["an unclosed quote", '"Fira Code'],
		["an empty value", "   "],
	])("drops a value containing %s", (_label, value) => {
		expect(serializeStyle({ color: value, padding: "1rem" })).toBe("padding: 1rem");
	});

	it("drops non-string values", () => {
		expect(serializeStyle({ width: 12 as unknown as string, padding: "1rem" })).toBe("padding: 1rem");
	});

	it.each(["color: red; background", "border radius", "1color", "--bad name", ""])(
		"drops the invalid property name %j",
		(name) => {
			expect(serializeStyle({ [name]: "red", padding: "1rem" })).toBe("padding: 1rem");
		}
	);

	it("keeps balanced quotes and nested functions", () => {
		expect(serializeStyle({ fontFamily: '"Fira Code", monospace', width: "calc(100% - (2 * 1rem))" })).toBe(
			'font-family: "Fira Code", monospace; width: calc(100% - (2 * 1rem))'
		);
	});
});
