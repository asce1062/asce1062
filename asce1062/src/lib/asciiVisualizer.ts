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

	mount(container: HTMLElement): void {
		this.container = container;
		container.textContent = "";
		this.spanGrid = [];

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
		}

		if (this.prefersReducedMotion()) {
			this.renderStaticIdle();
		} else {
			this.startIdle();
		}
	}

	connect(audioEl: HTMLAudioElement): void {
		if (this.sourceNode) return;
		try {
			const ctx = new AudioContext();
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
			// AudioContext unavailable (visualizer falls back to idle-only)
		}
	}

	setPlaying(playing: boolean): void {
		if (this.prefersReducedMotion()) {
			this.renderStaticIdle();
			return;
		}
		if (playing) {
			this.stopIdle();
			this.startActive();
		} else {
			this.stopActive();
			this.startIdle();
		}
	}

	setFlavor(flavor: MusicPlayerFlavor): void {
		this.theme = THEMES[flavor] ?? THEMES.DEFAULT;
	}

	teardown(): void {
		this.stopActive();
		this.stopIdle();
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
			barHeights.push(Math.floor((sum / binsPerCol / 255) * ROWS));
		}

		for (let row = 0; row < ROWS; row++) {
			const distFromBottom = ROWS - 1 - row;
			for (let col = 0; col < COLS; col++) {
				const span = this.spanGrid[row]?.[col];
				if (!span) continue;
				const barHeight = barHeights[col] ?? 0;
				if (distFromBottom < barHeight) {
					const charIdx = Math.min(CHARS.length - 1, Math.floor((barHeight / ROWS) * CHARS.length));
					const intensity = barHeight / ROWS;
					span.textContent = CHARS[charIdx] ?? " ";
					span.style.color = this.theme.getColor(distFromBottom, ROWS, intensity);
					span.style.textShadow = this.theme.glow;
				} else {
					span.textContent = " ";
					span.style.color = "transparent";
					span.style.textShadow = "none";
				}
			}
		}
	}

	private renderIdle(tick: number): void {
		const patternStart = 2;
		for (let row = 0; row < ROWS; row++) {
			const isPatternRow = row >= patternStart && row < patternStart + IDLE_PATTERN.length;
			for (let col = 0; col < COLS; col++) {
				const span = this.spanGrid[row]?.[col];
				if (!span) continue;
				if (isPatternRow) {
					const patternRowIdx = (row - patternStart + tick) % IDLE_PATTERN.length;
					const line = IDLE_PATTERN[patternRowIdx] ?? "";
					const padding = Math.floor((COLS - line.length) / 2);
					const charPos = col - padding;
					const char = charPos >= 0 && charPos < line.length ? (line[charPos] ?? " ") : " ";
					span.textContent = char;
					span.style.color = char !== " " ? this.theme.idleColor : "transparent";
					span.style.textShadow = "none";
				} else {
					span.textContent = " ";
					span.style.color = "transparent";
					span.style.textShadow = "none";
				}
			}
		}
	}

	private renderStaticIdle(): void {
		const patternStart = 2;
		for (let row = 0; row < ROWS; row++) {
			const isPatternRow = row >= patternStart && row < patternStart + IDLE_PATTERN.length;
			for (let col = 0; col < COLS; col++) {
				const span = this.spanGrid[row]?.[col];
				if (!span) continue;
				if (isPatternRow) {
					const patternRowIdx = row - patternStart;
					const line = IDLE_PATTERN[patternRowIdx] ?? "";
					const padding = Math.floor((COLS - line.length) / 2);
					const charPos = col - padding;
					const char = charPos >= 0 && charPos < line.length ? (line[charPos] ?? " ") : " ";
					span.textContent = char;
					span.style.color = char !== " " ? this.theme.idleColor : "transparent";
					span.style.textShadow = "none";
				} else {
					span.textContent = " ";
					span.style.color = "transparent";
					span.style.textShadow = "none";
				}
			}
		}
	}
}
