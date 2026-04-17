import { bindTerminalTextEffectTriggers } from "@/lib/textEffects/terminalTextEffect";

function initGreetingReveal(): void {
	const el = document.querySelector<HTMLElement>(".site-greeting");
	if (!el) return;

	bindTerminalTextEffectTriggers({
		el,
		effect: "decrypt",
		triggers: ["load", "hover", "tap"],
	});
}

document.addEventListener("astro:page-load", initGreetingReveal);
