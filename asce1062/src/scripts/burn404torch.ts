/**
 * Burn 404 Torch
 * Full-viewport interactive fire cursor for the 404 page.
 *
 * Renders fire wherever the user moves their cursor or touches. Text content
 * on the 404 page is "flammable": any glyph cell the torch core touches stays
 * ignited for the rest of the visit. Burns are anchored to their text block
 * (see burn404flammable.ts), so they persist through text effects, scrolling,
 * and sidebar collapse. Only a block whose width changes (reflow) loses them.
 *
 * Works alongside burn404.ts (bottom strip). Both respond to the same
 * flourish-burn404 preference key.
 *
 * localStorage key: "flourish-burn404" (shared with bottom strip).
 *   "0" = user disabled; absent = enabled (on by default).
 *
 * Lifecycle mirrors burn404.ts:
 *   astro:after-swap → applyTorchPref()
 *   astro:page-load  → initTorch() (reset burns, detect flammable anchors)
 *
 * BROWSER-ONLY. Import only from client-side <script> blocks.
 */

import { PALETTE, MAX_INTENSITY, BURN404_PREF_CHANGE } from "@/scripts/burn404";
import { getPref, PREF_KEYS } from "@/lib/prefs";
import {
	containsFlammableAnchor,
	detectFlammableAnchors,
	emptyFlammableAnchor,
	findIgnitedCells,
	resolveFlammableAnchor,
	resolveHeldCells,
	toCell,
	type FlammableAnchor,
} from "@/scripts/burn404flammable";

// ── Public constants (exported for tests) ──────────────────────────────────

export const TORCH_DECAY = 4; // higher = faster decay, more flickering
export const TORCH_FIRE_RADIUS = 8; // visual fire injection radius (cells)
export const TORCH_IGNITION_RADIUS = 2; // permanent ignition contact radius (cells, tighter than visual)

// ── Pure torch fire algorithm (exported for tests) ─────────────────────────

/**
 * Initialize an empty fire buffer for the torch.
 * Unlike the bottom strip, the torch has no persistent source row. All cells
 * start at 0 and fire is injected only via mouse/touch position.
 */
export function initTorchFire(width: number, height: number): number[] {
	return new Array<number>(width * height).fill(0);
}

/**
 * Advance the torch fire simulation one step.
 *
 * Same Doom-fire propagation as the bottom strip (drift + decay), with three
 * additions:
 * - Bottom row decays normally (no persistent source)
 * - burningPixels (flammable text already ignited) are held at maxIntensity
 * - mouseFirePos injects fire in a circular radius with quadratic falloff
 */
export function updateTorchFire(
	buf: number[],
	width: number,
	height: number,
	maxIntensity: number,
	decay: number,
	mouseFirePos: { x: number; y: number } | null,
	fireRadius: number,
	burningPixels: ReadonlySet<string>
): number[] {
	const next = buf.slice();

	// Standard Doom-fire propagation (same as bottom strip)
	for (let y = 0; y < height - 1; y++) {
		for (let x = 0; x < width; x++) {
			const src = buf[(y + 1) * width + x];
			const d = Math.floor(Math.random() * decay);
			const drift = Math.floor(Math.random() * 3) - 1;
			const dstX = Math.max(0, Math.min(width - 1, x - drift));
			next[y * width + dstX] = Math.max(0, src - d);
		}
	}

	// Bottom row decays (no persistent source. Torch only fires at cursor)
	for (let x = 0; x < width; x++) {
		const i = (height - 1) * width + x;
		next[i] = Math.max(0, buf[i] - Math.floor(Math.random() * decay));
	}

	// Keep permanently ignited (flammable text) pixels at max intensity
	for (const key of burningPixels) {
		const comma = key.indexOf(",");
		const px = parseInt(key.slice(0, comma), 10);
		const py = parseInt(key.slice(comma + 1), 10);
		const i = py * width + px;
		if (i >= 0 && i < next.length) {
			next[i] = maxIntensity;
		}
	}

	// Inject fire at mouse/touch position with circular radius + quadratic falloff
	if (mouseFirePos !== null) {
		for (let dy = -fireRadius; dy <= fireRadius; dy++) {
			for (let dx = -fireRadius; dx <= fireRadius; dx++) {
				const dist = Math.sqrt(dx * dx + dy * dy);
				if (dist <= fireRadius) {
					const fx = Math.round(mouseFirePos.x + dx);
					const fy = Math.round(mouseFirePos.y + dy);
					if (fx >= 0 && fx < width && fy >= 0 && fy < height) {
						const falloff = (1 - dist / fireRadius) ** 2;
						const variation = 0.5 + Math.random() * 0.5;
						const intensity = Math.floor(maxIntensity * falloff * variation);
						const i = fy * width + fx;
						next[i] = Math.max(next[i], intensity);
					}
				}
			}
		}
	}

	return next;
}

