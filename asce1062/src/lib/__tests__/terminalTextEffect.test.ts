import { afterEach, describe, expect, it, vi } from "vitest";
import {
	DEFAULT_TERMINAL_TEXT_EFFECT_TRIGGERS,
	TERMINAL_TEXT_EFFECTS,
	bindTerminalTextEffectTriggers,
	getTerminalTextEffectMetadata,
	normalizeTerminalTextEffectTriggers,
	playTerminalTextEffect,
	readTerminalTextEffectConfig,
	runTerminalTextTransition,
	resolveTypingDurationMs,
	resolveTerminalTextEffectKind,
	shouldHandleTerminalTextEffectTrigger,
} from "@/lib/textEffects/terminalTextEffect";

function createMockEffectElement(text = ""): HTMLElement {
	const target = new EventTarget() as HTMLElement & EventTarget;
	target.textContent = text;
	Object.defineProperty(target, "dataset", {
		value: {} as DOMStringMap,
		writable: true,
	});
	return target;
}

function createMockDocument(visibilityState: DocumentVisibilityState = "visible"): Document {
	const target = new EventTarget() as Document & EventTarget;
	Object.defineProperty(target, "visibilityState", {
		configurable: true,
		writable: true,
		value: visibilityState,
	});
	return target;
}

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe("normalizeTerminalTextEffectTriggers", () => {
	it("uses the default triggers when none are provided", () => {
		expect(normalizeTerminalTextEffectTriggers()).toEqual(DEFAULT_TERMINAL_TEXT_EFFECT_TRIGGERS);
	});

	it("deduplicates triggers while preserving order", () => {
		expect(normalizeTerminalTextEffectTriggers(["hover", "tap", "hover", "manual"])).toEqual([
			"hover",
			"tap",
			"manual",
		]);
	});

	it("supports the expanded trigger vocabulary", () => {
		expect(
			normalizeTerminalTextEffectTriggers([
				"load",
				"activate",
				"click",
				"tap",
				"focus",
				"resume",
				"route-enter",
				"intersection",
				"idle-return",
				"random-effect",
				"random-time",
				"click",
			])
		).toEqual([
			"load",
			"activate",
			"click",
			"tap",
			"focus",
			"resume",
			"route-enter",
			"intersection",
			"idle-return",
			"random-effect",
			"random-time",
		]);
	});
});

describe("shouldHandleTerminalTextEffectTrigger", () => {
	it("matches configured triggers", () => {
		expect(shouldHandleTerminalTextEffectTrigger(["load", "hover"], "hover")).toBe(true);
		expect(shouldHandleTerminalTextEffectTrigger(["load", "hover"], "tap")).toBe(false);
	});
});

describe("resolveTerminalTextEffectKind", () => {
	it("exposes effect metadata for reversible families", () => {
		expect(TERMINAL_TEXT_EFFECTS.typing).toMatchObject({
			family: "type",
			role: "enter",
			standaloneSafe: false,
		});
		expect(TERMINAL_TEXT_EFFECTS.backspace).toMatchObject({
			family: "type",
			role: "exit",
			standaloneSafe: true,
		});
		expect(getTerminalTextEffectMetadata("entropy")).toMatchObject({
			family: "cipher",
			role: "exit",
			standaloneSafe: true,
		});
	});

	it("returns the first declared effect when not using random-effect", () => {
		expect(resolveTerminalTextEffectKind(["decrypt"], false, 0.9)).toBe("decrypt");
		expect(resolveTerminalTextEffectKind(["typing", "decrypt"], false, 0.1)).toBe("typing");
	});

	it("randomizes across the declared effect list when random-effect is enabled", () => {
		expect(resolveTerminalTextEffectKind(["typing", "decrypt"], true, 0.1)).toBe("typing");
		expect(resolveTerminalTextEffectKind(["typing", "decrypt"], true, 0.9)).toBe("decrypt");
	});

	it("falls back to the first effect when random-effect has only one candidate", () => {
		expect(resolveTerminalTextEffectKind(["decrypt"], true, 0.9)).toBe("decrypt");
	});

	it("filters random standalone flourish choices to standalone-safe effects", () => {
		expect(resolveTerminalTextEffectKind(["typing", "backspace"], true, 0.1, { mode: "standalone" })).toBe("backspace");
		expect(resolveTerminalTextEffectKind(["typing", "backspace", "entropy"], true, 0.9, { mode: "standalone" })).toBe(
			"entropy"
		);
	});
});

