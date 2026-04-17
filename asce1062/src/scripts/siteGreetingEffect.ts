import { bindTerminalTextEffectTriggers } from "@/lib/textEffects/terminalTextEffect";

function initSiteGreetingEffect(): void {
	const el = document.querySelector<HTMLElement>(".site-greeting");
	if (!el) return;

	bindTerminalTextEffectTriggers({
		el,
		effect: "decrypt",
		triggers: ["load", "hover", "tap", "click", "random-effect", "random-time"],
		randomIntervalMs: 18_000,
	});
}

document.addEventListener("astro:page-load", initSiteGreetingEffect);
