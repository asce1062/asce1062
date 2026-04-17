import { bindTerminalTextEffectTriggers, readTerminalTextEffectConfig } from "@/lib/textEffects/terminalTextEffect";

function initTextEffectRegistry(): void {
	const elements = document.querySelectorAll<HTMLElement>("[data-text-effect]");

	for (const el of elements) {
		const config = readTerminalTextEffectConfig(el);
		if (!config) continue;

		bindTerminalTextEffectTriggers({
			el,
			effect: config.effect,
			triggers: config.triggers,
			randomIntervalMs: config.randomIntervalMs,
		});
	}
}

document.addEventListener("astro:page-load", initTextEffectRegistry);
