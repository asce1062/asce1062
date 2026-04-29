/**
 * Flavor Manager
 *
 * Manages the optional color flavor system layered on top of the base
 * dark/light themes. Flavors override --color-* tokens via html[data-flavor]
 * attribute selectors in theme.css.
 *
 * Flavors are dark-mode-native. In light mode the flavor attribute is
 * present in the DOM but the CSS selectors require [data-theme="dark"]
 * so light mode is unaffected.
 *
 * Available flavors:
 *   ""           - default warm void (no attribute)
 *   "crt-green"  - phosphor green basement terminal
 *   "amber"      - warm legacy archival terminal
 *   "synthwave"  - cosmic neon demo-scene
 *   "dos"        - classic deep-blue system UI
 *   "void"       - near-pure black, maximum negative space
 *   "ice"        - cold arctic precision
 *   "redline"    - system anomaly tension
 *
 * API:
 *   getActiveFlavor() - reads the currently applied flavor from the DOM
 *   setFlavor(flavor) - applies a flavor to the DOM and persists it
 *   syncSwatches()    - syncs flavor swatch buttons to the active flavor
 *   initFlavorPicker(signal) - attach listeners to flavor swatch buttons
 *  switchFlavor(flavor, opts) - user-triggered flavor switch with transition
 *
 * Theme and flavor are separate orthogonal layers. Changing flavor does not affect the active theme, and vice versa.
 *
 * BROWSER-ONLY. Import only from client-side <script> blocks.
 */

import { getPref, setPref, removePref, PREF_KEYS } from "@/lib/prefs";
import { atomicSwitch } from "@/scripts/themeTransition";
import { resolveEffectiveTransitionStyle, type TransitionContext } from "@/scripts/transitionRegistry";
import { getStoredTransition } from "@/scripts/transitionManager";

export type Flavor = "crt-green" | "amber" | "synthwave" | "dos" | "void" | "ice" | "redline" | "";

export const FLAVORS: readonly Flavor[] = ["", "crt-green", "amber", "synthwave", "dos", "void", "ice", "redline"];

export const FLAVOR_LABELS: Record<Flavor, string> = {
	"": "Default",
	"crt-green": "CRT Green",
	amber: "Amber",
	synthwave: "Synthwave",
	dos: "DOS Blue",
	void: "Void",
	ice: "Ice",
	redline: "Redline",
};

/** Swatch color for each flavor (used as --swatch CSS custom property). */
export const FLAVOR_SWATCHES: Record<Flavor, string> = {
	"": "oklch(70% 0.191 22.216)",
	"crt-green": "oklch(78% 0.22 145)",
	amber: "oklch(75% 0.20 70)",
	synthwave: "oklch(72% 0.28 330)",
	dos: "oklch(82% 0.14 195)",
	void: "oklch(38% 0.003 0)",
	ice: "oklch(74% 0.17 195)",
	redline: "oklch(58% 0.25 22)",
};

/** Dispatched on document when the active flavor changes. detail: FlavorChangeDetail. */
export const FLAVOR_CHANGE_EVENT = "flavor-change";

/** Event detail emitted with every FLAVOR_CHANGE_EVENT. */
export interface FlavorChangeDetail {
	prevFlavor: Flavor;
	nextFlavor: Flavor;
}

