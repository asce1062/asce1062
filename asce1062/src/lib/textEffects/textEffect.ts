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
 *    Use `readTextEffectConfig` + `bindTextEffectTriggers`
 *    through `initTextEffectRegistry()` in `src/scripts/textEffectRegistry.ts`.
 *    Best for site greeting/tagline-style embellishments that should react to
 *    load/hover/tap/click/random timing.
 *
 * 2. State-driven consumers
 *    Call `playTextEffect` / `resetTextEffect` directly.
 *    Best for features where a coordinator/state machine decides exactly when
 *    an effect should run and which effect should be used.
 *
 * Motion vocabulary:
 *   - Effect names are the public/declarative values:
 *     `typing`, `backspace`, `decrypt`, `entropy`, `glitch-lock-on`,
 *     `signal-loss`, `corruption`, `censor`, `uncensor`, `scramble`,
 *     `slow-reveal`, `shuffle`.
 *   - Families are internal pairing groups:
 *     `type` pairs `typing` with `backspace`
 *     `cipher` pairs `decrypt` with `entropy`
 *     `rare` pairs `glitch-lock-on` with `signal-loss`;
 *     standalone effects (corruption, censor, uncensor, scramble, slow-reveal,
 *     shuffle) also live in `rare` but run without a paired phase
 *   - Roles describe lifecycle direction:
 *     `enter` effects reveal or resolve text into place
 *     `exit` effects remove or destabilize text before handoff
 *     `standalone` effects run as self-contained flourishes, restoring
 *     the stable text on completion
 *   - `standaloneSafe` means an effect may run as a flourish without changing
 *     the stable text. Example: `backspace` can delete and then restore the
 *     same text; `typing` is not used for random standalone selection because
 *     it reads more clearly as an enter/reveal phase.
 *
 * New effects should be registered in `TEXT_EFFECTS` with family,
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
 *   - `random-effect`    : randomize across the element's declared effect list
 *   - `random-time`     : replay at unpredictable times (delay randomized each fire)
 *   - `random-interval` : replay on a fixed, predictable interval
 *
 * Declarative markup contract:
 *   data-text-effect="typing"
 *   data-text-effect="decrypt, entropy, typing, backspace, glitch-lock-on, signal-loss"
 *   data-text-effect="glitch-lock-on, signal-loss"   // rare paired, explicit opt-in
 *   data-text-effect="corruption"                    // standalone corruption burst
 *   data-text-effect="censor, uncensor, scramble, slow-reveal, shuffle"
 *   data-text-effect-triggers="load, hover, activate, resume, route-enter, intersection, idle-return, content-change, random-effect, random-time, random-interval"
 *   data-text-effect-interval-ms="18000"
 *   data-text-effect-managed="manual"         // optional registry skip hint
 *
 * Per-effect tunable attributes (all optional, all backward-compatible):
 *
 *   Typing / backspace:
 *   data-text-effect-typing-cursor-char="▌"          // cursor character (default "█")
 *   data-text-effect-typing-cursor-blink-ms="400"    // cursor blink interval in ms (default 500)
 *   data-text-effect-typing-end-blink-count="5"      // trailing blinks after last char (default 3)
 *   data-text-effect-typing-lead-in-ms="200"         // pre-type pause in ms (default 120)
 *   data-text-effect-typing-stutter-chance="0.2"     // 0–1 probability of stutter pause (default 0.12)
 *   data-text-effect-typing-stutter-max-ms="600"     // max stutter pause in ms (default 420)
 *
 *   Glitch-lock-on:
 *   data-text-effect-glitch-lock-charset="letters"   // "blocks" | "letters" | "binary" | any string (default "blocks")
 *   data-text-effect-glitch-lock-reverse             // presence attribute — reverses lock-in direction (right→left)
 *   data-text-effect-glitch-lock-frames="10"         // frame count (default 6, min 3)
 *   data-text-effect-glitch-lock-intensity="0.5"     // scramble intensity 0–1 (default 1.0)
 *
 *   Signal-loss:
 *   data-text-effect-signal-dropout-char="░"         // character for dropped-out positions (default "_")
 *   data-text-effect-signal-blackout-ms="400"        // blackout hold duration in ms (default 760)
 *   data-text-effect-signal-false-recovery           // presence attribute — disables the mid-animation false-recovery flash
 *
 *   Corruption (standalone burst):
 *   data-text-effect-corruption-charset="letters"    // "blocks" | "letters" | "binary" | any string (default "blocks" → corruption symbols)
 *   data-text-effect-corruption-delay-ms="55"        // ms between each frame (overrides durationMs)
 *   data-text-effect-corruption-count="14"           // frame count (default 10, min 3)
 *   data-text-effect-corruption-intensity="0.5"      // fraction of chars corrupted per frame, 0–1 (default 0.5)
 *   data-text-effect-corruption-restore="false"      // "false" to leave the final corrupted frame; default true (restore)
 *   data-text-effect-corruption-items="▓,░,#,!"      // comma-separated corruption chars; takes precedence over charset
 *
 *   Censor:
 *   data-text-effect-censor-delay-ms="150"           // ms between each letter replacement (overrides durationMs)
 *   data-text-effect-censor-fill-char="░"            // masking character (default "█")
 *   data-text-effect-censor-restore="false"          // "false" to stay censored after fill; default true (restore)
 *   data-text-effect-censor-hold-ms="800"            // ms to hold censored state before restoring (default 0)
 *
 *   Note - Per-letter visual gaps between █ blocks:
 *   The renderer writes plain text. Apply `letter-spacing`
 *   to the element to create visible separation between fill characters:
 *     .your-element { letter-spacing: 0.04em; }
 *     or style="letter-spacing: 0.04em"
 *
 *   Uncensor:
 *   data-text-effect-uncensor-fill-char="░"          // masking character (default "█")
 *   data-text-effect-uncensor-delay-ms="18"         // ms between each letter reveal (overrides durationMs)
 *
 *   Scramble:
 *   data-text-effect-scramble-delay-ms="75"         // ms between each scramble tick (overrides durationMs)
 *   data-text-effect-scramble-count="28"             // noise iterations (default 20)
 *   data-text-effect-scramble-charset="letters"      // "blocks" | "letters" | "binary" | any string (default "blocks" → #!@$%^&*()-_+=)
 *   data-text-effect-scramble-restore="false"        // "false" to leave the final scrambled state; default true
 *   data-text-effect-scramble-items="#,@,$,!"        // comma-separated scramble chars; takes precedence over charset
 *
 *   Slow-reveal:
 *   data-text-effect-slow-reveal-delay-ms="55"      // ms between each step (overrides durationMs)
 *   data-text-effect-slow-reveal-cycles="3"          // slot-machine cycles before each char locks in (default 3)
 *   data-text-effect-slow-reveal-charset="letters"   // "blocks" | "letters" | "binary" | any string (default "blocks" → #!@$%^&*()-_+=)
 *   data-text-effect-slow-reveal-items="#,@,$,!"     // comma-separated slot-machine chars; takes precedence over charset
 *
 *   Shuffle:
 *   data-text-effect-shuffle-delay-ms="110"          // ms between each shuffle frame (overrides durationMs)
 *   data-text-effect-shuffle-count="14"              // anagram-shuffle frames (default 20)
 *   data-text-effect-shuffle-restore="false"         // "false" to leave the final shuffled frame; default true
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
export { DEFAULT_TEXT_EFFECT_TRIGGERS, DEFAULT_ROUTE_ENTER_SETTLE_DELAY_MS } from "./constants";
export * from "./utils";
export * from "./config";
export * from "./transition";
export * from "./triggers";
