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
 *   - sidebar navbrand greeting/teaser flourishes
 *   - decorative labels or headings
 *   - any element whose effect timing is load/hover/tap/click/random driven
 *
 * Do NOT use this path for:
 *   - any system where a state machine explicitly decides when the effect plays
 *   In those cases, call the shared engine directly.
 *
 * Markup contract:
 *   data-text-effect="typing"
 *   data-text-effect="typing, decrypt, backspace, entropy"
 *   data-text-effect-triggers="load, hover, activate, resume, route-enter, intersection, idle-return, content-change, random-effect, random-time"
 *   data-text-effect-interval-ms="18000"    // optional, used by random-time
 *   data-text-effect-managed="manual"       // optional, skip registry binding
 *
 * Motion behavior:
 *   - `data-text-effect` lists effect names, not family names. Use public
 *     effect values such as `typing`, `decrypt`, `backspace`, `entropy`,
 *     `glitch-lock-on`, or `signal-loss`.
 *   - The shared engine maps those effects into internal families:
 *     `type`, `cipher`, and `rare`. Families only exist so the engine can infer
 *     the paired phase for a transition.
 *   - `load` is entry-only so initial paint reads as arrival/reveal, not a
 *     delete-then-retype loop.
 *   - Replay triggers (`hover`, `focus`, `activate`, `resume`, `route-enter`,
 *     `intersection`, `idle-return`, `random-time`) run entry effects as a
 *     family loop: paired exit first, then the declared entry effect
 *     (`backspace -> typing`, `entropy -> decrypt`,
 *     `signal-loss -> glitch-lock-on`).
 *   - `route-enter` is delayed briefly after Astro swaps the route so effects
 *     start after the new page has settled.
 *   - `content-change` is the explicit dynamic-content trigger. When declared,
 *     the engine observes the element and runs old stable content through the
 *     paired exit before entering the new content.
 *   - Declared exit effects (`backspace`, `entropy`, `signal-loss`) remain
 *     standalone flourishes that can restore the stable text.
 *   - `standaloneSafe` effects may be chosen for random standalone playback
 *     because they can settle without changing the stable text.
 *   - Rare effects such as `glitch-lock-on` / `signal-loss` are opt-in only:
 *     declare them explicitly when a surface has earned that extra energy.
 *   - `data-text-effect-stable-text` is the generic stable-text cache. The
 *     engine still mirrors to `data-greeting-target` for older consumers, but
 *     new surfaces should not depend on greeting-specific naming.
 *
 * Lifecycle:
 *   - Runs on every astro:page-load
 *   - First page-load plays `load`; later Astro page-loads are treated as the
 *     visible `route-enter` moment for newly swapped DOM nodes.
 *   - Re-binds safely after Astro soft navigation replaces DOM nodes
 *   - Delegates parsing/binding details to `terminalTextEffect.ts`
 *
 * Adding a new flourish target:
 *   1. Add the `data-text-effect*` attributes to the element in markup.
 *   2. Ensure `@/scripts/textEffectRegistry` is imported somewhere on the page.
 *   3. Do not create a new one-off init script unless the element is
 *      state-driven rather than trigger-driven.
 */
import {
	DEFAULT_ROUTE_ENTER_SETTLE_DELAY_MS,
	bindTerminalTextEffectTriggers,
	readTerminalTextEffectConfig,
} from "@/lib/textEffects/terminalTextEffect";

let hasInitializedTextEffectRegistry = false;

function initTextEffectRegistry(): void {
	const initialTrigger = hasInitializedTextEffectRegistry ? "route-enter" : "load";
	hasInitializedTextEffectRegistry = true;
	const elements = document.querySelectorAll<HTMLElement>(
		"[data-text-effect]:not([data-text-effect-managed='manual'])"
	);

	for (const el of elements) {
		const config = readTerminalTextEffectConfig(el);
		if (!config) continue;

		bindTerminalTextEffectTriggers({
			el,
			effects: config.effects,
			triggers: config.triggers,
			initialTrigger,
			initialDelayMs: DEFAULT_ROUTE_ENTER_SETTLE_DELAY_MS,
			randomIntervalMs: config.randomIntervalMs,
		});
	}
}

document.addEventListener("astro:page-load", initTextEffectRegistry);
