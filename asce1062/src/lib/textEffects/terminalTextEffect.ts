import type { NavBrandEffect } from "@/lib/navBrand/state";

export type TerminalTextEffectKind = Exclude<NavBrandEffect, "none">;
export type TerminalTextEffectTrigger = "load" | "hover" | "tap" | "click" | "manual" | "random-effect" | "random-time";

export type TerminalTextEffectConfig = {
	effect: TerminalTextEffectKind;
	triggers: TerminalTextEffectTrigger[];
	randomIntervalMs?: number;
};

export const DEFAULT_TERMINAL_TEXT_EFFECT_TRIGGERS: TerminalTextEffectTrigger[] = ["load", "hover", "tap", "click"];
export const DEFAULT_RANDOM_INTERVAL_MS = 20_000;

const DECRYPT_CHARS = "░▒▓█▐▌▄▀■□▪▫◆◇○●◌◍◎◉▶▷◀◁▸▹◂◃⬛⬜▬▭▮▯◥◤◣◢◿█▄▌▐▀▘▝▀▖▍▞▛▗▚▐▜▃▙▟▉";
const DEFAULT_TYPING_STEP_MS = 26;
const DEFAULT_DECRYPT_DURATION_MS = 700;
const DEFAULT_DECRYPT_TOTAL_FRAMES = 40;

type ActiveEffectHandle = {
	cancel: () => void;
};

type TerminalTextEffectOptions = {
	durationMs?: number;
	typingStepMs?: number;
	rootEl?: HTMLElement | null;
	rootEffectDataset?: string;
	onComplete?: () => void;
};

const activeEffects = new WeakMap<HTMLElement, ActiveEffectHandle>();
const triggerHandlers = new WeakMap<
	HTMLElement,
	{
		mouseenter: EventListener;
		touchstart: EventListener;
		click: EventListener;
	}
>();
const randomTimers = new WeakMap<HTMLElement, number>();

function clearActiveEffect(el: HTMLElement): void {
	activeEffects.get(el)?.cancel();
	activeEffects.delete(el);
}

function setRootEffect(
	rootEl: HTMLElement | null | undefined,
	effect: NavBrandEffect,
	rootEffectDataset = "navbrandEffect"
): void {
	if (!rootEl) return;
	rootEl.dataset[rootEffectDataset] = effect;
}

export function normalizeTerminalTextEffectTriggers(
	triggers: TerminalTextEffectTrigger[] = DEFAULT_TERMINAL_TEXT_EFFECT_TRIGGERS
): TerminalTextEffectTrigger[] {
	return [...new Set(triggers)];
}

export function shouldHandleTerminalTextEffectTrigger(
	triggers: readonly TerminalTextEffectTrigger[],
	trigger: TerminalTextEffectTrigger
): boolean {
	return triggers.includes(trigger);
}

export function resolveTerminalTextEffectKind(
	effect: TerminalTextEffectKind,
	useRandomEffect: boolean,
	randomValue: number
): TerminalTextEffectKind {
	if (!useRandomEffect) return effect;
	return randomValue < 0.5 ? "typing" : "decrypt";
}

export function readTerminalTextEffectConfig(el: HTMLElement): TerminalTextEffectConfig | null {
	const effect = el.dataset.textEffect;
	if (effect !== "typing" && effect !== "decrypt") {
		return null;
	}

	const rawTriggers = el.dataset.textEffectTriggers
		?.split(",")
		.map((value) => value.trim())
		.filter(Boolean) as TerminalTextEffectTrigger[] | undefined;

	const intervalValue = el.dataset.textEffectIntervalMs
		? Number.parseInt(el.dataset.textEffectIntervalMs, 10)
		: undefined;

	return {
		effect,
		triggers: normalizeTerminalTextEffectTriggers(rawTriggers),
		randomIntervalMs: Number.isFinite(intervalValue) ? intervalValue : undefined,
	};
}

export function resetTerminalTextEffect(
	el: HTMLElement | null,
	options: Pick<TerminalTextEffectOptions, "rootEl" | "rootEffectDataset"> = {}
): void {
	if (!el) return;
	clearActiveEffect(el);
	setRootEffect(options.rootEl, "none", options.rootEffectDataset);

	const target = el.dataset.greetingTarget ?? el.textContent ?? "";
	el.textContent = target;
}