// ── Module constants ───────────────────────────────────────────────────────

const TORCH_CANVAS_ID = "burn404-torch";
const TORCH_PIXEL_SIZE = 4;
const TORCH_SOURCE_INTENSITY = 33;
const PAGE_SENTINEL = "data-page-404";
const FRAME_INTERVAL = 1000 / 30;

// ── Canvas / animation / interaction state ─────────────────────────────────

let _canvas: HTMLCanvasElement | null = null;
let _ctx: CanvasRenderingContext2D | null = null;
let _buf: number[] = [];
let _fireW = 0;
let _fireH = 0;
let _rafId: number | null = null;
let _lastFrame = 0;
let _mouseFirePos: { x: number; y: number } | null = null;
// Flammable ink and burn memory, both keyed by anchor element with cells
// relative to the anchor's origin (see burn404flammable.ts).
let _anchors: Map<Element, FlammableAnchor> = new Map();
let _burning: Map<Element, Set<string>> = new Map();
let _ac: AbortController | null = null;
let _torchExtinguishing = false;
let _mutationObserver: MutationObserver | null = null;
let _observedSentinel: Element | null = null;
let _mutationTimer: ReturnType<typeof setTimeout> | null = null;
let _dirtyAnchors: Set<Element> | "all" = new Set();
// Bumped on init/disable so a detection queued behind document.fonts.ready
// cannot write results into a newer (or torn-down) visit.
let _detectGeneration = 0;
let _sidebarObserver: MutationObserver | null = null;

// ── 404-page detection ─────────────────────────────────────────────────────

function getSentinel(): Element | null {
	return document.querySelector(`[${PAGE_SENTINEL}]`);
}

function isOn404Page(): boolean {
	return getSentinel() !== null;
}

function isActive(): boolean {
	return getPref(PREF_KEYS.burn404) !== "0";
}

// ── Flammable detection ────────────────────────────────────────────────────

/**
 * Re-detect flammable ink once fonts are ready: for every anchor, or only
 * for `only` (anchors a text effect just mutated). Burn memory is kept for
 * every anchor still in the DOM, with one exception: on a full re-detect
 * (resize, sidebar toggle) an anchor whose width changed has reflowed, so its
 * remembered cells no longer line up and are dropped. Partial re-detects
 * never drop burns, since an effect legitimately resizes shrink-wrapped text.
 */
function redetect(only?: ReadonlySet<Element>): void {
	const generation = _detectGeneration;
	document.fonts.ready.then(() => {
		const sentinel = getSentinel();
		if (generation !== _detectGeneration || !sentinel || _fireW === 0) return;

		const detected = detectFlammableAnchors(sentinel, TORCH_PIXEL_SIZE, only);
		const next = new Map<Element, FlammableAnchor>();
		for (const [el, anchor] of _anchors) {
			if (!el.isConnected || only?.has(el)) continue;
			// Partial: untouched anchors keep their map. Full: known anchors with
			// no ink right now (mid-backspace, hidden) keep their burns behind an
			// empty mask until ink returns; detected anchors overwrite below.
			next.set(el, only ? anchor : emptyFlammableAnchor(anchor.width));
		}
		for (const [el, anchor] of detected) {
			if (!only && _anchors.has(el) && _anchors.get(el)?.width !== anchor.width) _burning.delete(el);
			next.set(el, anchor);
		}
		for (const el of _burning.keys()) {
			if (!next.has(el)) _burning.delete(el);
		}
		_anchors = next;
	});
}

