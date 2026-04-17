import type { NavBrandEffect } from "@/lib/navBrand/state";

const DECRYPT_CHARS = "░▒▓█▐▌▄▀■□▪▫◆◇○●◌◍◎◉▶▷◀◁▸▹◂◃⬛⬜▬▭▮▯◥◤◣◢◿█▄▌▐▀▘▝▀▖▍▞▛▗▚▐▜▃▙▟▉";
const TYPING_STEP_MS = 26;
const DECRYPT_DURATION_MS = 700;
const DECRYPT_TOTAL_FRAMES = 40;

type ActiveEffectHandle = {
	cancel: () => void;
};

const activeEffects = new WeakMap<HTMLElement, ActiveEffectHandle>();

function clearActiveEffect(el: HTMLElement): void {
	activeEffects.get(el)?.cancel();
	activeEffects.delete(el);
}

export function resetNavBrandEffect(el: HTMLElement | null, rootEl?: HTMLElement | null): void {
	if (!el) return;
	clearActiveEffect(el);

	if (rootEl) {
		rootEl.dataset.navbrandEffect = "none";
	}

	const target = el.dataset.greetingTarget ?? el.textContent ?? "";
	el.textContent = target;
}

export function playNavBrandEffect(options: {
	el: HTMLElement | null;
	rootEl?: HTMLElement | null;
	effect: NavBrandEffect;
	text: string;
	onComplete?: () => void;
}): boolean {
	const { el, rootEl, effect, text, onComplete } = options;
	if (!el) return false;

	clearActiveEffect(el);
	el.dataset.greetingTarget = text;

	if (effect === "none") {
		if (rootEl) rootEl.dataset.navbrandEffect = "none";
		el.textContent = text;
		onComplete?.();
		return false;
	}

	if (rootEl) rootEl.dataset.navbrandEffect = effect;

	if (effect === "typing") {
		el.textContent = "";
		let index = 0;
		const timeoutId = window.setInterval(() => {
			index += 1;
			el.textContent = text.slice(0, index);

			if (index >= text.length) {
				window.clearInterval(timeoutId);
				activeEffects.delete(el);
				if (rootEl) rootEl.dataset.navbrandEffect = "none";
				onComplete?.();
			}
		}, TYPING_STEP_MS);

		activeEffects.set(el, {
			cancel: () => window.clearInterval(timeoutId),
		});
		return true;
	}

	let frame = 0;
	const frameInterval = DECRYPT_DURATION_MS / DECRYPT_TOTAL_FRAMES;
	const intervalId = window.setInterval(() => {
		const resolved = Math.floor((frame / DECRYPT_TOTAL_FRAMES) * text.length);

		el.textContent = text
			.split("")
			.map((char, i) => {
				if (char === " ") return char;
				if (i < resolved) return char;
				return DECRYPT_CHARS[Math.floor(Math.random() * DECRYPT_CHARS.length)];
			})
			.join("");

		frame += 1;

		if (frame >= DECRYPT_TOTAL_FRAMES) {
			window.clearInterval(intervalId);
			activeEffects.delete(el);
			el.textContent = text;
			if (rootEl) rootEl.dataset.navbrandEffect = "none";
			onComplete?.();
		}
	}, frameInterval);

	activeEffects.set(el, {
		cancel: () => window.clearInterval(intervalId),
	});
	return true;
}
