import type { MusicPlayerFlavor } from "@/lib/musicPlayer";

const COLS = 32;
const ROWS = 12;
const CHARS = [" ", ".", ":", "-", "=", "+", "*", "#", "@", "W"] as const;
const IDLE_INTERVAL_MS = 600;

// 7-row diamond pattern (24 chars wide); renderIdle centers it in 32 cols
const IDLE_PATTERN: readonly string[] = [
	"         . * .          ",
	"      .  * * *  .       ",
	"    .  * * * * *  .     ",
	"  .  * * * * * * *  .   ",
	"    .  * * * * *  .     ",
	"      .  * * *  .       ",
	"         . * .          ",
];

interface AsciiVisualizerTheme {
	getColor(distFromBottom: number, totalRows: number, intensity: number): string;
	glow: string;
	idleColor: string;
}

// All themes derive from --player-ink (= --color-primary for the active flavor)
// fading toward --player-bg at low intensity. Personality differences:
//   - minPct / maxPct: how compressed or dramatic the ramp is
//   - glow radius: varies by flavor — all themes glow
//   - REDLINE: power-curve ramp for extra punch at peaks

function makeTheme(minPct: number, maxPct: number, glowPx: number, idlePct: number): AsciiVisualizerTheme {
	const range = maxPct - minPct;
	return {
		getColor: (_d, _t, intensity) => {
			const pct = Math.floor(minPct + intensity * range);
			return `color-mix(in oklab, var(--player-ink) ${pct}%, var(--player-bg))`;
		},
		glow: glowPx > 0 ? `0 0 ${glowPx}px var(--player-ink)` : "none",
		idleColor: `color-mix(in oklab, var(--player-ink) ${idlePct}%, var(--player-bg))`,
	};
}

const THEMES: Record<MusicPlayerFlavor, AsciiVisualizerTheme> = {
	DEFAULT: makeTheme(20, 100, 4, 65),
	OBSERVATORY: makeTheme(20, 100, 6, 70), // celestial: soft ambient glow, stars faintly visible at idle
	CRT: makeTheme(25, 100, 6, 75), // phosphor: starts brighter, stronger glow
	AMBER: makeTheme(20, 100, 5, 65),
	SYNTHWAVE: makeTheme(15, 100, 7, 65), // widest contrast, biggest glow
	DOS: makeTheme(25, 100, 4, 60),
	VOID: makeTheme(10, 100, 3, 50),
	ICE: makeTheme(20, 100, 4, 70),
	REDLINE: {
		// Power-curve ramp: near-invisible at low intensity, punchy above 50%
		getColor: (_d, _t, intensity) => {
			const pct = Math.floor(Math.pow(intensity, 1.5) * 100);
			return `color-mix(in oklab, var(--player-ink) ${pct}%, var(--player-bg))`;
		},
		glow: "0 0 6px var(--player-ink)",
		idleColor: "color-mix(in oklab, var(--player-ink) 70%, var(--player-bg))",
	},
};

export class AsciiVisualizerController {
	private container: HTMLElement | null = null;
	private spanGrid: HTMLSpanElement[][] = [];
	private audioCtx: AudioContext | null = null;
	private analyser: AnalyserNode | null = null;
	private sourceNode: MediaElementAudioSourceNode | null = null;
	private freqData = new Uint8Array(128);
	private rafId = 0;
	private intervalId = 0;
	private idleTick = 0;
	private theme: AsciiVisualizerTheme = THEMES.DEFAULT;
	private isPlaying = false;
	// Peak decay buffer: bars fall by at most 1 row per frame for a smooth VU-meter feel
	private previousHeights: number[] = new Array(COLS).fill(0);
	// Cell-level render cache: skip DOM writes when char/color/shadow are unchanged
	private lastChar: string[][] = [];
	private lastColor: string[][] = [];
	private lastShadow: string[][] = [];
	// Reduced-motion listener so we react to OS setting changes without a page reload
	private motionQuery: MediaQueryList | null = null;
	private motionListener: ((e: MediaQueryListEvent) => void) | null = null;