/**
 * Advance burn state for one frame: ignite flammable cells under the torch
 * core, then return the viewport cells to hold at full heat.
 */
function collectHeldCells(): Set<string> {
	const held = new Set<string>();
	if (_torchExtinguishing) return held;

	for (const [el, anchor] of _anchors) {
		if (!el.isConnected) continue;
		const rect = el.getBoundingClientRect();
		const origin = toCell(rect.left, rect.top, TORCH_PIXEL_SIZE);

		// TORCH_IGNITION_RADIUS is tighter than the visual fire radius so only
		// cells directly under the torch core are lit, not its full flame spread.
		if (_mouseFirePos !== null) {
			const ignited = findIgnitedCells(anchor, origin, _mouseFirePos, TORCH_IGNITION_RADIUS);
			if (ignited.length > 0) {
				// Hot path (30fps): grow the module-owned set in place rather than copying it.
				const burning = _burning.get(el) ?? new Set<string>();
				for (const key of ignited) burning.add(key);
				_burning.set(el, burning);
			}
		}

		const burning = _burning.get(el);
		if (!burning) continue;
		for (const key of resolveHeldCells(anchor, burning, origin, _fireW, _fireH)) held.add(key);
	}
	return held;
}

// ── Canvas management ──────────────────────────────────────────────────────

function buildTorchCanvas(): void {
	// Astro soft navigation swaps <body>, detaching the old canvas. Reset all
	// canvas state (including _fireW/_fireH) so the new canvas gets sized;
	// otherwise resizeTorchCanvas() sees an unchanged width and returns early,
	// leaving the canvas at the browser default 300×150.
	if (_canvas && !document.body.contains(_canvas)) {
		stopTorchAnimation();
		removeTorchCanvas();
	}

	if (_canvas) return;

	const existing = document.getElementById(TORCH_CANVAS_ID) as HTMLCanvasElement | null;
	if (existing) {
		_canvas = existing;
		_ctx = existing.getContext("2d");
		resizeTorchCanvas();
		window.addEventListener("resize", resizeTorchCanvas);
		return;
	}

	const canvas = document.createElement("canvas");
	canvas.id = TORCH_CANVAS_ID;
	document.body.prepend(canvas);
	_canvas = canvas;
	_ctx = canvas.getContext("2d");

	resizeTorchCanvas();
	window.addEventListener("resize", resizeTorchCanvas);
}

function resizeTorchCanvas(): void {
	if (!_canvas) return;

	const displayW = window.innerWidth;
	const displayH = window.innerHeight;

	const newFireW = Math.max(1, Math.ceil(displayW / TORCH_PIXEL_SIZE));
	const newFireH = Math.max(1, Math.ceil(displayH / TORCH_PIXEL_SIZE));

	// Mobile browser chrome show/hide only changes window.innerHeight; width
	// stays constant. Skip those events so the torch canvas, fire buffer, and
	// burn state are all preserved without any bitmap clear.
	// Width changes (device rotation, desktop resize) still update.
	if (newFireW === _fireW) return;

	_canvas.style.width = `${displayW}px`;
	_canvas.style.height = `${displayH}px`;

	const oldW = _fireW;
	const oldH = _fireH;
	const oldBuf = _buf;

	_fireW = newFireW;
	_fireH = newFireH;
	_canvas.width = _fireW;
	_canvas.height = _fireH;

	const newBuf = new Array<number>(_fireW * _fireH).fill(0);
	if (oldW > 0 && oldH > 0) {
		const copyW = Math.min(oldW, _fireW);
		const copyH = Math.min(oldH, _fireH);
		for (let y = 0; y < copyH; y++) {
			for (let x = 0; x < copyW; x++) {
				newBuf[y * _fireW + x] = oldBuf[y * oldW + x];
			}
		}
	}
	_buf = newBuf;

	// Reflowed anchors drop their burns inside redetect(); the rest keep them.
	if (isOn404Page()) {
		redetect();
	} else {
		_anchors = new Map();
	}
}

