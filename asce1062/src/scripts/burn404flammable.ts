/**
 * Burn 404 Flammable
 * Element-anchored flammable-text detection for the 404 torch.
 *
 * Every piece of 404 content belongs to an anchor: its nearest text block
 * (heading, paragraph, pre, link, list item, rule). Flammable cells and burn
 * memory are stored relative to the anchor's origin cell rather than the
 * viewport, so:
 * - a text effect re-detects only the anchor it mutated; every other burn on
 *   the page is untouched
 * - burns travel with their text when the page scrolls or the layout shifts
 * - a burnt cell whose glyph is temporarily gone (typewriter backspace, glitch
 *   swap) stops burning, then re-ignites when ink returns to that spot
 *
 * Pure helpers are exported for tests. detectFlammableAnchors() is BROWSER-ONLY.
 */

import { splitGraphemes } from "@/lib/textEffects/utils";

// ── Types ──────────────────────────────────────────────────────────────────

export interface CellPoint {
	x: number;
	y: number;
}

export interface FlammableAnchor {
	/** Lit cells as "dx,dy" offsets from the anchor's origin cell. */
	cells: ReadonlySet<string>;
	/** Rounded anchor width (px) at detection. A new width means its glyphs reflowed. */
	width: number;
	/** Inclusive bounds of `cells`, in the same relative coordinates. */
	minX: number;
	maxX: number;
	minY: number;
	maxY: number;
}

interface GlyphOp {
	text: string;
	font: string;
	x: number;
	baseline: number;
	rect: DOMRect;
}

interface AnchorOps {
	glyphs: GlyphOp[];
	boxes: DOMRect[];
}

// ── Constants ──────────────────────────────────────────────────────────────

const ANCHOR_SELECTOR = "h1, h2, h3, h4, h5, h6, p, pre, li, a, hr";
// Nodes up to this length are rasterised glyph by glyph (each ASCII art
// character is independently flammable); longer nodes go line by line.
const CHAR_LIMIT = 200;
// Room around measured rects for glyph overhang and descenders.
const RASTER_PAD = 8;
// Guard against pathological anchors producing enormous offscreen canvases.
const MAX_RASTER_SIDE = 4096;
const LIT_THRESHOLD = 64;

// ── Pure helpers (exported for tests) ──────────────────────────────────────

