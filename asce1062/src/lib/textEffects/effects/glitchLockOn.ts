import type { EffectRendererHandle, GlitchLockOnEffectOptions } from "../types";
import { DEFAULT_GLITCH_LOCK_TOTAL_FRAMES } from "../constants";
import {
	createIntervalRenderer,
	resolveTextEffectDurationMs,
	resolveGlitchCharsetStr,
	splitGraphemes,
	pickRandomGrapheme,
} from "../utils";

function pickGlitchChar(glyphs: readonly string[], seed: number, useRandom: boolean): string {
	if (useRandom) return pickRandomGrapheme(glyphs) ?? "_";
	return glyphs[seed % glyphs.length] ?? "_";
}

function renderGlitchLockFrame(
	text: string,
	frame: number,
	totalFrames: number,
	glyphs: readonly string[],
	useRandom: boolean,
	reverse: boolean,
	intensity: number
): string {
	if (frame >= totalFrames - 1) return text;
	const chars = splitGraphemes(text);
	const instability = 1 - frame / Math.max(totalFrames - 1, 1);
	const effectiveIntensity = Math.max(0.01, Math.min(1, intensity));
	const artifactEvery = Math.max(2, Math.ceil(4 / effectiveIntensity - instability * 2));

	// During second half of animation, chars progressively lock in from one direction.
	const resolvedFraction = Math.max(0, 1 - instability * 2);
	const resolvedCount = Math.floor(resolvedFraction * chars.length);

	const body = chars
		.map((char, index) => {
			if (/\s/.test(char)) return char;

			if (resolvedCount > 0) {
				const isResolved = reverse ? index >= chars.length - resolvedCount : index < resolvedCount;
				if (isResolved) return char;
			}

			const seed = reverse ? chars.length - 1 - index + frame : index + frame;
			if (seed % artifactEvery === 0) return pickGlitchChar(glyphs, seed, useRandom);
			if (instability > 0.62 && seed % 3 === 0) return `${char}${char}`;
			return char;
		})
		.join("");

	if (frame === 0) return `${body}${chars.at(-1) ?? ""}`;
	if (frame === 1) return `${pickGlitchChar(glyphs, frame, useRandom)}${body}`;
	if (frame === totalFrames - 2) return body.replace(/[ _\-/\\|]/, "");
	return body;
}

export function runGlitchLockOnEnterRenderer(
	el: HTMLElement,
	text: string,
	options: GlitchLockOnEffectOptions = {}
): EffectRendererHandle {
	const {
		charset = "blocks",
		reverse = false,
		frameCount = DEFAULT_GLITCH_LOCK_TOTAL_FRAMES,
		intensity = 1.0,
		durationMs,
	} = options;

	const glyphs = splitGraphemes(resolveGlitchCharsetStr(charset));
	const useRandom = charset !== "blocks";
	const totalFrames = Math.max(3, frameCount);
	const totalDuration = durationMs ?? resolveTextEffectDurationMs("glitch-lock-on", text);

	return createIntervalRenderer({
		frames: totalFrames,
		intervalMs: totalDuration / totalFrames,
		render: (frame) => {
			el.textContent = renderGlitchLockFrame(text, frame, totalFrames, glyphs, useRandom, reverse, intensity);
		},
		complete: () => {
			el.textContent = text;
		},
	});
}
