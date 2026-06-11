import { describe, it, expect } from "vitest";
import { initFire, updateFire, PALETTE, MAX_INTENSITY } from "@/scripts/burn404";

describe("PALETTE", () => {
	it("has MAX_INTENSITY + 1 entries", () => {
		expect(PALETTE.length).toBe(MAX_INTENSITY + 1);
	});

	it("first entry is fully transparent", () => {
		const [, , , a] = PALETTE[0];
		expect(a).toBe(0);
	});

	it("last entry is white and opaque", () => {
		const [r, g, b, a] = PALETTE[MAX_INTENSITY];
		expect(r).toBe(255);
		expect(g).toBe(255);
		expect(b).toBe(255);
		expect(a).toBe(255);
	});
});

describe("initFire", () => {
	it("returns a buffer of width * height zeros except the bottom row", () => {
		const buf = initFire(4, 3);
		expect(buf).toHaveLength(12);
		// Top two rows = 0
		for (let i = 0; i < 8; i++) {
			expect(buf[i]).toBe(0);
		}
		// Bottom row = MAX_INTENSITY
		for (let i = 8; i < 12; i++) {
			expect(buf[i]).toBe(MAX_INTENSITY);
		}
	});

	it("uses provided intensity override", () => {
		const buf = initFire(3, 2, 10);
		expect(buf[3]).toBe(10);
		expect(buf[4]).toBe(10);
		expect(buf[5]).toBe(10);
	});
});

describe("updateFire", () => {
	it("returns a buffer of the same length", () => {
		const buf = initFire(8, 5);
		const next = updateFire(buf, 8, 5, MAX_INTENSITY, true);
		expect(next).toHaveLength(40);
	});

	it("bottom row stays at MAX_INTENSITY when fireEnabled", () => {
		const buf = initFire(6, 4);
		const next = updateFire(buf, 6, 4, MAX_INTENSITY, true);
		for (let x = 0; x < 6; x++) {
			expect(next[(4 - 1) * 6 + x]).toBe(MAX_INTENSITY);
		}
	});

	it("all cells clamp to >= 0", () => {
		const buf = initFire(6, 4);
		const next = updateFire(buf, 6, 4, MAX_INTENSITY, true);
		for (const v of next) {
			expect(v).toBeGreaterThanOrEqual(0);
		}
	});

	it("all cells clamp to <= MAX_INTENSITY", () => {
		const buf = initFire(6, 4);
		const next = updateFire(buf, 6, 4, MAX_INTENSITY, true);
		for (const v of next) {
			expect(v).toBeLessThanOrEqual(MAX_INTENSITY);
		}
	});

	it("extinguishes source row when fireEnabled=false", () => {
		const buf = initFire(4, 3);
		// Run 100 iterations with fire off; the bottom should eventually decay.
		let b = buf;
		for (let i = 0; i < 100; i++) {
			b = updateFire(b, 4, 3, MAX_INTENSITY, false);
		}
		for (let x = 0; x < 4; x++) {
			expect(b[(3 - 1) * 4 + x]).toBe(0);
		}
	});
});
