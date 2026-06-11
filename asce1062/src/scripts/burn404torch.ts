/**
 * Burn 404 Torch
 * Full-viewport interactive fire cursor for the 404 page.
 *
 * Renders fire wherever the user moves their cursor or touches. Text content
 * on the 404 page is detected as "flammable" via Range.getClientRects().
 * Any fire-buffer cell that overlaps text becomes permanently ignited once
 * the cursor passes over it.
 *
 * Works alongside burn404.ts (bottom strip). Both respond to the same
 * flourish-burn404 preference key.
 *
 * localStorage key: "flourish-burn404" (shared with bottom strip).
 *   "0" = user disabled; absent = enabled (on by default).
 *
 * Lifecycle mirrors burn404.ts:
 *   astro:after-swap → applyTorchPref()
 *   astro:page-load  → initTorch() (reset state, re-detect flammable pixels)
 *
 * BROWSER-ONLY. Import only from client-side <script> blocks.
 */

import { PALETTE, MAX_INTENSITY, BURN404_PREF_CHANGE } from "@/scripts/burn404";
import { getPref, PREF_KEYS } from "@/lib/prefs";

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
// Extra canvas rows below the viewport for the detection pass.
// Sized generously so content that is marginally below the fold on large
// screens (e.g. the last paragraph on 2560×1440) still gets detected,
// and descenders (y, g) near the viewport edge are fully captured.
const DETECT_OVERFLOW = TORCH_PIXEL_SIZE * 16; // 64 px

// ── Canvas / animation / interaction state ─────────────────────────────────

let _canvas: HTMLCanvasElement | null = null;
let _ctx: CanvasRenderingContext2D | null = null;
let _buf: number[] = [];
let _fireW = 0;
let _fireH = 0;
let _rafId: number | null = null;
let _lastFrame = 0;
let _mouseFirePos: { x: number; y: number } | null = null;
let _flammablePixels: Set<string> = new Set();
let _burningPixels: Set<string> = new Set();
let _ac: AbortController | null = null;
let _scrollTimer: ReturnType<typeof setTimeout> | null = null;
let _torchExtinguishing = false;
let _mutationObserver: MutationObserver | null = null;
let _mutationTimer: ReturnType<typeof setTimeout> | null = null;
let _sidebarObserver: MutationObserver | null = null;

// ── 404-page detection ─────────────────────────────────────────────────────

function isOn404Page(): boolean {
	return document.querySelector(`[${PAGE_SENTINEL}]`) !== null;
}

function isActive(): boolean {
	return getPref(PREF_KEYS.burn404) !== "0";
}

// ── Flammable pixel detection ──────────────────────────────────────────────

/**
 * Rasterise page content to an offscreen canvas at glyph-pixel accuracy,
 * then map each lit pixel to its fire-buffer cell.
 *
 * Text rendering strategy:
 * - Large text (≥24 px): strokeText. Fire traces letter outlines rather than
 *   flooding the entire filled glyph, allowing partial ignition of big letters.
 * - Small text (<24 px): fillText. Glyphs are small enough that fill is fine.
 * - Short text nodes (≤200 chars): character-by-character Range positioning for
 *   maximum granularity (each ASCII art glyph is independently flammable).
 * - Long text nodes: line-by-line fallback to keep detection fast.
 * Non-text leaf elements (icon pseudo-elements, HR, etc.) fall back to bounding rects.
 */
