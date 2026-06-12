import type { EffectRendererHandle, GlitchEffectOptions } from "../types";
import {
	SIGNAL_ARTIFACTS,
	DEFAULT_GLITCH_LOCK_TOTAL_FRAMES,
	GLITCH_CHARSET_LETTERS,
	GLITCH_CHARSET_BINARY,
} from "../constants";
import { resolveTextEffectDurationMs } from "../utils";

function resolveGlitchCharsetStr(charset: string | undefined): string {
	switch (charset ?? "blocks") {
		case "blocks":
			return SIGNAL_ARTIFACTS.join("");
		case "letters":
			return GLITCH_CHARSET_LETTERS;
		case "binary":
			return GLITCH_CHARSET_BINARY;
		default:
			return charset!;
	}
}

function pickGlitchChar(charsetStr: string, seed: number, useRandom: boolean): string {
	if (useRandom) return charsetStr[Math.floor(Math.random() * charsetStr.length)] ?? "_";
	return charsetStr[seed % charsetStr.length] ?? "_";
}

function renderGlitchLockFrame(
	text: string,
	frame: number,
	totalFrames: number,
	charsetStr: string,
	useRandom: boolean,
	reverse: boolean,
	intensity: number
): string {
	if (frame >= totalFrames - 1) return text;
	const chars = text.split("");
	const instability = 1 - frame / Math.max(totalFrames - 1, 1);
	const effectiveIntensity = Math.max(0.01, Math.min(1, intensity));
	const artifactEvery = Math.max(2, Math.ceil(4 / effectiveIntensity - instability * 2));

	// During second half of animation, chars progressively lock in from one direction.
	const resolvedFraction = Math.max(0, 1 - instability * 2);
	const resolvedCount = Math.floor(resolvedFraction * chars.length);

	const body = chars
		.map((char, index) => {
			if (char === " ") return char;

			if (resolvedCount > 0) {
				const isResolved = reverse ? index >= chars.length - resolvedCount : index < resolvedCount;
				if (isResolved) return char;
			}

			const seed = reverse ? chars.length - 1 - index + frame : index + frame;
			if (seed % artifactEvery === 0) return pickGlitchChar(charsetStr, seed, useRandom);
			if (instability > 0.62 && seed % 3 === 0) return `${char}${char}`;
			return char;
		})
		.join("");

	if (frame === 0) return `${body}${chars.at(-1) ?? ""}`;
	if (frame === 1) return `${pickGlitchChar(charsetStr, frame, useRandom)}${body}`;
	if (frame === totalFrames - 2) return body.replace(/[ _\-/\\|]/, "");
	return body;
}

export function runGlitchLockOnEnterRenderer(
	el: HTMLElement,
	text: string,
	options: GlitchEffectOptions = {}
): EffectRendererHandle {
	const {
		charset = "blocks",
		reverse = false,
		frameCount = DEFAULT_GLITCH_LOCK_TOTAL_FRAMES,
		intensity = 1.0,
		durationMs,
	} = options;

	const charsetStr = resolveGlitchCharsetStr(charset);
	const useRandom = charset !== "blocks";
	const totalFrames = Math.max(3, frameCount);
	const totalDuration = durationMs ?? resolveTextEffectDurationMs("glitch-lock-on", text);
	const frameInterval = totalDuration / totalFrames;
	let frame = 0;
	let resolvePromise: () => void = () => {};
	let settled = false;
	const promise = new Promise<void>((resolve) => {
		resolvePromise = resolve;
	});
	const intervalId = globalThis.setInterval(() => {
		el.textContent = renderGlitchLockFrame(text, frame, totalFrames, charsetStr, useRandom, reverse, intensity);

		frame += 1;

		if (frame >= totalFrames) {
			globalThis.clearInterval(intervalId);
			if (settled) return;
			settled = true;
			el.textContent = text;
			resolvePromise();
		}
	}, frameInterval);

	return {
		promise,
		cancel: () => {
			if (settled) return;
			settled = true;
			globalThis.clearInterval(intervalId);
			resolvePromise();
		},
	};
}
