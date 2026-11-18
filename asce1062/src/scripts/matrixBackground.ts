/**
 * Matrix Background
 *
 * Renders a Matrix-style hiragana rain effect on a fixed canvas behind the page.
 *
 * When enabled: injects a <canvas> as the first child of <body>, stamps
 * data-matrix-bg on <html> (CSS hides topography and suppresses stars GIF).
 * When disabled: removes the canvas and the attribute.
 *
 * localStorage key: "matrix-bg" - "1" when enabled; absent when disabled.
 *
 * Colors: theme-aware. Reads --color-base-100 (trail) and --color-matrix-rain
 * (characters) from CSS custom properties at runtime.
 *
 * Mutual exclusion with Stars: enabling Matrix dispatches "background:activate"
 * with detail "matrix". starsBackground.ts listens and fully disables itself.
 * The same event (detail "stars") triggers this script to fully disable itself.
 *
 * Lifecycle pattern mirrors starsBackground.ts / cursorBlink.ts:
 *   Module load      → applyPref() - immediate attribute + canvas apply
 *   astro:after-swap → re-stamp and rebuild canvas before paint on soft nav
 *   astro:page-load  → init() - sync toggle checkbox and re-attach listener
 *   storage event    → cross-tab sync
 *   background:activate (detail "stars") → full self-disable
 *
 * Animation:
 *   - Hiragana character set (full voiced + unvoiced syllabary)
 *   - 16px monospace columns across the full viewport width
 *   - Semi-transparent trail using --color-base-100 at opacity 0.05 each frame
 *   - Columns reset randomly when they pass the bottom (p > 0.975)
 *   - ~30 fps throttle via requestAnimationFrame + timestamp gate
 *   - Respects prefers-reduced-motion: a still frame of the rain instead of the
 *     animation, switching live when the preference changes
 *
 * BROWSER-ONLY. Import only from client-side <script> blocks.
 */

import { getPref, setPref, removePref, PREF_KEYS } from "@/lib/prefs";

const TOGGLE_ID = "matrix-background-toggle";
const ACTIVE_ATTR = "data-matrix-bg";
const CANVAS_ID = "matrix-rain-canvas";
const FONT_SIZE = 16;
const FRAME_INTERVAL = 1000 / 30; // ~30 fps
const STILL_TAIL_LENGTH = 14; // glyphs per column in the reduced-motion still

const _reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const CHARS =
	"ぱぷぺぴぽぴゃぴゅぴょざずぜじぞじゃじゅじょらるれりろりゃりゅりょやよゆ" +
	"ぢゃぢゅェォゥィオァャュアウエイあいえおんばぶべびぼびゃびゅびょはふへひほひゃひゅひょ" +
	"だづでぢどわゑゐをかくきけこきゃきゅきょさすせしそしゃしゅしょたつてちとちゃちゅちょ" +
	"なぬねにのにゃにゅにょまむめみもみゃみゅみょがぐげぎごぎゃぎゅぎょ";

// ── Theme-aware colors ──

let _trailColor = "rgba(0,0,0,0.05)";
let _charColor = "#00ff41";

function refreshColors(): void {
	const style = getComputedStyle(document.documentElement);
	const base = style.getPropertyValue("--color-base-100").trim();
	const matrix = style.getPropertyValue("--color-matrix-rain").trim();

	// base-100 is an oklch(...) string (append alpha channel for the trail).
	if (base) {
		_trailColor = base.replace(/\)$/, " / 0.05)");
	}
	if (matrix) {
		_charColor = matrix;
	}
}

// ── Canvas / animation state ──

let _canvas: HTMLCanvasElement | null = null;
let _ctx: CanvasRenderingContext2D | null = null;
let _drops: number[] = [];
let _rafId: number | null = null;
let _lastFrame = 0;

