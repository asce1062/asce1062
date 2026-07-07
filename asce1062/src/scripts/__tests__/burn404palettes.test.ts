import { describe, it, expect } from "vitest";
import { FIRE_COLOR_STOPS, getActiveColorStops, buildPalette } from "@/scripts/burn404palettes";

const DARK_KEYS = ["dark", "observatory", "crt-green", "amber", "synthwave", "dos", "void", "ice", "redline"];
const LIGHT_KEYS = DARK_KEYS.map((k) => (k === "dark" ? "light" : `${k}-light`));
const ALL_KEYS = [...DARK_KEYS, ...LIGHT_KEYS];

describe("FIRE_COLOR_STOPS", () => {
	it("has an entry for every dark and light variant", () => {
		for (const key of ALL_KEYS) {
			expect(FIRE_COLOR_STOPS, `missing key "${key}"`).toHaveProperty(key);
		}
	});

	it("every entry has at least 3 stops", () => {
		for (const [key, stops] of Object.entries(FIRE_COLOR_STOPS)) {
			expect(stops.length, `${key} needs ≥3 stops`).toBeGreaterThanOrEqual(3);
		}
	});

	it("first stop is transparent (ends with '00')", () => {
		for (const [key, stops] of Object.entries(FIRE_COLOR_STOPS)) {
			expect(stops[0], `${key}[0] must be transparent`).toMatch(/00$/i);
		}
	});

	it("second stop is also transparent (prevents cold-cell overlay on light backgrounds)", () => {
		for (const [key, stops] of Object.entries(FIRE_COLOR_STOPS)) {
			expect(stops[1], `${key}[1] must be transparent`).toMatch(/00$/i);
		}
	});

	it("no entry contains empty strings", () => {
		for (const [key, stops] of Object.entries(FIRE_COLOR_STOPS)) {
			expect(
				stops.every((s) => s.length > 0),
				`${key} has empty stop`
			).toBe(true);
		}
	});
});

describe("getActiveColorStops", () => {
	it("returns dark stops as SSR fallback (no document)", () => {
		// In Node environment document is undefined → falls back to dark
		const stops = getActiveColorStops();
		expect(stops).toEqual(FIRE_COLOR_STOPS.dark);
	});
});

describe("buildPalette", () => {
	it("returns empty array for fewer than 2 stops", () => {
		expect(buildPalette([])).toEqual([]);
		expect(buildPalette(["#ff0000"])).toEqual([]);
	});

	it("returns empty array in non-browser environment (no canvas)", () => {
		// In Node environment document is undefined → returns []
		const result = buildPalette(["#00000000", "#ff0000", "#ffffff"]);
		expect(result).toEqual([]);
	});
});
