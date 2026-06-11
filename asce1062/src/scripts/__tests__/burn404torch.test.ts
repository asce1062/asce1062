import { describe, it, expect } from "vitest";
import { initTorchFire, updateTorchFire, TORCH_DECAY, TORCH_FIRE_RADIUS } from "@/scripts/burn404torch";
import { MAX_INTENSITY } from "@/scripts/burn404";

const W = 20;
const H = 15;
const EMPTY = new Set<string>();

describe("initTorchFire", () => {
	it("returns a buffer of width x height filled with zeros", () => {
		const buf = initTorchFire(W, H);
		expect(buf).toHaveLength(W * H);
		expect(buf.every((v) => v === 0)).toBe(true);
	});

	it("bottom row is zero (torch has no persistent source row)", () => {
		const buf = initTorchFire(W, H);
		for (let x = 0; x < W; x++) {
			expect(buf[(H - 1) * W + x]).toBe(0);
		}
	});
});

describe("updateTorchFire", () => {
	it("preserves buffer length", () => {
		const buf = initTorchFire(W, H);
		const next = updateTorchFire(buf, W, H, MAX_INTENSITY, TORCH_DECAY, null, TORCH_FIRE_RADIUS, EMPTY);
		expect(next).toHaveLength(W * H);
	});

	it("all values stay >= 0", () => {
		const buf = Array<number>(W * H).fill(MAX_INTENSITY);
		const next = updateTorchFire(buf, W, H, MAX_INTENSITY, TORCH_DECAY, null, TORCH_FIRE_RADIUS, EMPTY);
		expect(next.every((v) => v >= 0)).toBe(true);
	});

	it("all values stay <= MAX_INTENSITY", () => {
		const buf = Array<number>(W * H).fill(MAX_INTENSITY);
		const next = updateTorchFire(buf, W, H, MAX_INTENSITY, TORCH_DECAY, null, TORCH_FIRE_RADIUS, EMPTY);
		expect(next.every((v) => v <= MAX_INTENSITY)).toBe(true);
	});

	it("bottom row decays (no persistent source unlike bottom strip)", () => {
		let buf = Array<number>(W * H).fill(MAX_INTENSITY);
		for (let i = 0; i < 50; i++) {
			buf = updateTorchFire(buf, W, H, MAX_INTENSITY, TORCH_DECAY, null, TORCH_FIRE_RADIUS, EMPTY);
		}
		const bottom = buf.slice((H - 1) * W);
		expect(bottom.every((v) => v < MAX_INTENSITY)).toBe(true);
	});

	it("burning pixels are held at maxIntensity each step", () => {
		const buf = Array<number>(W * H).fill(0);
		const burning = new Set(["5,7", "10,3"]);
		const next = updateTorchFire(buf, W, H, MAX_INTENSITY, TORCH_DECAY, null, TORCH_FIRE_RADIUS, burning);
		expect(next[7 * W + 5]).toBe(MAX_INTENSITY);
		expect(next[3 * W + 10]).toBe(MAX_INTENSITY);
	});

	it("mouse position injects fire at the center cell", () => {
		const buf = Array<number>(W * H).fill(0);
		const center = { x: 10, y: 7 };
		const next = updateTorchFire(buf, W, H, MAX_INTENSITY, TORCH_DECAY, center, TORCH_FIRE_RADIUS, EMPTY);
		expect(next[7 * W + 10]).toBeGreaterThan(0);
	});

	it("null mousePos injects no fire (all-zero buffer stays zero)", () => {
		const buf = Array<number>(W * H).fill(0);
		const next = updateTorchFire(buf, W, H, MAX_INTENSITY, TORCH_DECAY, null, TORCH_FIRE_RADIUS, EMPTY);
		expect(next.every((v) => v === 0)).toBe(true);
	});
});
