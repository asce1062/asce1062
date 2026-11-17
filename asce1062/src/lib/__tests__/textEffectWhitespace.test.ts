/**
 * Every renderer treats whitespace the same way: any whitespace grapheme
 * (space, tab, newline, no-break space) keeps its place while the characters
 * around it animate. Some renderers used to special-case only U+0020.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { EffectRendererHandle } from "@/lib/textEffects/types";
import { createIntervalRenderer, splitGraphemes } from "@/lib/textEffects/utils";
import { runDecryptEnterRenderer } from "@/lib/textEffects/effects/decrypt";
import { runEntropyExitRenderer } from "@/lib/textEffects/effects/entropy";
import { runGlitchLockOnEnterRenderer } from "@/lib/textEffects/effects/glitchLockOn";
import { runSignalLossExitRenderer } from "@/lib/textEffects/effects/signalLoss";

const TEXT = "ab\ncd\tef gh\nij";
const WHITESPACE = /\s/g;

function createRecordingElement(): { el: HTMLElement; frames: string[] } {
	const frames: string[] = [];
	let value = "";
	const target = new EventTarget() as HTMLElement & EventTarget;
	Object.defineProperty(target, "textContent", {
		get: () => value,
		set: (next: string) => {
			value = next;
			frames.push(next);
		},
	});
	return { el: target, frames };
}

async function runToCompletion(handle: EffectRendererHandle): Promise<void> {
	let done = false;
	void handle.promise.then(() => {
		done = true;
	});
	for (let i = 0; i < 2000 && !done; i++) {
		await vi.advanceTimersByTimeAsync(10);
	}
	expect(done).toBe(true);
}

function whitespaceOf(text: string): string {
	return (text.match(WHITESPACE) ?? []).join("");
}

afterEach(() => {
	vi.useRealTimers();
});

describe("whitespace handling across renderers", () => {
	it.each([
		["decrypt", (el: HTMLElement) => runDecryptEnterRenderer(el, TEXT)],
		["entropy", (el: HTMLElement) => runEntropyExitRenderer(el, TEXT)],
	])("%s keeps every whitespace grapheme in position", async (_name, run) => {
		vi.useFakeTimers();
		const { el, frames } = createRecordingElement();
		await runToCompletion(run(el));

		const original = splitGraphemes(TEXT);
		const animated = frames.filter((frame) => frame !== "");
		expect(animated.length).toBeGreaterThan(1);
		for (const frame of animated) {
			const chars = splitGraphemes(frame);
			original.forEach((char, index) => {
				if (/\s/.test(char)) expect(chars[index]).toBe(char);
			});
		}
	});

	it("glitch-lock-on never replaces or doubles whitespace", async () => {
		vi.useFakeTimers();
		const { el, frames } = createRecordingElement();
		await runToCompletion(runGlitchLockOnEnterRenderer(el, TEXT, { charset: "letters", frameCount: 12 }));

		expect(frames.length).toBeGreaterThan(1);
		for (const frame of frames) expect(whitespaceOf(frame)).toBe(whitespaceOf(TEXT));
	});

	it("signal-loss keeps tabs, newlines and no-break spaces through the dropout", async () => {
		vi.useFakeTimers();
		const { el, frames } = createRecordingElement();
		await runToCompletion(runSignalLossExitRenderer(el, TEXT, { blackoutHoldMs: 10 }));

		const original = splitGraphemes(TEXT);
		expect(frames.length).toBeGreaterThan(1);
		for (const frame of frames) {
			const chars = splitGraphemes(frame);
			original.forEach((char, index) => {
				if (/\s/.test(char)) expect(chars[index]).toBe(char);
			});
		}
	});
});

describe("createIntervalRenderer", () => {
	it("renders each frame in order, then completes once and resolves", async () => {
		vi.useFakeTimers();
		const calls: string[] = [];
		const handle = createIntervalRenderer({
			frames: 3,
			intervalMs: 10,
			render: (frame) => calls.push(`render ${frame}`),
			complete: () => calls.push("complete"),
		});

		await vi.advanceTimersByTimeAsync(100);
		await handle.promise;

		expect(calls).toEqual(["render 0", "render 1", "render 2", "complete"]);
		expect(vi.getTimerCount()).toBe(0);
	});

	it("stops without completing when cancelled", async () => {
		vi.useFakeTimers();
		const render = vi.fn();
		const complete = vi.fn();
		const handle = createIntervalRenderer({ frames: 5, intervalMs: 10, render, complete });

		await vi.advanceTimersByTimeAsync(25);
		handle.cancel();
		await handle.promise;
		await vi.advanceTimersByTimeAsync(100);

		expect(render).toHaveBeenCalledTimes(2);
		expect(complete).not.toHaveBeenCalled();
		expect(vi.getTimerCount()).toBe(0);
	});

	it("ignores cancel after it has settled", async () => {
		vi.useFakeTimers();
		const complete = vi.fn();
		const handle = createIntervalRenderer({ frames: 1, intervalMs: 10, render: () => {}, complete });

		await vi.advanceTimersByTimeAsync(10);
		handle.cancel();
		await handle.promise;

		expect(complete).toHaveBeenCalledTimes(1);
	});
});
