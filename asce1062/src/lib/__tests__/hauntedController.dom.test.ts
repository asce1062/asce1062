// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bindHaunted } from "@/lib/haunted";

interface FakeAnimation {
	keyframes: Keyframe[];
	options: KeyframeAnimationOptions;
	cancel: ReturnType<typeof vi.fn>;
}

/** jsdom has no Web Animations API; record what the controller asks for. */
function installAnimationStubs(): FakeAnimation[] {
	const created: FakeAnimation[] = [];
	const live = new WeakMap<Element, FakeAnimation[]>();
	Element.prototype.animate = function animate(
		this: Element,
		keyframes: Keyframe[],
		options: KeyframeAnimationOptions
	) {
		const animation: FakeAnimation = { keyframes, options, cancel: vi.fn() };
		created.push(animation);
		live.set(this, [...(live.get(this) ?? []), animation]);
		return animation as unknown as Animation;
	} as unknown as Element["animate"];
	Element.prototype.getAnimations = function getAnimations(this: Element) {
		return (live.get(this) ?? []) as unknown as Animation[];
	};
	return created;
}

function hover(el: HTMLElement): void {
	el.dispatchEvent(new Event("mouseenter"));
}

function leave(el: HTMLElement): void {
	el.dispatchEvent(new Event("mouseleave"));
}

describe("bindHaunted", () => {
	let animations: FakeAnimation[];
	let host: HTMLElement;

	beforeEach(() => {
		vi.useFakeTimers();
		animations = installAnimationStubs();
		document.body.innerHTML = "<p><sup id='host'>hover me</sup></p>";
		host = document.getElementById("host")!;
	});

	afterEach(() => {
		vi.useRealTimers();
		Reflect.deleteProperty(Element.prototype, "animate");
		Reflect.deleteProperty(Element.prototype, "getAnimations");
	});

	it("injects only phrasing elements, so it stays valid inside phrasing hosts", () => {
		const cleanup = bindHaunted(host, { creatureOptions: { numberOf: 3 } });

		const layer = host.querySelector(".haunted-creatures")!;
		expect(layer.tagName).toBe("SPAN");
		expect(layer.querySelectorAll(".haunted-creature-wrap")).toHaveLength(3);
		expect(layer.querySelectorAll("div")).toHaveLength(0);

		cleanup();
		expect(host.querySelector(".haunted-creatures")).toBeNull();
	});

	it("keeps at most one pending timer per creature across repeated hovers", () => {
		const cleanup = bindHaunted(host, { disableGlow: true, creatureOptions: { numberOf: 4, animationTime: 2 } });

		for (let i = 0; i < 25; i++) {
			hover(host);
			leave(host);
		}
		expect(vi.getTimerCount()).toBe(4);

		vi.runAllTimers();
		expect(vi.getTimerCount()).toBe(0);
		for (const wrap of host.querySelectorAll<HTMLElement>(".haunted-creature-wrap")) {
			expect(wrap.style.display).toBe("none");
		}

		cleanup();
	});

	it("does not let a stale timer hide a creature that was re-launched", () => {
		const cleanup = bindHaunted(host, { disableGlow: true, creatureOptions: { numberOf: 1, animationTime: 2 } });
		const wrap = host.querySelector<HTMLElement>(".haunted-creature-wrap")!;
		vi.spyOn(Math, "random").mockReturnValue(1); // every flight lasts the full 2s

		hover(host);
		vi.advanceTimersByTime(1_500);
		leave(host);
		hover(host);
		vi.advanceTimersByTime(1_000); // first flight's timer would have fired at 2s

		expect(wrap.style.display).toBe("block");

		vi.advanceTimersByTime(1_000);
		expect(wrap.style.display).toBe("none");

		vi.restoreAllMocks();
		cleanup();
	});

	it("clears every pending timer on teardown", () => {
		const cleanup = bindHaunted(host, { disableGlow: true, creatureOptions: { numberOf: 5 } });
		hover(host);
		expect(vi.getTimerCount()).toBe(5);

		cleanup();

		expect(vi.getTimerCount()).toBe(0);
	});

	it("stops the glow on mouseleave without pinning box-shadow with a forwards fill", () => {
		const cleanup = bindHaunted(host, { disableCreatures: true });

		hover(host);
		expect(animations).toHaveLength(1);
		const glow = animations[0]!;
		expect(glow.options.iterations).toBe(Infinity);

		leave(host);

		expect(glow.cancel).toHaveBeenCalledTimes(1);
		expect(animations).toHaveLength(1);
		expect(animations.some((animation) => animation.options.fill === "forwards")).toBe(false);

		cleanup();
	});

	it("cancels a running glow on teardown", () => {
		const cleanup = bindHaunted(host, { disableCreatures: true });
		hover(host);

		cleanup();

		expect(animations[0]!.cancel).toHaveBeenCalledTimes(1);
	});
});