describe("readTerminalTextEffectConfig", () => {
	it("parses effect config from dataset attributes", () => {
		const el = {
			dataset: {
				textEffect: "typing, decrypt, backspace, entropy",
				textEffectTriggers:
					"load, hover, activate, resume, route-enter, intersection, idle-return, random-effect, random-time",
				textEffectIntervalMs: "18000",
			},
		} as unknown as HTMLElement;

		expect(readTerminalTextEffectConfig(el)).toEqual({
			effects: ["typing", "decrypt", "backspace", "entropy"],
			triggers: [
				"load",
				"hover",
				"activate",
				"resume",
				"route-enter",
				"intersection",
				"idle-return",
				"random-effect",
				"random-time",
			],
			randomIntervalMs: 18_000,
		});
	});

	it("returns null when the dataset does not define an effect", () => {
		const el = {
			dataset: {},
		} as unknown as HTMLElement;

		expect(readTerminalTextEffectConfig(el)).toBeNull();
	});
});

describe("playTerminalTextEffect", () => {
	it("types text out once and settles on the final string", () => {
		vi.useFakeTimers();
		vi.spyOn(Math, "random").mockReturnValue(0);
		const el = createMockEffectElement();

		expect(
			playTerminalTextEffect({
				el,
				effect: "typing",
				text: "hello",
			})
		).toBe(true);

		vi.runAllTimers();
		expect(el.textContent).toBe("hello");
	});

	it("shows a leading cursor before reveal and a trailing cursor blink before settling", () => {
		vi.useFakeTimers();
		vi.spyOn(Math, "random").mockReturnValue(0);
		const el = createMockEffectElement();

		playTerminalTextEffect({
			el,
			effect: "typing",
			text: "Alex",
		});

		expect(el.textContent).toBe("█");

		vi.advanceTimersByTime(220);
		expect(el.textContent).toContain("█");

		vi.advanceTimersByTime(2_000);
		expect(el.textContent).toBe("Alex");
	});

	it("centrally applies reduced-motion fallback", () => {
		vi.useFakeTimers();
		const el = createMockEffectElement("old");

		expect(
			playTerminalTextEffect({
				el,
				effect: "typing",
				text: "new",
				reducedMotion: true,
			})
		).toBe(false);

		expect(el.textContent).toBe("new");
		vi.runAllTimers();
		expect(el.textContent).toBe("new");
	});

	it("runs standalone backspace and restores stable text", async () => {
		vi.useFakeTimers();
		vi.spyOn(Math, "random").mockReturnValue(0);
		const el = createMockEffectElement("signal");

		expect(
			playTerminalTextEffect({
				el,
				effect: "backspace",
				text: "signal",
			})
		).toBe(true);

		vi.advanceTimersByTime(360);
		expect(el.textContent).toContain("█");
		expect(el.textContent).not.toBe("signal");

		await vi.runAllTimersAsync();
		expect(el.textContent).toBe("signal");
	});

	it("runs a full backspace to typing transition", async () => {
		vi.useFakeTimers();
		vi.spyOn(Math, "random").mockReturnValue(0);
		const el = createMockEffectElement("alex");

		const transition = runTerminalTextTransition({
			el,
			fromText: "alex",
			toText: "engineer",
			mode: "full-transition",
			exitEffect: "backspace",
			enterEffect: "typing",
			holdMs: 60,
		});

		vi.advanceTimersByTime(360);
		expect(el.textContent).not.toBe("engineer");

		await vi.runAllTimersAsync();
		await transition;
		expect(el.textContent).toBe("engineer");
		expect(el.dataset.textEffectStableText).toBe("engineer");
	});

	it("restores the target text when a multi-phase transition is interrupted", async () => {
		vi.useFakeTimers();
		vi.spyOn(Math, "random").mockReturnValue(0);
		const el = createMockEffectElement("alex");

		const first = runTerminalTextTransition({
			el,
			fromText: "alex",
			toText: "engineer",
			mode: "full-transition",
			exitEffect: "backspace",
			enterEffect: "typing",
		});
		vi.advanceTimersByTime(180);

		const second = runTerminalTextTransition({
			el,
			fromText: el.textContent ?? "",
			toText: "writer",
			mode: "enter-only",
			enterEffect: "typing",
		});

		await vi.runAllTimersAsync();
		await Promise.all([first, second]);
		expect(el.textContent).toBe("writer");
		expect(el.dataset.textEffectStableText).toBe("writer");
	});

	it("runs standalone entropy and restores stable text", async () => {
		vi.useFakeTimers();
		vi.spyOn(Math, "random").mockReturnValue(0);
		const el = createMockEffectElement("signal");

		expect(
			playTerminalTextEffect({
				el,
				effect: "entropy",
				text: "signal",
			})
		).toBe(true);

		vi.advanceTimersByTime(120);
		expect(el.textContent).not.toBe("signal");

		await vi.runAllTimersAsync();
		expect(el.textContent).toBe("signal");
	});

	it("runs a full entropy to decrypt transition", async () => {
		vi.useFakeTimers();
		vi.spyOn(Math, "random").mockReturnValue(0);
		const el = createMockEffectElement("asce1062");

		const transition = runTerminalTextTransition({
			el,
			fromText: "asce1062",
			toText: "alex",
			mode: "full-transition",
			exitEffect: "entropy",
			enterEffect: "decrypt",
		});

		await vi.runAllTimersAsync();
		await transition;
		expect(el.textContent).toBe("alex");
	});
});