function removeTorchCanvas(): void {
	window.removeEventListener("resize", resizeTorchCanvas);
	_canvas?.remove();
	_canvas = null;
	_ctx = null;
	_buf = [];
	_fireW = 0;
	_fireH = 0;
	_mouseFirePos = null;
}

// ── Animation ──────────────────────────────────────────────────────────────

function tickTorch(now: number): void {
	if (now - _lastFrame < FRAME_INTERVAL) {
		_rafId = requestAnimationFrame(tickTorch);
		return;
	}
	_lastFrame = now;

	if (!_ctx || !_canvas || _fireW === 0 || _fireH === 0) return;

	_buf = updateTorchFire(
		_buf,
		_fireW,
		_fireH,
		TORCH_SOURCE_INTENSITY,
		TORCH_DECAY,
		_torchExtinguishing ? null : _mouseFirePos,
		TORCH_FIRE_RADIUS,
		collectHeldCells()
	);

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

	// Once all embers are cold, clean up the torch canvas.
	if (_torchExtinguishing && !_buf.some((v) => v > 0)) {
		_rafId = null;
		removeTorchCanvas();
		_torchExtinguishing = false;
		return;
	}

	_rafId = requestAnimationFrame(tickTorch);
}

function startTorchAnimation(): void {
	if (_rafId !== null) return;
	_lastFrame = 0;
	_rafId = requestAnimationFrame(tickTorch);
}

function stopTorchAnimation(): void {
	if (_rafId !== null) {
		cancelAnimationFrame(_rafId);
		_rafId = null;
	}
}

// ── Mutation watch ─────────────────────────────────────────────────────────

/**
 * Queue a debounced re-detect. Text effects mutate a single anchor at a
 * time, so only those anchors are re-detected; everything else keeps its
 * flammable map and burns untouched.
 */
function scheduleRedetect(dirty: Iterable<Element> | "all", delayMs: number): void {
	if (dirty === "all") {
		_dirtyAnchors = "all";
	} else if (_dirtyAnchors !== "all") {
		_dirtyAnchors = new Set([..._dirtyAnchors, ...dirty]);
	}
	if (_mutationTimer !== null) clearTimeout(_mutationTimer);
	_mutationTimer = setTimeout(() => {
		_mutationTimer = null;
		const pending = _dirtyAnchors;
		_dirtyAnchors = new Set();
		redetect(pending === "all" ? undefined : pending);
	}, delayMs);
}

function startMutationWatch(): void {
	const sentinel = getSentinel();
	if (!sentinel || (_mutationObserver && _observedSentinel === sentinel)) return;
	// A soft navigation back to the 404 renders a new sentinel; rebind to it.
	stopMutationWatch();
	_observedSentinel = sentinel;
	_mutationObserver = new MutationObserver((records) => {
		const dirty = new Set<Element>();
		for (const { target, addedNodes } of records) {
			const el = target instanceof Element ? target : target.parentElement;
			if (!el) continue;
			const anchor = resolveFlammableAnchor(el, sentinel);
			// A mutation above anchor level, or one that inserts new anchors,
			// changes which anchors exist: re-detect everything.
			if (anchor === sentinel || Array.from(addedNodes).some(containsFlammableAnchor)) {
				scheduleRedetect("all", 150);
				return;
			}
			dirty.add(anchor);
		}
		scheduleRedetect(dirty, 150);
	});
	_mutationObserver.observe(sentinel, { childList: true, characterData: true, subtree: true });
}

function stopMutationWatch(): void {
	if (_mutationTimer !== null) {
		clearTimeout(_mutationTimer);
		_mutationTimer = null;
	}
	_dirtyAnchors = new Set();
	_mutationObserver?.disconnect();
	_mutationObserver = null;
	_observedSentinel = null;
}