function buildCanvas(): void {
	// If our reference was detached by a soft navigation, reset state.
	if (_canvas && !document.body.contains(_canvas)) {
		stopAnimation();
		_canvas = null;
		_ctx = null;
		_drops = [];
	}

	if (_canvas) return;

	// Re-attach to any canvas left in the DOM from a previous render.
	const existing = document.getElementById(CANVAS_ID) as HTMLCanvasElement | null;
	if (existing) {
		_canvas = existing;
		_ctx = existing.getContext("2d");
		resizeCanvas();
		window.addEventListener("resize", resizeCanvas);
		return;
	}

	const canvas = document.createElement("canvas");
	canvas.id = CANVAS_ID;
	canvas.setAttribute("aria-hidden", "true"); // decorative
	document.body.prepend(canvas);
	_canvas = canvas;
	_ctx = canvas.getContext("2d");

	resizeCanvas();
	window.addEventListener("resize", resizeCanvas);
}

/** Layout size in CSS pixels; the backing store is this times devicePixelRatio. */
let _cssWidth = 0;
let _cssHeight = 0;

function resizeCanvas(): void {
	if (!_canvas) return;
	const cssWidth = window.innerWidth;
	const cssHeight = window.innerHeight;
	// Capped: the trail repaints the whole canvas every frame.
	const dpr = Math.min(window.devicePixelRatio || 1, 2);
	const pixelWidth = Math.round(cssWidth * dpr);
	const pixelHeight = Math.round(cssHeight * dpr);

	// Assigning width/height clears the bitmap; skip no-op resizes (mobile URL bar, drags).
	if (_canvas.width !== pixelWidth || _canvas.height !== pixelHeight) {
		_canvas.width = pixelWidth;
		_canvas.height = pixelHeight;
	}
	// Resizing resets the transform; draw in CSS pixels so glyphs stay crisp.
	_ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
	_cssWidth = cssWidth;
	_cssHeight = cssHeight;

	const cols = Math.floor(cssWidth / FONT_SIZE) + 1;
	// Preserve existing drops when resizing; initialise new columns randomly.
	const prev = _drops;
	_drops = Array.from(
		{ length: cols },
		(_, i) => prev[i] ?? Math.floor(Math.random() * (cssHeight / FONT_SIZE / 2)) + 1
	);

	// Resizing cleared the bitmap, and nothing repaints it without the animation.
	if (_reducedMotion.matches) drawStill();
}

function removeCanvas(): void {
	window.removeEventListener("resize", resizeCanvas);
	_canvas?.remove();
	_canvas = null;
	_ctx = null;
	_drops = [];
}

function tick(now: number): void {
	if (now - _lastFrame < FRAME_INTERVAL) {
		_rafId = requestAnimationFrame(tick);
		return;
	}
	_lastFrame = now;

	if (!_ctx || !_canvas) {
		_rafId = null; // let startAnimation() run again once a canvas exists
		return;
	}

	// Trail (semi-transparent base-100 rect each frame).
	_ctx.fillStyle = _trailColor;
	_ctx.fillRect(0, 0, _cssWidth, _cssHeight);

	// Characters (secondary color).
	_ctx.fillStyle = _charColor;
	_ctx.font = `${FONT_SIZE}px monospace`;

	for (let i = 0; i < _drops.length; i++) {
		const char = CHARS[Math.floor(Math.random() * CHARS.length)];
		_ctx.fillText(char, i * FONT_SIZE, _drops[i] * FONT_SIZE);

		if (_drops[i] * FONT_SIZE > _cssHeight && Math.random() > 0.975) {
			_drops[i] = 0;
		}

		_drops[i]++;
	}

	_rafId = requestAnimationFrame(tick);
}