describe("resolveTypingDurationMs", () => {
	it("adds extra dwell time to short strings", () => {
		const short = resolveTypingDurationMs("Alex");
		const long = resolveTypingDurationMs("incoming transmission");

		expect(short).toBeGreaterThan(700);
		expect(short / 4).toBeGreaterThan(long / "incoming transmission".length);
	});

	it("keeps long strings within a bounded duration", () => {
		expect(resolveTypingDurationMs("abcdefghijklmnopqrstuvwxyz0123456789")).toBeLessThanOrEqual(2_400);
	});
});

describe("bindTerminalTextEffectTriggers", () => {
	it("binds activate to both click and touchstart", () => {
		vi.useFakeTimers();
		vi.spyOn(Math, "random").mockReturnValue(0);
		const el = createMockEffectElement("signal");
		vi.stubGlobal("document", createMockDocument());

		bindTerminalTextEffectTriggers({
			el,
			effects: ["typing"],
			triggers: ["activate"],
		});

		el.dispatchEvent(new Event("click"));
		vi.runAllTimers();
		expect(el.textContent).toBe("signal");

		resetElementText(el, "signal");
		el.dispatchEvent(new Event("touchstart"));
		vi.runAllTimers();
		expect(el.textContent).toBe("signal");
	});

	it("plays on focus and resume triggers", () => {
		vi.useFakeTimers();
		vi.spyOn(Math, "random").mockReturnValue(0);
		const el = createMockEffectElement("signal");
		const mockDocument = createMockDocument("hidden");
		vi.stubGlobal("document", mockDocument);

		bindTerminalTextEffectTriggers({
			el,
			effects: ["typing"],
			triggers: ["focus", "resume"],
		});

		el.dispatchEvent(new Event("focusin"));
		vi.runAllTimers();
		expect(el.textContent).toBe("signal");

		resetElementText(el, "signal");
		Object.defineProperty(mockDocument, "visibilityState", {
			configurable: true,
			writable: true,
			value: "visible",
		});
		mockDocument.dispatchEvent(new Event("visibilitychange"));
		vi.runAllTimers();
		expect(el.textContent).toBe("signal");
	});

	it("plays on route-enter", () => {
		vi.useFakeTimers();
		vi.spyOn(Math, "random").mockReturnValue(0);
		const el = createMockEffectElement("signal");
		const mockDocument = createMockDocument();
		vi.stubGlobal("document", mockDocument);

		bindTerminalTextEffectTriggers({
			el,
			effects: ["typing"],
			triggers: ["route-enter"],
		});

		mockDocument.dispatchEvent(new Event("astro:after-swap"));
		vi.runAllTimers();
		expect(el.textContent).toBe("signal");
	});

	it("plays on intersection", () => {
		vi.useFakeTimers();
		vi.spyOn(Math, "random").mockReturnValue(0);
		const el = createMockEffectElement("signal");
		vi.stubGlobal("document", createMockDocument());
		let observerCallback: ((entries: IntersectionObserverEntry[], observer: IntersectionObserver) => void) | undefined;

		class MockIntersectionObserver {
			constructor(callback: (entries: IntersectionObserverEntry[], observer: IntersectionObserver) => void) {
				observerCallback = callback;
			}
			observe(): void {}
			disconnect(): void {}
			unobserve(): void {}
			takeRecords(): IntersectionObserverEntry[] {
				return [];
			}
			root = null;
			rootMargin = "";
			thresholds = [];
		}

		vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);

		bindTerminalTextEffectTriggers({
			el,
			effects: ["typing"],
			triggers: ["intersection"],
		});

		observerCallback?.(
			[{ isIntersecting: true, target: el } as unknown as IntersectionObserverEntry],
			{} as IntersectionObserver
		);
		vi.runAllTimers();
		expect(el.textContent).toBe("signal");
	});

	it("plays on idle-return after enough inactivity", () => {
		vi.useFakeTimers();
		vi.spyOn(Math, "random").mockReturnValue(0);
		const el = createMockEffectElement("signal");
		const mockDocument = createMockDocument();
		vi.stubGlobal("document", mockDocument);

		bindTerminalTextEffectTriggers({
			el,
			effects: ["typing"],
			triggers: ["idle-return"],
		});

		mockDocument.dispatchEvent(new Event("mousemove"));
		vi.advanceTimersByTime(45_001);
		mockDocument.dispatchEvent(new Event("keydown"));
		vi.runAllTimers();
		expect(el.textContent).toBe("signal");
	});

	it("does not restart typing while the effect is already active", () => {
		vi.useFakeTimers();
		vi.spyOn(Math, "random").mockReturnValue(0);
		const el = createMockEffectElement("signal");

		bindTerminalTextEffectTriggers({
			el,
			effects: ["typing"],
			triggers: ["hover"],
		});

		el.dispatchEvent(new Event("mouseenter"));
		vi.advanceTimersByTime(220);
		const partial = el.textContent;
		el.dispatchEvent(new Event("mouseenter"));
		vi.advanceTimersByTime(220);

		expect(el.textContent?.length).toBeGreaterThanOrEqual(partial?.length ?? 0);
		expect(el.textContent).not.toBe("");

		vi.runAllTimers();
		expect(el.textContent).toBe("signal");
	});

	it("passes the triggering cause into custom text readers", async () => {
		vi.useFakeTimers();
		vi.spyOn(Math, "random").mockReturnValue(0);
		const el = createMockEffectElement("signal");
		const mockDocument = createMockDocument("hidden");
		const seenTriggers: string[] = [];
		vi.stubGlobal("document", mockDocument);

		bindTerminalTextEffectTriggers({
			el,
			effects: ["typing"],
			triggers: ["resume", "random-time"],
			randomIntervalMs: 18_000,
			getText: (_node, trigger) => {
				seenTriggers.push(trigger);
				return `signal-${trigger}`;
			},
		});

		Object.defineProperty(mockDocument, "visibilityState", {
			configurable: true,
			writable: true,
			value: "visible",
		});
		mockDocument.dispatchEvent(new Event("visibilitychange"));
		await vi.advanceTimersByTimeAsync(2_000);
		expect(seenTriggers).toContain("resume");
		expect(el.textContent).toBe("signal-resume");

		await vi.advanceTimersByTimeAsync(18_000);
		await vi.advanceTimersByTimeAsync(2_000);
		expect(seenTriggers).toContain("random-time");
		expect(el.textContent).toBe("signal-random-time");
	});
});

function resetElementText(el: HTMLElement, text: string): void {
	el.textContent = text;
	Object.assign(el.dataset, {
		greetingTarget: text,
		textEffectStableText: text,
	});
}