export function playTerminalTextEffect(options: {
	el: HTMLElement | null;
	effect: TerminalTextEffectKind | "none";
	text: string;
	durationMs?: number;
	typingStepMs?: number;
	rootEl?: HTMLElement | null;
	rootEffectDataset?: string;
	onComplete?: () => void;
}): boolean {
	const { el, effect, text, durationMs, typingStepMs, rootEl, rootEffectDataset, onComplete } = options;
	if (!el) return false;

	clearActiveEffect(el);
	el.dataset.greetingTarget = text;

	if (effect === "none") {
		setRootEffect(rootEl, "none", rootEffectDataset);
		el.textContent = text;
		onComplete?.();
		return false;
	}

	setRootEffect(rootEl, effect, rootEffectDataset);

	if (effect === "typing") {
		const stepMs = typingStepMs ?? DEFAULT_TYPING_STEP_MS;
		el.textContent = "";
		let index = 0;
		const timeoutId = window.setInterval(() => {
			index += 1;
			el.textContent = text.slice(0, index);

			if (index >= text.length) {
				window.clearInterval(timeoutId);
				activeEffects.delete(el);
				setRootEffect(rootEl, "none", rootEffectDataset);
				onComplete?.();
			}
		}, stepMs);

		activeEffects.set(el, {
			cancel: () => window.clearInterval(timeoutId),
		});
		return true;
	}

	const totalFrames = DEFAULT_DECRYPT_TOTAL_FRAMES;
	const totalDuration = durationMs ?? DEFAULT_DECRYPT_DURATION_MS;
	let frame = 0;
	const frameInterval = totalDuration / totalFrames;
	const intervalId = window.setInterval(() => {
		const resolved = Math.floor((frame / totalFrames) * text.length);

		el.textContent = text
			.split("")
			.map((char, i) => {
				if (char === " ") return char;
				if (i < resolved) return char;
				return DECRYPT_CHARS[Math.floor(Math.random() * DECRYPT_CHARS.length)];
			})
			.join("");

		frame += 1;

		if (frame >= totalFrames) {
			window.clearInterval(intervalId);
			activeEffects.delete(el);
			el.textContent = text;
			setRootEffect(rootEl, "none", rootEffectDataset);
			onComplete?.();
		}
	}, frameInterval);

	activeEffects.set(el, {
		cancel: () => window.clearInterval(intervalId),
	});
	return true;
}

export function bindTerminalTextEffectTriggers(options: {
	el: HTMLElement | null;
	effect: TerminalTextEffectKind;
	triggers?: TerminalTextEffectTrigger[];
	getText?: (el: HTMLElement) => string;
	durationMs?: number;
	typingStepMs?: number;
	randomIntervalMs?: number;
}): void {
	const {
		el,
		effect,
		triggers,
		getText,
		durationMs,
		typingStepMs,
		randomIntervalMs = DEFAULT_RANDOM_INTERVAL_MS,
	} = options;
	if (!el) return;

	const normalizedTriggers = normalizeTerminalTextEffectTriggers(triggers);
	const textReader = getText ?? ((node: HTMLElement) => node.dataset.greetingTarget ?? node.textContent?.trim() ?? "");
	const useRandomEffect = shouldHandleTerminalTextEffectTrigger(normalizedTriggers, "random-effect");

	const play = () => {
		const text = textReader(el);
		if (!text) return;
		playTerminalTextEffect({
			el,
			effect: resolveTerminalTextEffectKind(effect, useRandomEffect, Math.random()),
			text,
			durationMs,
			typingStepMs,
		});
	};

	const handlers = triggerHandlers.get(el) ?? {
		mouseenter: () => play(),
		touchstart: () => play(),
		click: () => play(),
	};
	triggerHandlers.set(el, handlers);

	if (shouldHandleTerminalTextEffectTrigger(normalizedTriggers, "load")) {
		play();
	}

	el.removeEventListener("mouseenter", handlers.mouseenter);
	el.removeEventListener("touchstart", handlers.touchstart);
	el.removeEventListener("click", handlers.click);

	const existingRandomTimer = randomTimers.get(el);
	if (existingRandomTimer !== undefined) {
		window.clearInterval(existingRandomTimer);
		randomTimers.delete(el);
	}

	if (shouldHandleTerminalTextEffectTrigger(normalizedTriggers, "hover")) {
		el.addEventListener("mouseenter", handlers.mouseenter);
	}

	if (shouldHandleTerminalTextEffectTrigger(normalizedTriggers, "tap")) {
		el.addEventListener("touchstart", handlers.touchstart, { passive: true });
	}

	if (shouldHandleTerminalTextEffectTrigger(normalizedTriggers, "click")) {
		el.addEventListener("click", handlers.click);
	}

	if (shouldHandleTerminalTextEffectTrigger(normalizedTriggers, "random-time")) {
		const intervalId = window.setInterval(() => {
			play();
		}, randomIntervalMs);
		randomTimers.set(el, intervalId);
	}
}
