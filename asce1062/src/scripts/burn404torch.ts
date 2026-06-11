/**
 * Burn 404 Torch — full-viewport interactive fire cursor for the 404 page.
 *
 * Renders fire wherever the user moves their cursor or touches. Text content
 * on the 404 page is detected as "flammable" via Range.getClientRects() —
 * any fire-buffer cell that overlaps text becomes permanently ignited once
 * the cursor passes over it.
 *
 * Works alongside burn404.ts (bottom strip). Both respond to the same
 * flourish-burn404 preference key.
 *
 * localStorage key: "flourish-burn404" — shared with bottom strip.
 *
 * Lifecycle mirrors burn404.ts:
 *   astro:after-swap → applyTorchPref()
 *   astro:page-load  → initTorch() (reset state, re-detect flammable pixels)
 *
 * BROWSER-ONLY. Import only from client-side <script> blocks.
 */

import { PALETTE, MAX_INTENSITY } from "@/scripts/burn404";
import { getPref, PREF_KEYS } from "@/lib/prefs";

// ── Public constants (exported for tests) ──────────────────────────────────

export const TORCH_DECAY = 4;
export const TORCH_FIRE_RADIUS = 7;

// ── Pure torch fire algorithm (exported for tests) ─────────────────────────

/**
 * Initialise an empty fire buffer for the torch.
 * Unlike the bottom strip, the torch has no persistent source row — all cells
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

	// Bottom row decays (no persistent source — torch only fires at cursor)
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
let _flammablePixels: Set<string> = new Set();
let _burningPixels: Set<string> = new Set();
let _ac: AbortController | null = null;
let _scrollTimer: ReturnType<typeof setTimeout> | null = null;

// ── 404-page detection ─────────────────────────────────────────────────────

function isOn404Page(): boolean {
	return document.querySelector(`[${PAGE_SENTINEL}]`) !== null;
}

function isActive(): boolean {
	return getPref(PREF_KEYS.burn404) === "1";
}

// ── Flammable pixel detection ──────────────────────────────────────────────

/**
 * Rasterise all visible elements on the 404 page to an offscreen canvas,
 * then pixel-scan to find which fire-buffer cells contain rendered content.
 * This is a bit expensive but only runs once per visit and allows the torch to
 * interact with any content on the page (including user-generated content in the
 * future) without manual configuration.
 * - Leaf elements (no child elements) are painted by bounding rect — covers
 *   icons, <hr>, <pre> ASCII art, inline spans, links, etc.
 * - Text nodes are also painted via Range.getClientRects() for per-line
 *   accuracy inside elements that DO have child elements.
 * - Any non-black pixel in the resulting canvas becomes a flammable cell.
 */
function detectFlammablePixels(): Set<string> {
	const sentinel = document.querySelector(`[${PAGE_SENTINEL}]`);
	if (!sentinel || _fireW === 0 || _fireH === 0) return new Set();

	const cw = _fireW * TORCH_PIXEL_SIZE;
	const ch = _fireH * TORCH_PIXEL_SIZE;

	const offscreen = document.createElement("canvas");
	offscreen.width = cw;
	offscreen.height = ch;
	const ctx = offscreen.getContext("2d", { willReadFrequently: true });
	if (!ctx) return new Set();

	ctx.fillStyle = "#000000";
	ctx.fillRect(0, 0, cw, ch);
	ctx.fillStyle = "#ffffff";

	// Paint all visible leaf elements (no child elements = actually rendered content)
	for (const el of sentinel.querySelectorAll<HTMLElement>("*")) {
		if (el.children.length > 0) continue; // skip structural containers
		const style = window.getComputedStyle(el);
		if (style.display === "none" || style.visibility === "hidden") continue;
		const rect = el.getBoundingClientRect();
		if (rect.width <= 0 || rect.height <= 0) continue;
		if (rect.bottom < 0 || rect.top > ch || rect.right < 0 || rect.left > cw) continue;
		ctx.fillRect(
			Math.max(0, Math.floor(rect.left)),
			Math.max(0, Math.floor(rect.top)),
			Math.ceil(rect.width),
			Math.ceil(rect.height)
		);
	}

	// Also paint text nodes via Range rects for per-line accuracy in compound elements
	const walker = document.createTreeWalker(sentinel, NodeFilter.SHOW_TEXT);
	let node: Node | null;
	while ((node = walker.nextNode())) {
		const parent = node.parentElement;
		if (!parent) continue;
		const style = window.getComputedStyle(parent);
		if (style.display === "none" || style.visibility === "hidden") continue;
		const range = document.createRange();
		range.selectNodeContents(node);
		for (const rect of range.getClientRects()) {
			if (rect.width <= 0 || rect.height <= 0) continue;
			ctx.fillRect(
				Math.max(0, Math.floor(rect.left)),
				Math.max(0, Math.floor(rect.top)),
				Math.ceil(rect.width),
				Math.ceil(rect.height)
			);
		}
	}

	// Pixel scan: any white pixel → flammable fire-buffer cell
	const pixels = ctx.getImageData(0, 0, cw, ch).data;
	const flammable = new Set<string>();
	for (let y = 0; y < ch; y++) {
		for (let x = 0; x < cw; x++) {
			if (pixels[(y * cw + x) * 4] > 128) {
				flammable.add(`${Math.floor(x / TORCH_PIXEL_SIZE)},${Math.floor(y / TORCH_PIXEL_SIZE)}`);
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

	_fireW = Math.max(1, Math.ceil(displayW / TORCH_PIXEL_SIZE));
	_fireH = Math.max(1, Math.ceil(displayH / TORCH_PIXEL_SIZE));

	_canvas.width = _fireW;
	_canvas.height = _fireH;
	_canvas.style.width = `${displayW}px`;
	_canvas.style.height = `${displayH}px`;

	_buf = initTorchFire(_fireW, _fireH);
	_burningPixels = new Set();
	_flammablePixels = isOn404Page() ? detectFlammablePixels() : new Set();
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

	// Permanently ignite any flammable pixel the cursor is touching
	if (_mouseFirePos !== null) {
		const r = TORCH_FIRE_RADIUS;
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
		_mouseFirePos,
		TORCH_FIRE_RADIUS,
		_burningPixels
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

// ── Enable / disable ───────────────────────────────────────────────────────

function enableTorch(): void {
	stopTorchAnimation();

	if (!isOn404Page()) return;

	const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	if (prefersReduced) return;

	buildTorchCanvas();

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
	if (_scrollTimer !== null) {
		clearTimeout(_scrollTimer);
		_scrollTimer = null;
	}
	_ac?.abort();
	_ac = null;
	_mouseFirePos = null;
	stopTorchAnimation();
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
	// Reset per-visit state; re-detect flammable pixels now that DOM is rendered
	_burningPixels = new Set();
	_mouseFirePos = null;

	if (isOn404Page() && isActive() && _fireW > 0) {
		_flammablePixels = detectFlammablePixels();
	} else {
		_flammablePixels = new Set();
	}
}

// ── Lifecycle ──────────────────────────────────────────────────────────────

if (typeof document !== "undefined") {
	applyTorchPref();
	initTorch();

	document.addEventListener("astro:after-swap", applyTorchPref);
	document.addEventListener("astro:page-load", initTorch);
}
