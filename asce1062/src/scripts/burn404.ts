/**
 * Burn 404
 * Doom-fire flourish for the 404 page.
 *
 * Canvas-based fire effect that rises from the bottom of the 404 route.
 * Effect is on by default and can be disabled via the sidebar "Burn 404"
 * toggle. Only activates when data-page-404 is present in the DOM (404.astro sentinel).
 *
 * localStorage key: "flourish-burn404" - "0" when disabled; absent otherwise.
 *
 * Lifecycle pattern mirrors starsBackground.ts / matrixBackground.ts:
 *   Module load      → applyPref()
 *   astro:after-swap → applyPref() (remove canvas when leaving 404 page)
 *   astro:page-load  → init() (sync toggle + re-attach listener)
 *   storage event    → cross-tab sync
 *
 * Respects prefers-reduced-motion: no RAF loop when reduced motion requested.
 *
 * BROWSER-ONLY. Import only from client-side <script> blocks.
 */

import { getPref, setPref, removePref, PREF_KEYS } from "@/lib/prefs";
import { buildPalette, getActiveColorStops } from "@/scripts/burn404palettes";

// ── Public constants (exported for tests) ──────────────────────────────────

export const MAX_INTENSITY = 36;

/**
 * 37-step Doom-fire palette. Index 0 = transparent (cold); index 36 = white (hottest).
 * Each entry: [r, g, b, a] (0–255).
 *
 * Mutable so rebuildPalette() can swap in a theme/flavor-aware version at runtime.
 * The hardcoded array below serves as the static fallback for SSR, tests, and the
 * initial paint before any theme event fires.
 */
export let PALETTE: readonly [number, number, number, number][] = [
	[0, 0, 0, 0],
	[7, 7, 7, 200],
	[31, 7, 7, 230],
	[47, 15, 7, 240],
	[71, 15, 7, 245],
	[87, 23, 7, 250],
	[103, 31, 7, 255],
	[119, 31, 7, 255],
	[143, 39, 7, 255],
	[159, 47, 7, 255],
	[175, 63, 7, 255],
	[191, 71, 7, 255],
	[199, 79, 7, 255],
	[207, 87, 7, 255],
	[215, 95, 7, 255],
	[223, 103, 7, 255],
	[231, 111, 15, 255],
	[239, 119, 15, 255],
	[247, 127, 15, 255],
	[255, 135, 23, 255],
	[255, 151, 31, 255],
	[255, 159, 31, 255],
	[255, 167, 39, 255],
	[255, 175, 47, 255],
	[255, 183, 47, 255],
	[255, 191, 55, 255],
	[255, 199, 63, 255],
	[255, 207, 63, 255],
	[255, 215, 71, 255],
	[255, 223, 79, 255],
	[255, 231, 87, 255],
	[255, 239, 95, 255],
	[255, 243, 111, 255],
	[255, 247, 127, 255],
	[255, 251, 163, 255],
	[255, 255, 207, 255],
	[255, 255, 255, 255],
];

// ── Palette rebuild ─────────────────────────────────────────────────────────

/**
 * Regenerate PALETTE from the currently active theme + flavor.
 * No-ops in non-browser environments. Falls back to the hardcoded static
 * palette when canvas is unavailable (e.g. tests, SSR).
 */
export function rebuildPalette(): void {
	const built = buildPalette(getActiveColorStops());
	if (built.length > 0) PALETTE = built;
}

// ── Pure fire algorithm (exported for tests) ────────────────────────────────

/**
 * Initialize a flat fire buffer (width × height). Bottom row = `intensity`,
 * all other cells = 0.
 */
export function initFire(width: number, height: number, intensity: number = MAX_INTENSITY): number[] {
	const buf = new Array<number>(width * height).fill(0);
	for (let x = 0; x < width; x++) {
		buf[(height - 1) * width + x] = intensity;
	}
	return buf;
}

/**
 * Advance the fire simulation one step.
 *
 * Each cell reads the cell directly below it, applies a random decay (0–2)
 * and a random lateral drift (−1, 0, +1), then writes to the drifted cell
 * one row above. This is the classic Doom-fire PSX algorithm.
 *
 * @see https://fabiensanglard.net/doom_fire_psx/
 */
