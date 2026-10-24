import { describe, it, expect } from "vitest";
import {
	cellKey,
	emptyFlammableAnchor,
	findIgnitedCells,
	parseCellKey,
	resolveHeldCells,
	toCell,
	type FlammableAnchor,
} from "@/scripts/burn404flammable";

function makeAnchor(keys: string[], width = 100): FlammableAnchor {
	const points = keys.map(parseCellKey);
	return {
		cells: new Set(keys),
		width,
		minX: Math.min(...points.map((p) => p.x)),
		maxX: Math.max(...points.map((p) => p.x)),
		minY: Math.min(...points.map((p) => p.y)),
		maxY: Math.max(...points.map((p) => p.y)),
	};
}

describe("cell keys", () => {
	it("round-trips through cellKey / parseCellKey, including negatives", () => {
		expect(parseCellKey(cellKey(-3, 12))).toEqual({ x: -3, y: 12 });
	});

	it("toCell floors viewport pixels into fire cells", () => {
		expect(toCell(7.9, 8, 4)).toEqual({ x: 1, y: 2 });
		expect(toCell(-0.5, 0, 4)).toEqual({ x: -1, y: 0 });
	});
});

describe("findIgnitedCells", () => {
	const anchor = makeAnchor(["0,0", "1,0", "5,0"]);

	it("ignites flammable cells within the radius, relative to the anchor origin", () => {
		// Anchor origin at (10, 20); cursor over relative (0, 0).
		const ignited = findIgnitedCells(anchor, { x: 10, y: 20 }, { x: 10, y: 20 }, 1);
		expect(ignited.sort()).toEqual(["0,0", "1,0"]);
	});

	it("ignores non-flammable cells and cells outside the radius", () => {
		expect(findIgnitedCells(anchor, { x: 0, y: 0 }, { x: 3, y: 0 }, 1)).toEqual([]);
	});

	it("uses a circular radius, not a square", () => {
		const corner = makeAnchor(["2,2"]);
		expect(findIgnitedCells(corner, { x: 0, y: 0 }, { x: 0, y: 0 }, 2)).toEqual([]);
		expect(findIgnitedCells(corner, { x: 0, y: 0 }, { x: 1, y: 1 }, 2)).toEqual(["2,2"]);
	});

	it("returns nothing when the cursor is far outside the anchor bounds", () => {
		expect(findIgnitedCells(anchor, { x: 0, y: 0 }, { x: 0, y: 50 }, 2)).toEqual([]);
	});
});

describe("resolveHeldCells", () => {
	it("translates burns to the anchor's current origin (burns follow scroll/layout)", () => {
		const anchor = makeAnchor(["0,0", "1,0"]);
		const burning = new Set(["0,0", "1,0"]);
		expect(resolveHeldCells(anchor, burning, { x: 5, y: 5 }, 100, 100)).toEqual(["5,5", "6,5"]);
		expect(resolveHeldCells(anchor, burning, { x: 5, y: 2 }, 100, 100)).toEqual(["5,2", "6,2"]);
	});

	it("masks burn memory by current ink (a removed glyph stops burning)", () => {
		const anchor = makeAnchor(["1,0"]);
		const burning = new Set(["0,0", "1,0"]);
		expect(resolveHeldCells(anchor, burning, { x: 0, y: 0 }, 100, 100)).toEqual(["1,0"]);
	});

	it("re-ignites remembered cells once ink returns", () => {
		const burning = new Set(["0,0"]);
		expect(resolveHeldCells(makeAnchor(["3,3"]), burning, { x: 0, y: 0 }, 100, 100)).toEqual([]);
		expect(resolveHeldCells(makeAnchor(["0,0"]), burning, { x: 0, y: 0 }, 100, 100)).toEqual(["0,0"]);
	});

	it("holds nothing for an empty (no-ink) anchor, keeping memory intact", () => {
		const burning = new Set(["0,0"]);
		expect(resolveHeldCells(emptyFlammableAnchor(100), burning, { x: 0, y: 0 }, 10, 10)).toEqual([]);
		expect(burning.size).toBe(1);
	});

	it("clips cells that fall outside the fire buffer", () => {
		const anchor = makeAnchor(["0,0", "0,1"]);
		const burning = new Set(["0,0", "0,1"]);
		expect(resolveHeldCells(anchor, burning, { x: 0, y: -1 }, 10, 10)).toEqual(["0,0"]);
		expect(resolveHeldCells(anchor, burning, { x: 10, y: 0 }, 10, 10)).toEqual([]);
	});
});
