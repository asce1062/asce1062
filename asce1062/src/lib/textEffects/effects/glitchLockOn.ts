import type { EffectRendererHandle } from "../types";
import { SIGNAL_ARTIFACTS, DEFAULT_GLITCH_LOCK_TOTAL_FRAMES } from "../constants";
import { resolveTerminalTextEffectDurationMs } from "../utils";

function getSignalArtifact(index: number): string {
	return SIGNAL_ARTIFACTS[index % SIGNAL_ARTIFACTS.length] ?? "_";
}

function renderGlitchLockFrame(text: string, frame: number, totalFrames: number): string {
	if (frame >= totalFrames - 1) return text;
	const chars = text.split("");
	const instability = 1 - frame / Math.max(totalFrames - 1, 1);
	const artifactEvery = Math.max(2, Math.ceil(4 - instability * 2));

	const body = chars
		.map((char, index) => {
			if (char === " ") return char;
			if ((index + frame) % artifactEvery === 0) return getSignalArtifact(index + frame);
			if (instability > 0.62 && (index + frame) % 3 === 0) return `${char}${char}`;
			return char;
		})
		.join("");

	if (frame === 0) return `${body}${chars.at(-1) ?? ""}`;
	if (frame === 1) return `${getSignalArtifact(frame)}${body}`;
	if (frame === totalFrames - 2) return body.replace(/[ _\-/\\|]/, "");
	return body;
}

export function runGlitchLockOnEnterRenderer(el: HTMLElement, text: string, durationMs?: number): EffectRendererHandle {
	const totalFrames = DEFAULT_GLITCH_LOCK_TOTAL_FRAMES;
	const totalDuration = durationMs ?? resolveTerminalTextEffectDurationMs("glitch-lock-on", text);
	const frameInterval = totalDuration / totalFrames;
	let frame = 0;
	let resolvePromise: () => void = () => {};
	let settled = false;
	const promise = new Promise<void>((resolve) => {
		resolvePromise = resolve;
	});
	const intervalId = globalThis.setInterval(() => {
		el.textContent = renderGlitchLockFrame(text, frame, totalFrames);

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