/** Options for setFlavor(). */
export interface SetFlavorOptions {
	/** Write to localStorage. Default: true. */
	persist?: boolean;
	/** Dispatch FLAVOR_CHANGE_EVENT. Default: true. */
	emitEvent?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Single access point for the <html> element (avoids repeated document.documentElement). */
function getRoot(): HTMLElement {
	return document.documentElement;
}

/** Type guard: returns true if value is a known Flavor. */
export function isFlavor(value: string): value is Flavor {
	return FLAVORS.includes(value as Flavor);
}

// ---------------------------------------------------------------------------
// State readers
// ---------------------------------------------------------------------------

/** Return the stored flavor preference from localStorage. Empty string = default. */
export function getStoredFlavor(): Flavor {
	const stored = getPref(PREF_KEYS.flavor);
	if (stored && isFlavor(stored)) return stored;
	return "";
}

/**
 * Return the flavor currently applied to <html> via data-flavor attribute.
 * This is the live DOM state (the authoritative source during transitions).
 * Falls back to "" (default) if the attribute is absent or unrecognized.
 */
export function getActiveFlavor(): Flavor {
	const attr = getRoot().getAttribute("data-flavor") ?? "";
	return isFlavor(attr) ? attr : "";
}

// ---------------------------------------------------------------------------
// State mutation
// ---------------------------------------------------------------------------

/**
 * Apply a flavor to <html>. No-ops if the flavor is already active.
 *
 * Options:
 *   persist   - write to localStorage (default: true)
 *   emitEvent - dispatch FLAVOR_CHANGE_EVENT (default: true)
 *
 * Use { persist: false, emitEvent: false } for silent restoration on
 * page load / soft navigation to avoid triggering transition animations.
 */
export function setFlavor(flavor: Flavor, options: SetFlavorOptions = {}): void {
	const { persist = true, emitEvent = true } = options;

	const prevFlavor = getActiveFlavor();
	if (prevFlavor === flavor) return; // already applied so no work needed

	const applyToDOM = () => {
		if (flavor) {
			getRoot().setAttribute("data-flavor", flavor);
		} else {
			getRoot().removeAttribute("data-flavor");
		}
	};

	// User-initiated: freeze all per-element transitions so every element repaints
	// atomically in one frame. Silent restores (page load / after-swap) apply
	// directly (no transition freeze needed, no user is watching).
	if (emitEvent) {
		atomicSwitch(applyToDOM);
	} else {
		applyToDOM();
	}

	if (persist) {
		if (flavor) {
			setPref(PREF_KEYS.flavor, flavor);
		} else {
			removePref(PREF_KEYS.flavor);
		}
	}

	if (emitEvent) {
		document.dispatchEvent(
			new CustomEvent<FlavorChangeDetail>(FLAVOR_CHANGE_EVENT, {
				detail: { prevFlavor, nextFlavor: flavor },
			})
		);
	}
}

/**
 * Silently restore the stored flavor preference to <html>.
 * Does NOT persist (storage already has the value) or emit events
 * (no user action occurred so transition animations must not fire).
 */
export function applyStoredFlavor(): void {
	setFlavor(getStoredFlavor(), { persist: false, emitEvent: false });
}

// ---------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------

/**
 * Sync swatch button aria-pressed / active class to the live DOM state.
 * Reads getActiveFlavor() so it is accurate during animated transitions
 * where the DOM is updated before localStorage is written.
 */
export function syncSwatches(container: HTMLElement | Document = document): void {
	const active = getActiveFlavor();
	container.querySelectorAll<HTMLButtonElement>("[data-flavor-btn]").forEach((btn) => {
		const btnFlavor = btn.dataset.flavorBtn ?? "";
		const isActive = btnFlavor === active;
		btn.setAttribute("aria-pressed", String(isActive));
		btn.classList.toggle("nav-flavor-swatch--active", isActive);
	});
}

/**
 * Attach flavor swatch button listeners. Call once per soft navigation.
 *
 * Does NOT call applyStoredFlavor() (that is the caller's responsibility).
 * This keeps the separation clean: flavorPicker.ts decides when to restore,
 * initFlavorPicker() handles only UI wiring.
 *
 * Future transition animations should be orchestrated from the FLAVOR_CHANGE_EVENT
 * listener here, and not baked into setFlavor(), to keep state and animation separate.
 */
export function initFlavorPicker(signal: AbortSignal): void {
	syncSwatches();

	document.querySelectorAll<HTMLButtonElement>("[data-flavor-btn]").forEach((btn) => {
		btn.addEventListener(
			"click",
			() => {
				const raw = btn.dataset.flavorBtn ?? "";
				const flavor: Flavor = isFlavor(raw) ? raw : "";
				setFlavor(flavor);
			},
			{ signal }
		);
	});

	// Keep swatches in sync whenever flavor changes (from any call site)
	document.addEventListener(FLAVOR_CHANGE_EVENT, () => syncSwatches(), { signal });
}

// ─── User-triggered flow ─────────────────────────────────────────────────────

/**
 * User-triggered flavor switch. Resolves the effective transition style,
 * calls atomicSwitch, then dispatches FLAVOR_CHANGE_EVENT after the transition.
 *
 * Do NOT use this for silent restores (page load / soft-nav). Use setFlavor()
 * with { persist: false, emitEvent: false } for those.
 */
export function switchFlavor(
	flavor: Flavor,
	opts?: Partial<Pick<TransitionContext, "coords" | "triggerEl" | "source">>
): void {
	const prevFlavor = getActiveFlavor();
	if (prevFlavor === flavor) return;

	const storedTransition = getStoredTransition();
	const effectiveStyle = resolveEffectiveTransitionStyle(storedTransition, flavor);

	atomicSwitch(() => setFlavor(flavor, { persist: true, emitEvent: false }), {
		style: effectiveStyle,
		source: opts?.source ?? "flavor-swatch",
		reason: "user",
		coords: opts?.coords,
		triggerEl: opts?.triggerEl,
		prevFlavor,
		nextFlavor: flavor,
	});

	// Emit FLAVOR_CHANGE_EVENT after the atomic switch completes (not inside
	// applyChange, which would risk triggering a nested atomicSwitch call).
	document.dispatchEvent(
		new CustomEvent<FlavorChangeDetail>(FLAVOR_CHANGE_EVENT, {
			detail: { prevFlavor, nextFlavor: flavor },
		})
	);
}