	mount(container: HTMLElement): void {
		this.container = container;
		container.textContent = "";
		this.spanGrid = [];
		this.lastChar = [];
		this.lastColor = [];
		this.lastShadow = [];

		for (let row = 0; row < ROWS; row++) {
			const rowEl = document.createElement("div");
			const spans: HTMLSpanElement[] = [];
			for (let col = 0; col < COLS; col++) {
				const span = document.createElement("span");
				span.textContent = " ";
				rowEl.appendChild(span);
				spans.push(span);
			}
			container.appendChild(rowEl);
			this.spanGrid.push(spans);
			this.lastChar.push(new Array(COLS).fill(""));
			this.lastColor.push(new Array(COLS).fill(""));
			this.lastShadow.push(new Array(COLS).fill(""));
		}

		this.motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
		this.motionListener = (e: MediaQueryListEvent) => {
			if (e.matches) {
				this.stopActive();
				this.stopIdle();
				this.renderStaticIdle();
				return;
			}
			if (this.isPlaying) {
				this.stopIdle();
				this.startActive();
			} else {
				this.stopActive();
				this.startIdle();
			}
		};
		this.motionQuery.addEventListener("change", this.motionListener);

		if (this.prefersReducedMotion()) {
			this.renderStaticIdle();
		} else {
			this.startIdle();
		}
	}

	connect(audioEl: HTMLAudioElement): void {
		if (this.sourceNode) return;
		let ctx: AudioContext | null = null;
		try {
			ctx = new AudioContext();
			const analyser = ctx.createAnalyser();
			analyser.fftSize = 256;
			analyser.smoothingTimeConstant = 0.7;
			const source = ctx.createMediaElementSource(audioEl);
			source.connect(analyser);
			analyser.connect(ctx.destination);
			this.freqData = new Uint8Array(analyser.frequencyBinCount);
			this.audioCtx = ctx;
			this.analyser = analyser;
			this.sourceNode = source;
		} catch {
			// Close any partially-created context so it isn't leaked; visualizer falls back to idle-only
			void ctx?.close().catch(() => {});
		}
	}

	setPlaying(playing: boolean): void {
		this.isPlaying = playing;
		if (this.prefersReducedMotion()) {
			this.stopActive();
			this.stopIdle();
			this.renderStaticIdle();
			return;
		}
		if (playing) {
			// Browsers may suspend AudioContext until user interaction; resume before rendering
			void this.audioCtx?.resume().catch(() => {});
			// If AudioContext setup failed, keep idle running rather than wasting a RAF loop
			if (!this.analyser) {
				this.stopActive();
				this.startIdle();
				return;
			}
			this.stopIdle();
			this.startActive();
		} else {
			this.stopActive();
			this.startIdle();
		}
	}

	setFlavor(flavor: MusicPlayerFlavor): void {
		this.theme = THEMES[flavor] ?? THEMES.DEFAULT;
		// Repaint immediately so idle/static states reflect the new theme without waiting for next tick
		if (!this.rafId) {
			if (this.prefersReducedMotion()) {
				this.renderStaticIdle();
			} else {
				this.renderIdle(this.idleTick);
			}
		}
	}

	teardown(): void {
		this.stopActive();
		this.stopIdle();
		this.isPlaying = false;
		if (this.motionQuery && this.motionListener) {
			this.motionQuery.removeEventListener("change", this.motionListener);
			this.motionQuery = null;
			this.motionListener = null;
		}
		if (this.audioCtx) {
			this.audioCtx.close().catch(() => {});
			this.audioCtx = null;
			this.analyser = null;
			this.sourceNode = null;
		}
		if (this.container) {
			this.container.textContent = "";
			this.container = null;
		}
		this.spanGrid = [];
		this.lastChar = [];
		this.lastColor = [];
		this.lastShadow = [];
		this.previousHeights.fill(0);
	}

	private prefersReducedMotion(): boolean {
		return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	}

	private startActive(): void {
		if (this.rafId) return;
		const tick = () => {
			this.renderActive();
			this.rafId = requestAnimationFrame(tick);
		};
		this.rafId = requestAnimationFrame(tick);
	}

	private stopActive(): void {
		if (this.rafId) {
			cancelAnimationFrame(this.rafId);
			this.rafId = 0;
		}
	}