/** An anchor with no current ink. Burn memory behind it is kept, but masked. */
export function emptyFlammableAnchor(width: number): FlammableAnchor {
	return { cells: new Set(), width, minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
}

export function cellKey(x: number, y: number): string {
	return `${x},${y}`;
}

export function parseCellKey(key: string): CellPoint {
	const comma = key.indexOf(",");
	return { x: parseInt(key.slice(0, comma), 10), y: parseInt(key.slice(comma + 1), 10) };
}

/** Fire-buffer cell containing a viewport-space point. */
export function toCell(left: number, top: number, pixelSize: number): CellPoint {
	return { x: Math.floor(left / pixelSize), y: Math.floor(top / pixelSize) };
}

/**
 * Relative keys of the anchor's flammable cells within `radius` of the
 * cursor. `origin` is the anchor's current origin cell, `cursor` the cursor
 * cell, both in fire-buffer coordinates.
 */
export function findIgnitedCells(
	anchor: FlammableAnchor,
	origin: CellPoint,
	cursor: CellPoint,
	radius: number
): string[] {
	const cx = cursor.x - origin.x;
	const cy = cursor.y - origin.y;
	if (cx + radius < anchor.minX || cx - radius > anchor.maxX) return [];
	if (cy + radius < anchor.minY || cy - radius > anchor.maxY) return [];

	const ignited: string[] = [];
	for (let dy = -radius; dy <= radius; dy++) {
		for (let dx = -radius; dx <= radius; dx++) {
			if (dx * dx + dy * dy > radius * radius) continue;
			const key = cellKey(cx + dx, cy + dy);
			if (anchor.cells.has(key)) ignited.push(key);
		}
	}
	return ignited;
}

/**
 * Viewport cell keys to hold at full heat: burn memory masked by the
 * anchor's current ink, translated to the anchor's current origin, and
 * clipped to the fire buffer.
 */
export function resolveHeldCells(
	anchor: FlammableAnchor,
	burning: ReadonlySet<string>,
	origin: CellPoint,
	width: number,
	height: number
): string[] {
	// Whole anchor off-screen (common on a scrolled, heavily burnt page): skip
	// per-cell work entirely.
	if (origin.x + anchor.maxX < 0 || origin.x + anchor.minX >= width) return [];
	if (origin.y + anchor.maxY < 0 || origin.y + anchor.minY >= height) return [];

	const held: string[] = [];
	for (const key of burning) {
		if (!anchor.cells.has(key)) continue;
		const { x, y } = parseCellKey(key);
		const vx = origin.x + x;
		const vy = origin.y + y;
		if (vx >= 0 && vx < width && vy >= 0 && vy < height) held.push(cellKey(vx, vy));
	}
	return held;
}

// ── DOM detection ──────────────────────────────────────────────────────────

/** Nearest text block that owns `el`'s ink, falling back to the root. */
export function resolveFlammableAnchor(el: Element, root: Element): Element {
	const anchor = el.closest(ANCHOR_SELECTOR);
	return anchor && root.contains(anchor) ? anchor : root;
}

/** Whether `node` is, or contains, an element that would become an anchor. */
export function containsFlammableAnchor(node: Node): boolean {
	return node instanceof Element && (node.matches(ANCHOR_SELECTOR) || node.querySelector(ANCHOR_SELECTOR) !== null);
}

function isRendered(style: CSSStyleDeclaration): boolean {
	return style.display !== "none" && style.visibility !== "hidden";
}

function collectTextOps(node: Text, ops: AnchorOps): void {
	const parent = node.parentElement;
	const text = node.textContent ?? "";
	if (!parent || !text.trim()) return;
	// Screen-reader-only text (e.g. a text effect's stable label) is clipped, but
	// its range rects still report glyph boxes: it is not ink.
	if (parent.closest(".sr-only, [data-text-effect-label]")) return;
	const style = window.getComputedStyle(parent);
	if (!isRendered(style)) return;

	const fontSize = parseFloat(style.fontSize);
	const font = `${style.fontStyle} ${style.fontWeight} ${fontSize}px ${style.fontFamily}`;
	const baselineOf = (r: DOMRect) => r.top + (r.height - fontSize) / 2 + fontSize * 0.8;
	const range = document.createRange();

	if (text.length <= CHAR_LIMIT) {
		let offset = 0;
		for (const char of splitGraphemes(text)) {
			const start = offset;
			offset += char.length;
			if (!char.trim()) continue;
			range.setStart(node, start);
			range.setEnd(node, offset);
			const r = range.getClientRects()[0];
			if (!r || r.width === 0 || r.height === 0) continue;
			ops.glyphs.push({ text: char, font, x: r.left, baseline: baselineOf(r), rect: r });
		}
		return;
	}

	range.selectNodeContents(node);
	const lines = text.split("\n");
	const lineRects = range.getClientRects();
	for (let i = 0; i < Math.min(lines.length, lineRects.length); i++) {
		const r = lineRects[i];
		ops.glyphs.push({ text: lines[i], font, x: r.left, baseline: baselineOf(r), rect: r });
	}
}

/**
 * Non-text leaf elements (icon glyphs via ::before, HR, images) have no text
 * node to rasterise, so their bounding box is the flammable area.
 */
function collectBoxOp(el: Element, ops: AnchorOps): void {
	if (!isRendered(window.getComputedStyle(el))) return;
	const rect = el.getBoundingClientRect();
	if (rect.width > 0 && rect.height > 0) ops.boxes.push(rect);
}

function opsFor(map: Map<Element, AnchorOps>, anchor: Element): AnchorOps {
	let ops = map.get(anchor);
	if (!ops) {
		ops = { glyphs: [], boxes: [] };
		map.set(anchor, ops);
	}
	return ops;
}

function collectOps(root: Element, only: ReadonlySet<Element> | undefined): Map<Element, AnchorOps> {
	const map = new Map<Element, AnchorOps>();
	const wanted = (anchor: Element) => !only || only.has(anchor);

	const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
	let node: Node | null;
	while ((node = walker.nextNode())) {
		const parent = node.parentElement;
		if (!parent) continue;
		const anchor = resolveFlammableAnchor(parent, root);
		if (wanted(anchor)) collectTextOps(node as Text, opsFor(map, anchor));
	}

	for (const el of root.querySelectorAll("*")) {
		if (el.children.length > 0) continue;
		if (Array.from(el.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim())) continue;
		const anchor = resolveFlammableAnchor(el, root);
		if (wanted(anchor)) collectBoxOp(el, opsFor(map, anchor));
	}

	return map;
}

/**
 * Rasterise one anchor's ink at glyph-pixel accuracy on a grid-aligned
 * offscreen canvas, then map each lit pixel to a cell relative to the
 * anchor's origin cell.
 */
function rasterizeAnchor(anchor: Element, ops: AnchorOps, pixelSize: number): FlammableAnchor {
	const anchorRect = anchor.getBoundingClientRect();
	const origin = toCell(anchorRect.left, anchorRect.top, pixelSize);
	const result = emptyFlammableAnchor(Math.round(anchorRect.width));

	const rects = [...ops.glyphs.map((g) => g.rect), ...ops.boxes];
	if (rects.length === 0) return result;

	const left = Math.min(...rects.map((r) => r.left)) - RASTER_PAD;
	const top = Math.min(...rects.map((r) => r.top)) - RASTER_PAD;
	const right = Math.max(...rects.map((r) => r.right)) + RASTER_PAD;
	const bottom = Math.max(...rects.map((r) => r.bottom)) + RASTER_PAD;
	// Align the raster to the fire grid so each canvas pixel maps to exactly one cell.
	const x0 = Math.floor(left / pixelSize) * pixelSize;
	const y0 = Math.floor(top / pixelSize) * pixelSize;
	const w = Math.min(MAX_RASTER_SIDE, Math.ceil(right - x0));
	const h = Math.min(MAX_RASTER_SIDE, Math.ceil(bottom - y0));
	if (w <= 0 || h <= 0) return result;

	const canvas = document.createElement("canvas");
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext("2d", { willReadFrequently: true });
	if (!ctx) return result;

	ctx.fillStyle = "#ffffff";
	ctx.textBaseline = "alphabetic";
	for (const g of ops.glyphs) {
		ctx.font = g.font;
		ctx.fillText(g.text, g.x - x0, g.baseline - y0);
	}
	for (const b of ops.boxes) {
		ctx.fillRect(Math.floor(b.left - x0), Math.floor(b.top - y0), Math.ceil(b.width), Math.ceil(b.height));
	}

	const cells = new Set<string>();
	const gridX = x0 / pixelSize - origin.x;
	const gridY = y0 / pixelSize - origin.y;
	const pixels = ctx.getImageData(0, 0, w, h).data;
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			if (pixels[(y * w + x) * 4] <= LIT_THRESHOLD) continue;
			const cx = gridX + Math.floor(x / pixelSize);
			const cy = gridY + Math.floor(y / pixelSize);
			cells.add(cellKey(cx, cy));
			result.minX = Math.min(result.minX, cx);
			result.maxX = Math.max(result.maxX, cx);
			result.minY = Math.min(result.minY, cy);
			result.maxY = Math.max(result.maxY, cy);
		}
	}

	return { ...result, cells };
}

/**
 * Detect flammable cells for every anchor under `root`, or only for the
 * anchors in `only`. Requested anchors with no current ink (e.g. mid
 * backspace) still get an empty entry so their burn memory survives.
 * Anchors rendered at ≤1px (sr-only text) are skipped.
 */
export function detectFlammableAnchors(
	root: Element,
	pixelSize: number,
	only?: ReadonlySet<Element>
): Map<Element, FlammableAnchor> {
	const opsByAnchor = collectOps(root, only);
	for (const anchor of only ?? []) {
		if (anchor.isConnected && !opsByAnchor.has(anchor)) opsByAnchor.set(anchor, { glyphs: [], boxes: [] });
	}

	const detected = new Map<Element, FlammableAnchor>();
	for (const [anchor, ops] of opsByAnchor) {
		const rect = anchor.getBoundingClientRect();
		if (rect.width <= 1 || rect.height <= 1) continue;
		detected.set(anchor, rasterizeAnchor(anchor, ops, pixelSize));
	}
	return detected;
}