export function updateFire(
	buf: number[],
	width: number,
	height: number,
	maxIntensity: number,
	fireEnabled: boolean
): number[] {
	const next = buf.slice();

	for (let y = 0; y < height - 1; y++) {
		for (let x = 0; x < width; x++) {
			const src = buf[(y + 1) * width + x];
			const decay = Math.floor(Math.random() * 3); // 0, 1, or 2
			const drift = Math.floor(Math.random() * 3) - 1; // -1, 0, or 1
			const dstX = Math.max(0, Math.min(width - 1, x - drift));
			next[y * width + dstX] = Math.max(0, src - decay);
		}
	}

	// Maintain or extinguish the bottom source row.
	for (let x = 0; x < width; x++) {
		const i = (height - 1) * width + x;
		if (fireEnabled) {
			next[i] = maxIntensity;
		} else {
			next[i] = Math.max(0, next[i] - Math.floor(Math.random() * 3));
		}
	}

	return next;
}

// ── Module constants ────────────────────────────────────────────────────────

/** Dispatched on document when the burn404 preference changes via the sidebar toggle. */
export const BURN404_PREF_CHANGE = "burn404:pref-change";

const TOGGLE_ID = "burn404-toggle";
const ACTIVE_ATTR = "data-burn404-active";
const PAGE_SENTINEL = "data-page-404";
const CANVAS_ID = "burn404-canvas";
const PIXEL_SIZE = 4;
const FIRE_HEIGHT_RATIO = 0.45;
const FRAME_INTERVAL = 1000 / 30;
// Cap the heat source below full-white to keep the flame amber/yellow at the base.
const SOURCE_INTENSITY = 33;

// ── Canvas / animation state ────────────────────────────────────────────────

let _canvas: HTMLCanvasElement | null = null;
let _ctx: CanvasRenderingContext2D | null = null;
let _buf: number[] = [];
let _fireW = 0;
let _fireH = 0;
let _rafId: number | null = null;
let _lastFrame = 0;
let _extinguishing = false;
let _resizeTimer: ReturnType<typeof setTimeout> | null = null;

// ── 404-page detection ──────────────────────────────────────────────────────

function isOn404Page(): boolean {
	return document.querySelector(`[${PAGE_SENTINEL}]`) !== null;
}

// ── Pref ────────────────────────────────────────────────────────────────────

function isActive(): boolean {
	return getPref(PREF_KEYS.burn404) !== "0";
}

// ── Canvas management ───────────────────────────────────────────────────────

function buildCanvas(): void {
	if (_canvas && !document.body.contains(_canvas)) {
		stopAnimation();
		_canvas = null;
		_ctx = null;
		_buf = [];
	}

	if (_canvas) return;

	const existing = document.getElementById(CANVAS_ID) as HTMLCanvasElement | null;
	if (existing) {
		_canvas = existing;
		_ctx = existing.getContext("2d");
		resizeCanvas();
		window.addEventListener("resize", onResize);
		return;
	}

	const canvas = document.createElement("canvas");
	canvas.id = CANVAS_ID;
	document.body.prepend(canvas);
	_canvas = canvas;
	_ctx = canvas.getContext("2d");

	resizeCanvas();
	window.addEventListener("resize", onResize);
}

function resizeCanvas(): void {
	if (!_canvas) return;

	const displayW = window.innerWidth;
	const displayH = Math.floor(window.innerHeight * FIRE_HEIGHT_RATIO);

	const newFireW = Math.max(1, Math.ceil(displayW / PIXEL_SIZE));
	const newFireH = Math.max(1, Math.ceil(displayH / PIXEL_SIZE));

	_canvas.style.width = `${displayW}px`;
	_canvas.style.height = `${displayH}px`;

	// Skip buffer reinit when cell dimensions are unchanged — avoids resetting
	// the fire animation when the mobile browser chrome hides/shows during scroll.
	if (newFireW === _fireW && newFireH === _fireH) return;

	_fireW = newFireW;
	_fireH = newFireH;
	_canvas.width = _fireW;
	_canvas.height = _fireH;
	_buf = initFire(_fireW, _fireH, SOURCE_INTENSITY);
}

