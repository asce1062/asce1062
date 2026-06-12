import type { TerminalTextEffectKind, TerminalTextEffectTrigger, TerminalTextEffectConfig } from "./types";
import { TERMINAL_TEXT_EFFECTS } from "./types";
import { DEFAULT_TERMINAL_TEXT_EFFECT_TRIGGERS } from "./constants";

export function normalizeTerminalTextEffectKinds(effects: TerminalTextEffectKind[]): TerminalTextEffectKind[] {
	return [...new Set(effects)];
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

/**
 * Declarative parser for the registry path.
 *
 * Supported attributes:
 * - `data-text-effect="typing"` or `data-text-effect="typing, decrypt, backspace, entropy"`
 * - `data-text-effect-triggers="load, hover, activate, resume, route-enter, intersection, idle-return, content-change, random-effect, random-time"`
 * - `data-text-effect-interval-ms="18000"`
 * - `data-text-effect-managed="manual"` to opt out of the declarative registry
 *
 * Parsing is intentionally strict:
 * - unknown effects are ignored; if nothing valid remains, the registry skips the element
 * - multiple effects are allowed so `random-effect` can choose from the
 *   element's declared set rather than a hardcoded global pair
 * - declaring an enter effect is enough for full transitions; the paired exit
 *   is inferred from metadata when stable content replays or changes
 * - declaring an exit effect allows explicit standalone flourishes such as
 *   `backspace` or `entropy`
 * - trigger strings are normalized/deduplicated before binding
 * - invalid interval values are ignored rather than crashing
 */
export function readTerminalTextEffectConfig(el: HTMLElement): TerminalTextEffectConfig | null {
	const effects = el.dataset.textEffect
		?.split(",")
		.map((value) => value.trim())
		.filter((value): value is TerminalTextEffectKind => value in TERMINAL_TEXT_EFFECTS);

	if (!effects || effects.length === 0) {
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
		effects: normalizeTerminalTextEffectKinds(effects),
		triggers: normalizeTerminalTextEffectTriggers(rawTriggers),
		randomIntervalMs: Number.isFinite(intervalValue) ? intervalValue : undefined,
	};
}