function startSidebarWatch(): void {
	if (_sidebarObserver) return;
	_sidebarObserver = new MutationObserver(() => {
		// Sidebar collapsed/expanded on desktop: main content shifts and may
		// reflow. Burns follow their anchors; re-detect after the CSS transition
		// so reflowed anchors are caught.
		scheduleRedetect("all", 300);
	});
	_sidebarObserver.observe(document.documentElement, {
		attributes: true,
		attributeFilter: ["data-sidebar-collapsed"],
	});
}

function stopSidebarWatch(): void {
	_sidebarObserver?.disconnect();
	_sidebarObserver = null;
}

// ── Enable / disable ───────────────────────────────────────────────────────

/** Drop observers, input listeners, and any queued detection. */
function releaseTorchListeners(): void {
	_detectGeneration++;
	stopMutationWatch();
	stopSidebarWatch();
	_ac?.abort();
	_ac = null;
	_mouseFirePos = null;
}

function enableTorch(): void {
	_torchExtinguishing = false;
	stopTorchAnimation();

	if (!isOn404Page()) {
		// Leaving the 404 via soft navigation: nothing to watch on this page.
		releaseTorchListeners();
		return;
	}

	const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	if (prefersReduced) return;

	buildTorchCanvas();
	startMutationWatch();
	startSidebarWatch();

	_ac?.abort();
	_ac = new AbortController();
	const { signal } = _ac;

	document.addEventListener(
		"mousemove",
		(e: MouseEvent) => {
			_mouseFirePos = {
				x: Math.floor(e.clientX / TORCH_PIXEL_SIZE),
				y: Math.floor(e.clientY / TORCH_PIXEL_SIZE),
			};
		},
		{ signal }
	);

	document.addEventListener(
		"mouseleave",
		() => {
			_mouseFirePos = null;
		},
		{ signal }
	);

	document.addEventListener(
		"touchmove",
		(e: TouchEvent) => {
			if (e.touches.length > 0) {
				const t = e.touches[0];
				_mouseFirePos = {
					x: Math.floor(t.clientX / TORCH_PIXEL_SIZE),
					y: Math.floor(t.clientY / TORCH_PIXEL_SIZE),
				};
			}
		},
		{ signal, passive: true }
	);

	document.addEventListener(
		"touchend",
		() => {
			_mouseFirePos = null;
		},
		{ signal }
	);

	startTorchAnimation();
}

function disableTorch(): void {
	releaseTorchListeners();
	_burning = new Map(); // stop maintaining ignited cells so they decay

	if (_rafId !== null) {
		// Fire is animating (let it die naturally).
		_torchExtinguishing = true;
		return;
	}
	// Not animating (immediate cleanup).
	removeTorchCanvas();
}

function applyTorchPref(): void {
	if (isActive()) {
		enableTorch();
	} else {
		disableTorch();
	}
}

function initTorch(): void {
	// Reset per-visit state. Detection is deferred (see below).
	_detectGeneration++;
	_burning = new Map();
	_mouseFirePos = null;
	_anchors = new Map();

	if (!isOn404Page() || !isActive() || _fireW === 0) return;

	// Defer detection until fonts are loaded and layout has settled.
	// Without this, Range.getClientRects() returns intermediate positions
	// during Astro view transitions, reloads, and back-navigation, causing
	// flammable zones to be offset from where elements actually land.
	scheduleRedetect("all", 50);
}

// ── Lifecycle ──────────────────────────────────────────────────────────────

if (typeof document !== "undefined") {
	applyTorchPref();
	initTorch();

	document.addEventListener("astro:after-swap", applyTorchPref);
	document.addEventListener("astro:page-load", initTorch);
	// React to sidebar toggle changes so the torch extinguishes and re-ignites
	// in sync with the bottom strip fire.
	document.addEventListener(BURN404_PREF_CHANGE, (e) => {
		const { active } = (e as CustomEvent<{ active: boolean }>).detail;
		if (active) {
			enableTorch();
		} else {
			disableTorch();
		}
	});
}