function onResize(): void {
	if (_resizeTimer !== null) clearTimeout(_resizeTimer);
	_resizeTimer = setTimeout(() => {
		_resizeTimer = null;
		resizeCanvas();
	}, 250);
}

function removeCanvas(): void {
	if (_resizeTimer !== null) {
		clearTimeout(_resizeTimer);
		_resizeTimer = null;
	}
	window.removeEventListener("resize", onResize);
	_canvas?.remove();
	_canvas = null;
	_ctx = null;
	_buf = [];
	_fireW = 0;
	_fireH = 0;
}

// ── Animation ───────────────────────────────────────────────────────────────

function tick(now: number): void {
	if (now - _lastFrame < FRAME_INTERVAL) {
		_rafId = requestAnimationFrame(tick);
		return;
	}
	_lastFrame = now;

	if (!_ctx || !_canvas || _fireW === 0 || _fireH === 0) return;

	_buf = updateFire(_buf, _fireW, _fireH, SOURCE_INTENSITY, !_extinguishing);

	const img = _ctx.createImageData(_fireW, _fireH);
	const data = img.data;

	for (let i = 0; i < _buf.length; i++) {
		const intensity = Math.min(_buf[i], MAX_INTENSITY);
		const [r, g, b, a] = PALETTE[intensity];
		const base = i * 4;
		data[base] = r;
		data[base + 1] = g;
		data[base + 2] = b;
		data[base + 3] = a;
	}

	_ctx.putImageData(img, 0, 0);

	// Once the last ember dies, clean up and remove the active attribute.
	if (_extinguishing && !_buf.some((v) => v > 0)) {
		document.documentElement.removeAttribute(ACTIVE_ATTR);
		_rafId = null;
		removeCanvas();
		_extinguishing = false;
		return;
	}

	_rafId = requestAnimationFrame(tick);
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

// ── Enable / disable ────────────────────────────────────────────────────────

function enable(): void {
	_extinguishing = false;
	stopAnimation();

	if (!isOn404Page()) {
		document.documentElement.removeAttribute(ACTIVE_ATTR);
		return;
	}

	document.documentElement.setAttribute(ACTIVE_ATTR, "");

	const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	if (!prefersReduced) {
		buildCanvas();
		startAnimation();
	}
}

function disable(): void {
	if (_rafId !== null) {
		// Fire is animating, let it die naturally before cleaning up.
		_extinguishing = true;
		return;
	}
	// Not animating (reduced motion or never started). immediate cleanup.
	document.documentElement.removeAttribute(ACTIVE_ATTR);
	removeCanvas();
}

function applyPref(): void {
	if (isActive()) {
		enable();
	} else {
		disable();
	}
}

// ── Toggle wiring ───────────────────────────────────────────────────────────

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
				removePref(PREF_KEYS.burn404);
			} else {
				setPref(PREF_KEYS.burn404, "0");
			}
			applyPref();
			document.dispatchEvent(new CustomEvent(BURN404_PREF_CHANGE, { detail: { active: toggle.checked } }));
		},
		{ signal }
	);
}

// ── Lifecycle ───────────────────────────────────────────────────────────────

if (typeof document !== "undefined") {
	rebuildPalette();
	applyPref();
	init();

	document.addEventListener("astro:after-swap", applyPref);
	document.addEventListener("astro:page-load", init);
	// Rebuild palette whenever the user switches theme or flavor so the fire
	// instantly reflects their new color context.
	document.addEventListener("set-theme", rebuildPalette);
	document.addEventListener("flavor-change", rebuildPalette);

	window.addEventListener("storage", (e) => {
		if (e.key !== PREF_KEYS.burn404) return;
		applyPref();
		const toggle = document.getElementById(TOGGLE_ID) as HTMLInputElement | null;
		if (toggle) toggle.checked = isActive();
	});
}
