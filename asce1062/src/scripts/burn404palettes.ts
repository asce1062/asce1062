/**
 * Theme-aware fire palette definitions for the Burn 404 effect.
 *
 * Color stops are CSS hex strings. The first TWO stops are always transparent
 * so palette indices 0-5 are fully transparent. This is critical for light
 * mode where semi-transparent dark pixels would create a visible grey overlay
 * over the page content. In dark mode those pixels blend invisibly into the
 * background, but in light mode they produce a noticeable translucent band.
 *
 * Naming convention:
 *   "dark"           - default dark fire (classic Doom PSX amber)
 *   "light"          - default light fire (same hues, transparent cold region)
 *   "<flavor>"       - flavor dark fire
 *   "<flavor>-light" - flavor light fire
 *
 * Flavors are dark-mode-native in CSS, but the fire reflects the user's
 * chosen flavor in both modes so the effect feels intentional.
 */

const PALETTE_SIZE = 37; // MAX_INTENSITY + 1

/**
 * Color stops per theme/flavor context.
 * Rules:
 *   - stops[0] AND stops[1] must be transparent (ending "00") so gradient
 *     indices 0-5 have near-zero alpha, eliminating the cold-cell overlay.
 *   - Light variants use brighter, more saturated tips so the fire pops on
 *     lighter page backgrounds.
 */
export const FIRE_COLOR_STOPS: Record<string, readonly string[]> = {
	// ── Dark base (classic Doom PSX fire) ─────────────────────────────────────
	dark: ["#07070700", "#07070700", "#771f07", "#df4f07", "#cf770f", "#bf9f1f", "#dbdb97", "#ffffff"],

	// ── Light base (same hues, cold end kept transparent) ────────────────────
	light: ["#00000000", "#00000000", "#df4f07", "#cf770f", "#ffaa20", "#ffdd88", "#ffffff"],

	// ── Observatory (nebula violet + gold starlight) ──────────────────────────
	observatory: ["#0d001a00", "#0d001a00", "#2e0854", "#6a1b9a", "#b34fd9", "#ffd66b", "#fff6d9"],
	"observatory-light": ["#0d001a00", "#0d001a00", "#5c2d91", "#9b4fd9", "#ffcf5c", "#fff6d9"],

	// ── CRT Green (phosphor terminal) ─────────────────────────────────────────
	"crt-green": ["#00110000", "#00110000", "#003300", "#007700", "#00cc44", "#55ff88", "#ccffcc"],
	"crt-green-light": ["#00110000", "#00110000", "#006600", "#00cc44", "#44ff77", "#ccffcc"],

	// ── Amber (warm archival terminal) ────────────────────────────────────────
	amber: ["#1a0c0000", "#1a0c0000", "#5c2d00", "#cc6600", "#ffaa00", "#ffdd55", "#fffacc"],
	"amber-light": ["#1a0c0000", "#1a0c0000", "#8a4400", "#dd8800", "#ffcc44", "#fffacc"],

	// ── Synthwave (cosmic demo-scene violet) ──────────────────────────────────
	synthwave: ["#1a003300", "#1a003300", "#4d0066", "#aa00cc", "#ee00ff", "#ff66ff", "#ffccff"],
	"synthwave-light": ["#1a003300", "#1a003300", "#7700aa", "#cc00ee", "#ff44ff", "#ffd0ff"],

	// ── DOS Blue (classic system UI) ──────────────────────────────────────────
	dos: ["#00001a00", "#00001a00", "#000044", "#0044bb", "#0088ee", "#66aaff", "#ccdfff"],
	"dos-light": ["#00001a00", "#00001a00", "#002288", "#0066cc", "#44aaff", "#ccdfff"],

	// ── Void (monochrome negative space) ──────────────────────────────────────
	void: ["#0d0d0d00", "#0d0d0d00", "#141414", "#373737", "#727272", "#a7a7a7", "#d3d3d3"],
	"void-light": ["#0d0d0d00", "#0d0d0d00", "#222222", "#555555", "#888888", "#bbbbbb"],

	// ── Ice (arctic cyan-white) ───────────────────────────────────────────────
	ice: ["#00151a00", "#00151a00", "#001a26", "#004466", "#00aacc", "#66eeff", "#ddfbff"],
	"ice-light": ["#00151a00", "#00151a00", "#004466", "#0099bb", "#55ccdd", "#c0f0ff"],

	// ── Redline (system anomaly crimson) ─────────────────────────────────────
	redline: ["#1a000000", "#1a000000", "#440000", "#880000", "#dd0000", "#ff5555", "#ffd0d0"],
	"redline-light": ["#1a000000", "#1a000000", "#660000", "#cc1111", "#ff5555", "#ffd0d0"],
};

/**
 * Returns the color stops for the currently active theme + flavor.
 * Light mode gets a -light variant so cold cells stay transparent
 * against the light page background.
 */
export function getActiveColorStops(): readonly string[] {
	if (typeof document === "undefined") return FIRE_COLOR_STOPS.dark;
	const theme = document.documentElement.getAttribute("data-theme") ?? "dark";
	const flavor = document.documentElement.getAttribute("data-flavor") ?? "";
	const isLight = theme !== "dark";

	if (!flavor) return FIRE_COLOR_STOPS[isLight ? "light" : "dark"];

	const key = isLight ? `${flavor}-light` : flavor;
	return FIRE_COLOR_STOPS[key] ?? FIRE_COLOR_STOPS[isLight ? "light" : "dark"];
}

/**
 * Interpolate color stops into a 37-step RGBA palette using a canvas gradient.
 * Accepts any CSS color format the browser understands (hex, oklch, named, etc.).
 * Returns an empty array on failure so the caller keeps its static fallback.
 */
export function buildPalette(stops: readonly string[]): readonly [number, number, number, number][] {
	if (typeof document === "undefined" || stops.length < 2) return [];

	const canvas = document.createElement("canvas");
	canvas.width = PALETTE_SIZE;
	canvas.height = 1;
	const ctx = canvas.getContext("2d");
	if (!ctx) return [];

	const grad = ctx.createLinearGradient(0, 0, PALETTE_SIZE - 1, 0);
	const step = 1 / (stops.length - 1);
	stops.forEach((color, i) => {
		grad.addColorStop(Math.min(1, i * step), color);
	});

	ctx.fillStyle = grad;
	ctx.fillRect(0, 0, PALETTE_SIZE, 1);

	const px = ctx.getImageData(0, 0, PALETTE_SIZE, 1).data;
	return Array.from({ length: PALETTE_SIZE }, (_, i): [number, number, number, number] => [
		px[i * 4],
		px[i * 4 + 1],
		px[i * 4 + 2],
		px[i * 4 + 3],
	]);
}