function detectFlammablePixels(): Set<string> {
	const sentinel = document.querySelector(`[${PAGE_SENTINEL}]`);
	if (!sentinel || _fireW === 0 || _fireH === 0) return new Set();

	const cw = _fireW * TORCH_PIXEL_SIZE;
	const canvasH = _fireH * TORCH_PIXEL_SIZE;

	const offscreen = document.createElement("canvas");
	offscreen.width = cw;
	offscreen.height = canvasH + DETECT_OVERFLOW;
	const ctx = offscreen.getContext("2d", { willReadFrequently: true });
	if (!ctx) return new Set();

	ctx.fillStyle = "#000000";
	ctx.fillRect(0, 0, cw, canvasH + DETECT_OVERFLOW);

	// Render each text node at glyph level using canvas text APIs.
	const walker = document.createTreeWalker(sentinel, NodeFilter.SHOW_TEXT);
	let node: Node | null;
	while ((node = walker.nextNode())) {
		const parent = node.parentElement;
		if (!parent) continue;
		const style = window.getComputedStyle(parent);
		if (style.display === "none" || style.visibility === "hidden") continue;

		const text = node.textContent ?? "";
		if (!text.trim()) continue;

		const fontSize = parseFloat(style.fontSize);
		ctx.font = `${style.fontStyle} ${style.fontWeight} ${fontSize}px ${style.fontFamily}`;
		ctx.textBaseline = "alphabetic";
		ctx.fillStyle = "#ffffff";

		const CHAR_LIMIT = 200;
		if (text.length <= CHAR_LIMIT) {
			// Character-by-character: each glyph gets its own fire cell footprint.
			for (let i = 0; i < text.length; i++) {
				const char = text[i];
				if (!char.trim()) continue;
				const charRange = document.createRange();
				charRange.setStart(node, i);
				charRange.setEnd(node, i + 1);
				const rects = charRange.getClientRects();
				if (rects.length === 0) continue;
				const r = rects[0];
				if (r.width === 0 || r.height === 0 || r.bottom < 0 || r.top > canvasH + DETECT_OVERFLOW) continue;
				const baseline = r.top + (r.height - fontSize) / 2 + fontSize * 0.8;
				ctx.fillText(char, r.left, baseline);
			}
		} else {
			// Long text nodes (large pre blocks): line-by-line for performance.
			const lineRange = document.createRange();
			lineRange.selectNodeContents(node);
			const lines = text.split("\n");
			const lineRects = lineRange.getClientRects();
			for (let i = 0; i < Math.min(lines.length, lineRects.length); i++) {
				const r = lineRects[i];
				if (r.bottom < 0 || r.top > canvasH + DETECT_OVERFLOW) continue;
				const baseline = r.top + (r.height - fontSize) / 2 + fontSize * 0.8;
				ctx.fillText(lines[i], r.left, baseline);
			}
		}
	}

	// Non-text leaf elements (icon glyphs via :before, HR, images, etc.)
	// No text node to render, so fall back to bounding rect.
	ctx.fillStyle = "#ffffff";
	for (const el of sentinel.querySelectorAll<HTMLElement>("*")) {
		if (el.children.length > 0) continue;
		if (Array.from(el.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim())) continue;
		const style = window.getComputedStyle(el);
		if (style.display === "none" || style.visibility === "hidden") continue;
		const rect = el.getBoundingClientRect();
		if (rect.width <= 0 || rect.height <= 0) continue;
		if (rect.bottom < 0 || rect.top > canvasH + DETECT_OVERFLOW || rect.right < 0 || rect.left > cw) continue;
		ctx.fillRect(
			Math.max(0, Math.floor(rect.left)),
			Math.max(0, Math.floor(rect.top)),
			Math.ceil(rect.width),
			Math.ceil(rect.height)
		);
	}

	// Map every lit pixel to its fire-buffer cell coordinate.
	const pixels = ctx.getImageData(0, 0, cw, canvasH + DETECT_OVERFLOW).data;
	const flammable = new Set<string>();
	for (let y = 0; y < canvasH + DETECT_OVERFLOW; y++) {
		for (let x = 0; x < cw; x++) {
			if (pixels[(y * cw + x) * 4] > 64) {
				const fx = Math.floor(x / TORCH_PIXEL_SIZE);
				// Clamp so descenders that extend past the canvas bottom map to the
				// last row rather than being silently discarded.
				const fy = Math.min(_fireH - 1, Math.floor(y / TORCH_PIXEL_SIZE));
				if (fx < _fireW) {
					flammable.add(`${fx},${fy}`);
				}
			}
		}
	}

	return flammable;
}

// ── Canvas management ──────────────────────────────────────────────────────

