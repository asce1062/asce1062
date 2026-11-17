import { describe, expect, it } from "vitest";
import { MAX_TOC_DEPTH, limitTocDepth } from "@/lib/content/toc";
import type { TableOfContents } from "@/types";

const tree: TableOfContents = [
	{
		value: "One",
		depth: 2,
		id: "one",
		children: [
			{
				value: "One A",
				depth: 3,
				id: "one-a",
				children: [
					{
						value: "One A i",
						depth: 4,
						id: "one-a-i",
						children: [{ value: "One A i x", depth: 5, id: "one-a-i-x" }],
					},
				],
			},
		],
	},
	{ value: "Two", depth: 2, id: "two" },
];

describe("limitTocDepth", () => {
	it("shows three nested levels by default", () => {
		expect(MAX_TOC_DEPTH).toBe(3);
	});

	it("keeps entries up to the limit and drops deeper ones", () => {
		const limited = limitTocDepth(tree, MAX_TOC_DEPTH);
		const grandchild = limited[0]?.children?.[0]?.children?.[0];

		expect(limited.map((entry) => entry.id)).toEqual(["one", "two"]);
		expect(limited[0]?.children?.[0]?.id).toBe("one-a");
		expect(grandchild?.id).toBe("one-a-i");
		expect(grandchild?.children).toEqual([]);
	});

	it("leaves a tree that is already within the limit unchanged", () => {
		const shallow: TableOfContents = [{ value: "One", depth: 2, id: "one", children: [{ value: "A", depth: 3 }] }];

		expect(limitTocDepth(shallow, MAX_TOC_DEPTH)).toEqual(shallow);
	});

	it("returns nothing for a limit below one", () => {
		expect(limitTocDepth(tree, 0)).toEqual([]);
	});

	it("does not modify its input", () => {
		const before = JSON.stringify(tree);
		limitTocDepth(tree, 1);

		expect(JSON.stringify(tree)).toBe(before);
	});
});