/** Deterministic 0..1 value for a grid cell, so the still does not reshuffle on redraw. */
function cellNoise(col: number, row: number): number {
	let h = (Math.imul(col + 1, 374761393) ^ Math.imul(row + 1, 668265263)) >>> 0;
	h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
	return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * Reduced motion: one frozen frame of the rain. Each column gets a tail of
 * glyphs fading upward from a fixed head position.
 */
function drawStill(): void {
	if (!_ctx) return;
	_ctx.clearRect(0, 0, _cssWidth, _cssHeight);
	_ctx.fillStyle = _charColor;
	_ctx.font = `${FONT_SIZE}px monospace`;

	const rows = Math.ceil(_cssHeight / FONT_SIZE) + STILL_TAIL_LENGTH;
	for (let col = 0; col < _drops.length; col++) {
		const head = Math.floor(cellNoise(col, 0) * rows) + 1;
		for (let offset = 0; offset < STILL_TAIL_LENGTH; offset++) {
			const row = head - offset;
			if (row < 1) break;
			_ctx.globalAlpha = 1 - offset / STILL_TAIL_LENGTH;
			const char = CHARS[Math.floor(cellNoise(col, row) * CHARS.length)];
			_ctx.fillText(char, col * FONT_SIZE, row * FONT_SIZE);
		}
	}
	_ctx.globalAlpha = 1;
}

/** Paint the canvas the way the motion preference asks: animated, or a still. */
function render(): void {
	if (_reducedMotion.matches) {
		stopAnimation();
		drawStill();
	} else {
		startAnimation();
	}
}

function startAnimation(): void {
	if (_rafId !== null) return;
	_lastFrame = 0;
	_rafId = requestAnimationFrame(tick);
}

function stopAnimation(): void {
	if (_rafId !== null) {
		cancelAnimationFrame(_rafId);
		_rafId = null;
	}
}

// ── Pref application ──

function isActive(): boolean {
	return getPref(PREF_KEYS.matrixBackground) === "1";
}

function enable(): void {
	refreshColors();
	document.documentElement.setAttribute(ACTIVE_ATTR, "");
	buildCanvas();
	render();
}

function disable(): void {
	document.documentElement.removeAttribute(ACTIVE_ATTR);
	stopAnimation();
	removeCanvas();
}

function applyPref(): void {
	if (isActive()) {
		enable();
	} else {
		disable();
	}
}

// ── Lifecycle ──

let _ac: AbortController | null = null;

function init(): void {
	_ac?.abort();
	_ac = new AbortController();
	const { signal } = _ac;

	const toggle = document.getElementById(TOGGLE_ID) as HTMLInputElement | null;
	if (!toggle) return;

	toggle.checked = isActive();

	toggle.addEventListener(
		"change",
		() => {
			if (toggle.checked) {
				setPref(PREF_KEYS.matrixBackground, "1");
				// Notify stars to fully disable itself.
				document.dispatchEvent(new CustomEvent("background:activate", { detail: "matrix" }));
			} else {
				removePref(PREF_KEYS.matrixBackground);
			}
			applyPref();
		},
		{ signal }
	);
}

// Apply at module load.
applyPref();
init();

// Watch for live theme changes (user toggles light/dark mode).
// Refresh colors immediately and clear the canvas so the old trail doesn't persist.
new MutationObserver(() => {
	refreshColors();
	if (_ctx && _canvas) {
		_ctx.clearRect(0, 0, _cssWidth, _cssHeight);
		if (_reducedMotion.matches) drawStill();
	}
}).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-flavor"] });

// Follow the motion preference live: swap between the animation and the still.
_reducedMotion.addEventListener("change", () => {
	if (!isActive() || !_ctx) return;
	_ctx.clearRect(0, 0, _cssWidth, _cssHeight);
	render();
});

// Re-stamp attribute and rebuild canvas before new page's content becomes
// visible on soft navigation (body is replaced by ClientRouter).
document.addEventListener("astro:after-swap", () => {
	refreshColors();
	applyPref();
});

// Re-sync toggle and re-attach listener after each navigation.
document.addEventListener("astro:page-load", () => {
	refreshColors();
	init();
});

// Cross-tab sync.
window.addEventListener("storage", (e) => {
	if (e.key === PREF_KEYS.matrixBackground) {
		applyPref();
		const toggle = document.getElementById(TOGGLE_ID) as HTMLInputElement | null;
		if (toggle) toggle.checked = isActive();
	}
	// If stars was enabled in another tab, disable matrix here too.
	if (e.key === PREF_KEYS.starsBackground && e.newValue === "1") {
		removePref(PREF_KEYS.matrixBackground);
		disable();
		const toggle = document.getElementById(TOGGLE_ID) as HTMLInputElement | null;
		if (toggle) toggle.checked = false;
	}
});

// Mutual exclusion: if stars was activated in this tab, fully disable matrix.
document.addEventListener("background:activate", (e) => {
	if ((e as CustomEvent).detail !== "stars") return;
	removePref(PREF_KEYS.matrixBackground);
	disable();
	const toggle = document.getElementById(TOGGLE_ID) as HTMLInputElement | null;
	if (toggle) toggle.checked = false;
});
