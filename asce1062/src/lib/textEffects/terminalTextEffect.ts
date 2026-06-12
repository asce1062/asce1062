/**
 * Shared terminal-text flourish engine.
 *
 * This module is the reusable implementation layer for terminal-adjacent text
 * motion. It supports both small decorative flourishes and full text-to-text
 * transitions where one stable string exits before the next stable string
 * enters.
 *
 * It supports two integration styles:
 *
 * 1. Trigger-driven consumers
 *    Use `readTerminalTextEffectConfig` + `bindTerminalTextEffectTriggers`
 *    through `initTextEffectRegistry()` in `src/scripts/textEffectRegistry.ts`.
 *    Best for site greeting/tagline-style embellishments that should react to
 *    load/hover/tap/click/random timing.
 *
 * 2. State-driven consumers
 *    Call `playTerminalTextEffect` / `resetTerminalTextEffect` directly.
 *    Best for features where a coordinator/state machine decides exactly when
 *    an effect should run and which effect should be used.
 *
 * Motion vocabulary:
 *   - Effect names are the public/declarative values:
 *     `typing`, `backspace`, `decrypt`, `entropy`, `glitch-lock-on`,
 *     `signal-loss`.
 *   - Families are internal pairing groups:
 *     `type` pairs `typing` with `backspace`
 *     `cipher` pairs `decrypt` with `entropy`
 *     `rare` pairs `glitch-lock-on` with `signal-loss`
 *   - Roles describe lifecycle direction:
 *     `enter` effects reveal or resolve text into place
 *     `exit` effects remove or destabilize text before handoff
 *     `standalone` is reserved for future effects that are neither directional
 *   - `standaloneSafe` means an effect may run as a flourish without changing
 *     the stable text. Example: `backspace` can delete and then restore the
 *     same text; `typing` is not used for random standalone selection because
 *     it reads more clearly as an enter/reveal phase.
 *
 * New effects should be registered in `TERMINAL_TEXT_EFFECTS` with family,
 * lifecycle role, standalone eligibility, and reduced-motion strategy before
 * adding a renderer. The transition coordinator uses that metadata to keep
 * randomization, standalone flourishes, and reduced-motion behavior coherent.
 *
 * Stable text model:
 *   - `data-text-effect-stable-text` is the generic cache of the element's
 *     settled text after an effect completes.
 *   - `data-greeting-target` is still written for backwards compatibility with
 *     older navbrand/header code, but new consumers should treat
 *     `data-text-effect-stable-text` as the generic contract.
 *   - `load` uses entry-only playback. Later replay triggers for enter effects
 *     use the full family loop against the stable text:
 *     stable text -> paired exit -> same stable text -> enter.
 *   - `content-change` is the explicit trigger for dynamic surfaces. When the
 *     element's observed content changes, playback becomes:
 *     old stable content -> paired exit -> new content -> enter.
 *
 * Trigger vocabulary:
 *   - `load`          : play immediately when bound
 *   - `hover`         : play on mouseenter
 *   - `focus`         : play when the element receives focus
 *   - `activate`      : semantic alias for tap + click activation
 *   - `tap`           : play on touchstart
 *   - `click`         : play on click (desktop-friendly activation)
 *   - `resume`        : play when the tab becomes visible again
 *   - `route-enter`   : play after Astro soft-navigation swaps in the route
 *   - `intersection`  : play when the element scrolls into view
 *   - `idle-return`   : play when the user returns after inactivity
 *   - `content-change`: play when the element's observed content changes
 *   - `manual`        : reserved for explicit external triggering
 *   - `random-effect` : randomize across the element's declared effect list
 *   - `random-time`   : replay on an interval
 *
 * Declarative markup contract:
 *   data-text-effect="typing"
 *   data-text-effect="decrypt, entropy, typing, backspace, glitch-lock-on, signal-loss"
 *   data-text-effect="glitch-lock-on, signal-loss" // rare, explicit opt-in
 *   data-text-effect-triggers="load, hover, activate, resume, route-enter, intersection, idle-return, content-change, random-effect, random-time"
 *   data-text-effect-interval-ms="18000"
 *   data-text-effect-managed="manual"         // optional registry skip hint
 *
 * Design constraints:
 *   - Keep playback logic centralized so flourish behavior stays consistent.
 *   - Keep trigger logic generic so new flourish targets do not need bespoke
 *     scripts or duplicated querySelector boilerplate.
 *   - Keep state-driven timing out of this file; navbrand-style policy belongs
 *     in coordinator/state modules such as `src/scripts/navBrand.ts` and
 *     `src/lib/navBrand/state.ts`, while this file only parses, binds, and
 *     plays effects.
 */
export * from "./types";
export { DEFAULT_TERMINAL_TEXT_EFFECT_TRIGGERS, DEFAULT_ROUTE_ENTER_SETTLE_DELAY_MS } from "./constants";
export * from "./utils";
export * from "./config";
export * from "./transition";
export * from "./triggers";
