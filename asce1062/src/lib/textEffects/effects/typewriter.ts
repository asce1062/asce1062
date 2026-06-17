import type { EffectRendererHandle, TypewriterEffectOptions } from "../types";
import {
	DEFAULT_TYPEWRITER_DELAY_MS,
	DEFAULT_TYPEWRITER_CURSOR_CHAR,
	DEFAULT_TYPEWRITER_CURSOR_BLINK_MS,
	DEFAULT_TYPEWRITER_STUTTER_CHANCE,
	DEFAULT_TYPEWRITER_STUTTER_MS,
	DEFAULT_TYPEWRITER_CYCLE_DELAY_MS,
} from "../constants";

// Tracks the active cursor-blink stop function per element. A new render
// invocation checks this first so any blink started after a prior completed
// run is cancelled before new typing begins.
const activeCursorCleanups = new WeakMap<HTMLElement, () => void>();

export function runTypewriterRenderer(
	el: HTMLElement,
	text: string,
	options: TypewriterEffectOptions = {}
): EffectRendererHandle {
	// Cancel any orphaned cursor blink from a previous completed run on this element.
	activeCursorCleanups.get(el)?.();
	activeCursorCleanups.delete(el);

	const {
		cycle,
		cycleDelayMs = DEFAULT_TYPEWRITER_CYCLE_DELAY_MS,
		loop = false,
		delayMs = DEFAULT_TYPEWRITER_DELAY_MS,
		cursorChar = DEFAULT_TYPEWRITER_CURSOR_CHAR,
		cursorBlinkIntervalMs = DEFAULT_TYPEWRITER_CURSOR_BLINK_MS,
		stutterChance = DEFAULT_TYPEWRITER_STUTTER_CHANCE,
		stutterMs = DEFAULT_TYPEWRITER_STUTTER_MS,
		leadInMs = 0,
	} = options;

	// When cycle items are provided and the element already has content, type
	// the existing content first, then proceed through the cycle list.
	// When the element is empty (or cycle is not set), use cycle alone (or [text]).
	const cycleItems = cycle && cycle.length > 0 ? cycle : null;
	const texts = cycleItems ? (text ? [text, ...cycleItems] : cycleItems) : [text];

	let cancelled = false;
	let resolvePromise: () => void = () => {};
	const promise = new Promise<void>((resolve) => {
		resolvePromise = resolve;
	});

	let currentTyped = "";
	let cursorVisible = true;
	let cursorInterval: ReturnType<typeof globalThis.setInterval> | null = null;
	let pendingTimer: ReturnType<typeof globalThis.setTimeout> | null = null;

	// DOM span references — populated when document is available (browsers).
	//
	// A single wrapper span is the element's only child, so it becomes the
	// element's only grid/flex item regardless of the element's display mode.
	// Inside the wrapper, textSpan and cursorSpan flow inline. cursorSpan is
	// always in the DOM with its cursor character; blink is achieved by toggling
	// visibility: hidden/visible rather than adding/removing the character from
	// the string. This means the wrapper's width never changes during blinking,
	// preventing layout shifts in centered, right-aligned, or grid contexts.
	//
	// In node/test environments document is not defined, so these remain null
	// and the textContent fallback path is used instead.
	let textSpan: HTMLSpanElement | null = null;
	let cursorSpan: HTMLSpanElement | null = null;

	function render(): void {
		if (textSpan) {
			textSpan.textContent = currentTyped;
		} else {
			el.textContent = currentTyped + (cursorVisible ? cursorChar : "");
		}
	}

	function clearPendingTimer(): void {
		if (pendingTimer !== null) {
			globalThis.clearTimeout(pendingTimer);
			pendingTimer = null;
		}
	}

	function stopCursorBlink(): void {
		if (cursorInterval !== null) {
			globalThis.clearInterval(cursorInterval);
			cursorInterval = null;
		}
		cursorVisible = true;
		if (cursorSpan) {
			cursorSpan.style.visibility = "visible";
		}
	}

	function startCursorBlink(): void {
		if (cursorInterval !== null) return;
		cursorInterval = globalThis.setInterval(() => {
			if (cancelled) return;
			cursorVisible = !cursorVisible;
			if (cursorSpan) {
				cursorSpan.style.visibility = cursorVisible ? "visible" : "hidden";
			} else {
				render();
			}
		}, cursorBlinkIntervalMs);
		activeCursorCleanups.set(el, stopCursorBlink);
	}

	function wait(ms: number): Promise<void> {
		return new Promise((resolve) => {
			pendingTimer = globalThis.setTimeout(() => {
				pendingTimer = null;
				resolve();
			}, ms);
		});
	}

	async function typeChars(target: string): Promise<void> {
		stopCursorBlink();
		cursorVisible = true;
		for (let i = 0; i <= target.length; i++) {
			if (cancelled) return;
			currentTyped = target.slice(0, i);
			render();
			if (i < target.length && !cancelled) {
				let charDelay = delayMs;
				if (stutterChance > 0 && Math.random() < stutterChance) {
					charDelay += Math.floor(Math.random() * stutterMs);
				}
				await wait(charDelay);
			}
		}
	}

	async function backspaceChars(): Promise<void> {
		stopCursorBlink();
		cursorVisible = true;
		for (let i = currentTyped.length; i >= 0; i--) {
			if (cancelled) return;
			currentTyped = currentTyped.slice(0, i);
			render();
			if (i > 0 && !cancelled) {
				await wait(delayMs);
			}
		}
	}

	async function run(): Promise<void> {
		// Set up DOM spans immediately — before any delay — so the cursor is
		// visible (and blinking) from the very first frame. This mirrors the
		// reference implementation where the cursor is always rendered and the
		// initialDelay only delays when typing starts, not when the cursor appears.
		//
		// In node/test environments where document is undefined the textContent
		// fallback path is used instead (textSpan / cursorSpan stay null).
		if (typeof document !== "undefined") {
			const wrapper = document.createElement("span");
			textSpan = document.createElement("span");
			cursorSpan = document.createElement("span");
			cursorSpan.textContent = cursorChar;
			cursorSpan.setAttribute("aria-hidden", "true");
			cursorSpan.dataset.typewriterCursor = "true";
			// `all: inherit` (inline specificity 1000) forces every CSS property to
			// inherit from el, overriding any external rule targeting these spans
			// (e.g. `.container span { color: primary }`). `display: inline` is then
			// set after to override the inherited `display` — necessary because a
			// child of a grid/flex container would otherwise be block-ified, which
			// would put the cursor span on its own line.
			wrapper.style.cssText = "all: inherit; display: inline;";
			textSpan.style.cssText = "all: inherit; display: inline;";
			cursorSpan.style.cssText = "all: inherit; display: inline; visibility: visible;";
			wrapper.appendChild(textSpan);
			wrapper.appendChild(cursorSpan);
			el.textContent = "";
			el.appendChild(wrapper);
		}

		// Render initial state (empty text, cursor visible) and start blinking
		// during lead-in so the element shows a blinking cursor rather than its
		// prior content during the delay.
		render();
		if (leadInMs > 0 && !cancelled) {
			startCursorBlink();
			await wait(leadInMs);
			// typeChars() calls stopCursorBlink() at its own start.
		}
		if (cancelled) {
			resolvePromise();
			return;
		}

		let textIndex = 0;

		while (!cancelled) {
			const target = texts[textIndex % texts.length]!;

			await typeChars(target);
			if (cancelled) break;

			const isLastItem = textIndex >= texts.length - 1;

			if (isLastItem && !loop) {
				// DOM span path: textSpan already holds currentTyped; cursor span
				// is visible and will blink via visibility toggling — no text change needed.
				// textContent fallback path: explicitly set stable text without cursor.
				if (!textSpan) {
					el.textContent = currentTyped;
				}
				resolvePromise();
				startCursorBlink();
				return;
			}

			// Hold with blinking cursor before backspacing.
			startCursorBlink();
			await wait(cycleDelayMs);
			stopCursorBlink();
			if (cancelled) break;

			await backspaceChars();
			if (cancelled) break;

			textIndex = loop ? (textIndex + 1) % texts.length : textIndex + 1;
		}

		// Reached only when cancelled mid-cycle.
		// Setting textContent removes any DOM spans and leaves clean plain text.
		el.textContent = currentTyped;
		resolvePromise();
	}

	void run();

	return {
		promise,
		cancel: () => {
			if (cancelled) return;
			cancelled = true;
			clearPendingTimer();
			stopCursorBlink();
			activeCursorCleanups.delete(el);
			// Restore plain text; this also removes any DOM span wrapper.
			el.textContent = currentTyped;
			textSpan = null;
			cursorSpan = null;
			resolvePromise();
		},
	};
}