function buildTorchCanvas(): void {
	if (_canvas && !document.body.contains(_canvas)) {
		stopTorchAnimation();
		_canvas = null;
		_ctx = null;
		_buf = [];
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
	// burning pixel state are all preserved without any bitmap clear.
	// Width changes (device rotation, desktop resize) still update.
	if (newFireW === _fireW) return;

	_canvas.style.width = `${displayW}px`;
	_canvas.style.height = `${displayH}px`;

	const oldW = _fireW;
	const oldH = _fireH;
	const oldBuf = _buf;
	const oldBurning = _burningPixels;

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

	_burningPixels = new Set<string>();
	for (const key of oldBurning) {
		const comma = key.indexOf(",");
		const fx = parseInt(key.slice(0, comma), 10);
		const fy = parseInt(key.slice(comma + 1), 10);
		if (fx < _fireW && fy < _fireH) {
			_burningPixels.add(key);
		}
	}

	if (isOn404Page()) {
		document.fonts.ready.then(() => {
			if (isOn404Page() && _fireW > 0) _flammablePixels = detectFlammablePixels();
		});
	} else {
		_flammablePixels = new Set();
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

	// While not extinguishing: ignite flammable pixels the cursor touches.
	// Uses TORCH_IGNITION_RADIUS (tighter than visual fire radius) so only pixels
	// directly under the torch core are permanently lit, not its full flame spread.
	if (!_torchExtinguishing && _mouseFirePos !== null) {
		const r = TORCH_IGNITION_RADIUS;
		for (let dy = -r; dy <= r; dy++) {
			for (let dx = -r; dx <= r; dx++) {
				if (Math.sqrt(dx * dx + dy * dy) <= r) {
					const key = `${Math.round(_mouseFirePos.x + dx)},${Math.round(_mouseFirePos.y + dy)}`;
					if (_flammablePixels.has(key)) {
						_burningPixels.add(key);
					}
				}
			}
		}
	}

	_buf = updateTorchFire(
		_buf,
		_fireW,
		_fireH,
		TORCH_SOURCE_INTENSITY,
		TORCH_DECAY,
		_torchExtinguishing ? null : _mouseFirePos,
		TORCH_FIRE_RADIUS,
		_torchExtinguishing ? new Set<string>() : _burningPixels
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

function redetectAfterChange(): void {
	_burningPixels = new Set();
	document.fonts.ready.then(() => {
		if (isOn404Page() && _fireW > 0) {
			_flammablePixels = detectFlammablePixels();
		}
	});
}

function startMutationWatch(): void {
	const sentinel = document.querySelector(`[${PAGE_SENTINEL}]`);
	if (!sentinel || _mutationObserver) return;
	_mutationObserver = new MutationObserver(() => {
		if (_mutationTimer !== null) clearTimeout(_mutationTimer);
		_mutationTimer = setTimeout(() => {
			_mutationTimer = null;
			redetectAfterChange();
		}, 150);
	});
	_mutationObserver.observe(sentinel, { childList: true, subtree: true });
}

function stopMutationWatch(): void {
	if (_mutationTimer !== null) {
		clearTimeout(_mutationTimer);
		_mutationTimer = null;
	}
	_mutationObserver?.disconnect();
	_mutationObserver = null;
}

function startSidebarWatch(): void {
	if (_sidebarObserver) return;
	_sidebarObserver = new MutationObserver(() => {
		// Sidebar collapsed/expanded on desktop — main content shifts horizontally.
		// Re-detect after the CSS transition completes so coordinates are correct.
		if (_mutationTimer !== null) clearTimeout(_mutationTimer);
		_mutationTimer = setTimeout(() => {
			_mutationTimer = null;
			redetectAfterChange();
		}, 300);
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

function enableTorch(): void {
	_torchExtinguishing = false;
	stopTorchAnimation();

	if (!isOn404Page()) return;

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

	// On scroll: extinguish burning pixels immediately; re-detect flammable
	// positions after scrolling stops so coords stay aligned with the viewport.
	document.addEventListener(
		"scroll",
		() => {
			_burningPixels = new Set();
			if (_scrollTimer !== null) clearTimeout(_scrollTimer);
			_scrollTimer = setTimeout(() => {
				_scrollTimer = null;
				if (_canvas) _flammablePixels = detectFlammablePixels();
			}, 200);
		},
		{ signal, passive: true }
	);

	startTorchAnimation();
}

function disableTorch(): void {
	stopMutationWatch();
	stopSidebarWatch();
	if (_scrollTimer !== null) {
		clearTimeout(_scrollTimer);
		_scrollTimer = null;
	}
	_ac?.abort();
	_ac = null;
	_mouseFirePos = null;
	_burningPixels = new Set(); // stop maintaining ignited pixels so they decay

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
	_burningPixels = new Set();
	_mouseFirePos = null;
	_flammablePixels = new Set();

	if (!isOn404Page() || !isActive() || _fireW === 0) return;

	// Defer detection until fonts are loaded and layout has settled.
	// Without this, Range.getClientRects() returns intermediate positions
	// during Astro view transitions, reloads, and back-navigation, causing
	// flammable zones to be offset from where elements actually land.
	document.fonts.ready.then(() => {
		setTimeout(() => {
			if (isOn404Page() && _fireW > 0) {
				_flammablePixels = detectFlammablePixels();
			}
		}, 50);
	});
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
