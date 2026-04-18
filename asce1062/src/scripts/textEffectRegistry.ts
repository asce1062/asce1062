/**
 * Declarative text-effect registry.
 *
 * Purpose:
 *   Bind shared terminal-text flourishes to any element that declares the
 *   correct `data-text-effect*` attributes in markup.
 *
 * Why this exists:
 *   We do not want one-off scripts that each:
 *   - query a single element
 *   - call bindTerminalTextEffectTriggers(...)
 *   - re-register on every astro:page-load
 *
 * Instead, trigger-driven decorative surfaces opt in declaratively and this
 * registry handles the binding centrally.
 *
 * Use this path for:
 *   - site greeting / tagline flourishes
 *   - decorative labels or headings
 *   - any element whose effect timing is load/hover/tap/click/random driven
 *
 * Do NOT use this path for:
 *   - navbrand state transitions
 *   - any system where a state machine explicitly decides when the effect plays
 *   In those cases, call the shared engine directly.
 *
 * Markup contract:
 *   data-text-effect="typing"
 *   data-text-effect="typing, decrypt"
 *   data-text-effect-triggers="load, hover, activate, resume, route-enter, intersection, idle-return, random-effect, random-time"
 *   data-text-effect-interval-ms="18000"    // optional, used by random-time
 *
 * Lifecycle:
 *   - Runs on every astro:page-load
 *   - Re-binds safely after Astro soft navigation replaces DOM nodes
 *   - Delegates parsing/binding details to `terminalTextEffect.ts`
 *
 * Adding a new flourish target:
 *   1. Add the `data-text-effect*` attributes to the element in markup.
 *   2. Ensure `@/scripts/textEffectRegistry` is imported somewhere on the page.
 *   3. Do not create a new one-off init script unless the element is
 *      state-driven rather than trigger-driven.
 */
import { bindTerminalTextEffectTriggers, readTerminalTextEffectConfig } from "@/lib/textEffects/terminalTextEffect";

function initTextEffectRegistry(): void {
	const elements = document.querySelectorAll<HTMLElement>("[data-text-effect]");

	for (const el of elements) {
		const config = readTerminalTextEffectConfig(el);
		if (!config) continue;

		bindTerminalTextEffectTriggers({
			el,
			effects: config.effects,
			triggers: config.triggers,
			randomIntervalMs: config.randomIntervalMs,
		});
	}
}

document.addEventListener("astro:page-load", initTextEffectRegistry);
