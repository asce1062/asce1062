import { describe, it, expect } from "vitest";
import {
	FLAVOR_TRANSITION_MAP,
	getMappedTransitionForFlavor,
	resolveEffectiveTransitionStyle,
	type Flavor,
} from "@/scripts/transitionRegistry";

describe("FLAVOR_TRANSITION_MAP", () => {
	it("covers every flavor", () => {
		const flavors: Flavor[] = ["", "crt-green", "amber", "synthwave", "dos", "void", "ice", "redline"];
		for (const f of flavors) {
			expect(FLAVOR_TRANSITION_MAP[f]).toBeDefined();
		}
	});
});

describe("getMappedTransitionForFlavor", () => {
	it("returns 'none' for default flavor", () => {
		expect(getMappedTransitionForFlavor("")).toBe("none");
	});
	it("returns 'retune' for crt-green", () => {
		expect(getMappedTransitionForFlavor("crt-green")).toBe("retune");
	});
	it("returns 'phosphor' for amber", () => {
		expect(getMappedTransitionForFlavor("amber")).toBe("phosphor");
	});
	it("returns 'glitch' for synthwave", () => {
		expect(getMappedTransitionForFlavor("synthwave")).toBe("glitch");
	});
	it("returns 'scanline' for dos", () => {
		expect(getMappedTransitionForFlavor("dos")).toBe("scanline");
	});
	it("returns 'static' for void", () => {
		expect(getMappedTransitionForFlavor("void")).toBe("static");
	});
	it("returns 'ripple' for ice", () => {
		expect(getMappedTransitionForFlavor("ice")).toBe("ripple");
	});
	it("returns 'glitch' for redline", () => {
		expect(getMappedTransitionForFlavor("redline")).toBe("glitch");
	});
});

describe("resolveEffectiveTransitionStyle", () => {
	it("returns stored pref 'none' when explicitly set (does NOT fall through to mapping)", () => {
		expect(resolveEffectiveTransitionStyle("none", "amber")).toBe("none");
	});
	it("returns stored pref 'scanline' over flavor mapping", () => {
		expect(resolveEffectiveTransitionStyle("scanline", "amber")).toBe("scanline");
	});
	it("returns flavor-mapped style when stored is null", () => {
		expect(resolveEffectiveTransitionStyle(null, "amber")).toBe("phosphor");
		expect(resolveEffectiveTransitionStyle(null, "ice")).toBe("ripple");
		expect(resolveEffectiveTransitionStyle(null, "crt-green")).toBe("retune");
	});
	it("returns 'none' when stored is null and flavor has no exciting mapping", () => {
		expect(resolveEffectiveTransitionStyle(null, "")).toBe("none");
	});
});