	private startIdle(): void {
		if (this.intervalId) return;
		this.renderIdle(this.idleTick);
		this.intervalId = window.setInterval(() => {
			this.idleTick++;
			this.renderIdle(this.idleTick);
		}, IDLE_INTERVAL_MS);
	}

	private stopIdle(): void {
		if (this.intervalId) {
			clearInterval(this.intervalId);
			this.intervalId = 0;
		}
	}

	// Single cell write with cache guard — skips DOM mutation when nothing changed
	private setCell(row: number, col: number, char: string, color: string, shadow: string): void {
		if (
			this.lastChar[row]?.[col] === char &&
			this.lastColor[row]?.[col] === color &&
			this.lastShadow[row]?.[col] === shadow
		)
			return;
		const span = this.spanGrid[row]?.[col];
		if (!span) return;
		span.textContent = char;
		span.style.color = color;
		span.style.textShadow = shadow;
		const rc = this.lastChar[row];
		const rco = this.lastColor[row];
		const rs = this.lastShadow[row];
		if (rc) rc[col] = char;
		if (rco) rco[col] = color;
		if (rs) rs[col] = shadow;
	}

	private renderActive(): void {
		if (!this.analyser) {
			this.renderIdle(this.idleTick);
			return;
		}

		this.analyser.getByteFrequencyData(this.freqData);
		const binsPerCol = Math.floor(this.freqData.length / COLS);
		const barHeights: number[] = [];

		for (let col = 0; col < COLS; col++) {
			let sum = 0;
			for (let b = 0; b < binsPerCol; b++) {
				sum += this.freqData[col * binsPerCol + b] ?? 0;
			}
			const rawHeight = Math.floor((sum / binsPerCol / 255) * ROWS);
			const prev = this.previousHeights[col] ?? 0;
			const height = Math.max(rawHeight, prev - 1);
			this.previousHeights[col] = height;
			barHeights.push(height);
		}

		for (let row = 0; row < ROWS; row++) {
			const distFromBottom = ROWS - 1 - row;
			for (let col = 0; col < COLS; col++) {
				const barHeight = barHeights[col] ?? 0;
				if (distFromBottom < barHeight) {
					const charIdx = Math.min(CHARS.length - 1, Math.floor((barHeight / ROWS) * CHARS.length));
					const intensity = barHeight / ROWS;
					this.setCell(
						row,
						col,
						CHARS[charIdx] ?? " ",
						this.theme.getColor(distFromBottom, ROWS, intensity),
						this.theme.glow
					);
				} else {
					this.setCell(row, col, " ", "transparent", "none");
				}
			}
		}
	}

	private renderIdle(tick: number): void {
		const patternStart = 2;
		for (let row = 0; row < ROWS; row++) {
			const isPatternRow = row >= patternStart && row < patternStart + IDLE_PATTERN.length;
			for (let col = 0; col < COLS; col++) {
				if (isPatternRow) {
					const patternRowIdx = (row - patternStart + tick) % IDLE_PATTERN.length;
					const line = IDLE_PATTERN[patternRowIdx] ?? "";
					const padding = Math.floor((COLS - line.length) / 2);
					const charPos = col - padding;
					const char = charPos >= 0 && charPos < line.length ? (line[charPos] ?? " ") : " ";
					this.setCell(row, col, char, char !== " " ? this.theme.idleColor : "transparent", "none");
				} else {
					this.setCell(row, col, " ", "transparent", "none");
				}
			}
		}
	}

	private renderStaticIdle(): void {
		const patternStart = 2;
		for (let row = 0; row < ROWS; row++) {
			const isPatternRow = row >= patternStart && row < patternStart + IDLE_PATTERN.length;
			for (let col = 0; col < COLS; col++) {
				if (isPatternRow) {
					const patternRowIdx = row - patternStart;
					const line = IDLE_PATTERN[patternRowIdx] ?? "";
					const padding = Math.floor((COLS - line.length) / 2);
					const charPos = col - padding;
					const char = charPos >= 0 && charPos < line.length ? (line[charPos] ?? " ") : " ";
					this.setCell(row, col, char, char !== " " ? this.theme.idleColor : "transparent", "none");
				} else {
					this.setCell(row, col, " ", "transparent", "none");
				}
			}
		}
	}
}
