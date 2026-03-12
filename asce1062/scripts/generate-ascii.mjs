/**
 * Generates figlet ASCII art for all configured variants and writes the results
 * to src/data/ascii-art.json as a static pre-computed resource.
 *
 * Run with:  npm run generate:ascii
 *
 * ─── HOW TO CUSTOMIZE ────────────────────────────────────────────────────────
 *
 * 1. Add text strings to TEXTS.
 * 2. Add font names to FONTS (must be valid figlet font names).
 *    Browse available fonts at:
 *      - https://patorjk.com/software/taag/
 *    or list them locally with:
 *			- node -e "import('figlet').then(f => f.default.fontsSync().forEach(font => console.log(font)))"
 * 3. Optionally pin a specific (text, font) pair in PINNED_VARIANTS
 *    	- these are always included regardless of the matrix above.
 *
 * The script generates every (text × font) combination from the matrix,
 * plus any pinned variants, deduplicating by (text, font) key.
 * If a font doesn't support a particular text, that variant is skipped.
 *
 * ─── OUTPUT ───────────────────────────────────────────────────────────────────
 *
 * Writes src/data/ascii-art.json
 * 	- a JSON array of:
 * 		{ "text": string, "font": string, "art": string }
 */

import figlet from "figlet";
import { writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── CONFIGURATION ────────────────────────────────────────────────────────────

/**
 * Text strings to render.
 * Each will be combined with every font in FONTS.
 */
const TEXTS = ["alex", "asce", "ascii", "frosty", "404"];

/**
 * Fonts to apply to every text in TEXTS.
 * Browse:
 * 	- https://www.figlet.org/cgi-bin/fontdb.cgi
 *  - https://patorjk.com/software/taag/
 * Local list:
 *	- node -e "import('figlet').then(f => f.default.fontsSync().forEach(font => console.log(font)))"
 */
const FONTS = [
	"BlurVision ASCII",
	"Graffiti",
	"Rectangles",
	"Small Isometric1",
	"Sub-Zero",
	"Swamp Land",
	"Terrace",
	"Tmplr",
	"ANSI Compact",
	"ANSI Regular",
	"ANSI Shadow",
	"Bloody",
	"Calvin S",
	"Coder Mini",
	"Elite",
	"Stronger Than All",
	"The Edge",
	"Emboss",
	"Future",
	"Pagga",
	"Rebel",
	"DOS Rebel",
	"Larry 3D",
	"Poison",
	"Rammstein",
	"Red Phoenix",
	"Spliff",
	"Stacey",
	"Whimsy",
];

/**
 * Pinned (text, font) pairs (always included, regardless of the matrix).
 * Useful for one-off combinations you want without applying a font to all texts.
 * @example { text: "hello", font: "Banner" }
 */
const PINNED_VARIANTS = [
	// { text: "asce", font: "Banner3-D" },
];

/**
 * Soft warning threshold
 * Large queues slow the build noticeably.
 */
const QUEUE_WARN_THRESHOLD = 500;

// ─── OUTPUT ───────────────────────────────────────────────────────────────────

const OUT_PATH = resolve(__dirname, "../src/data/ascii-art.json");
const OUT_LABEL = relative(resolve(__dirname, ".."), OUT_PATH);

// ─── HELPERS ─────────────────────────────────────────────────────────────────

/**
 * Trim and return a string, or throw a clear error if empty / whitespace-only.
 * @param {unknown} value
 * @param {string} context  human-readable location for error messages
 * @returns {string}
 */
function normalizeConfigString(value, context) {
	if (typeof value !== "string") {
		throw new Error(`${context}: expected string, got ${typeof value}`);
	}
	const trimmed = value.trim();
	if (!trimmed) {
		throw new Error(`${context}: value is empty or whitespace-only`);
	}
	return trimmed;
}

/**
 * Validate and normalize all config values before generation starts.
 * Throws with a clear message if anything is malformed.
 */
function validateConfig() {
	if (!Array.isArray(TEXTS) || TEXTS.length === 0) {
		throw new Error("TEXTS must be a non-empty array");
	}
	if (!Array.isArray(FONTS) || FONTS.length === 0) {
		throw new Error("FONTS must be a non-empty array");
	}

	const texts = TEXTS.map((t, i) => normalizeConfigString(t, `TEXTS[${i}]`));
	const fonts = FONTS.map((f, i) => normalizeConfigString(f, `FONTS[${i}]`));

	const pinned = PINNED_VARIANTS.map((entry, i) => {
		if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
			throw new Error(`PINNED_VARIANTS[${i}]: expected object, got ${Array.isArray(entry) ? "array" : typeof entry}`);
		}
		return {
			text: normalizeConfigString(entry.text, `PINNED_VARIANTS[${i}].text`),
			font: normalizeConfigString(entry.font, `PINNED_VARIANTS[${i}].font`),
		};
	});

	return { texts, fonts, pinned };
}

/**
 * Build the deduplicated variant queue from the matrix + pinned list.
 * Matrix entries come first (in declaration order), pinned entries append after.
 * Duplicates are counted and silently removed, caller decides whether to report.
 */
function buildVariantQueue(texts, fonts, pinned) {
	const seen = new Set();
	const queue = [];
	let duplicates = 0;

	function enqueue(text, font) {
		const key = `${text}::${font}`;
		if (seen.has(key)) {
			duplicates++;
			return;
		}
		seen.add(key);
		queue.push({ text, font });
	}

	for (const text of texts) {
		for (const font of fonts) {
			enqueue(text, font);
		}
	}
	for (const { text, font } of pinned) {
		enqueue(text, font);
	}

	return { queue, duplicates };
}

/**
 * Wrap figlet.text in a Promise.
 * Treats empty or whitespace-only output as a generation failure.
 * Normalizes all error values into readable Error instances.
 */
function generateArt(text, font) {
	return new Promise((resolve, reject) => {
		figlet.text(text, { font }, (err, result) => {
			if (err) {
				const message = err instanceof Error ? err.message : String(err);
				reject(new Error(`figlet error for font "${font}": ${message}`));
				return;
			}
			if (!result || !result.trim()) {
				reject(new Error(`figlet returned empty output for font "${font}"`));
				return;
			}
			resolve(result);
		});
	});
}

/**
 * Serialize results to a stable, readable JSON string.
 * Output is deterministic. Ordering follows the queue order.
 */
function formatGeneratedJson(results) {
	return JSON.stringify(results, null, 2) + "\n";
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
	const { texts, fonts, pinned } = validateConfig();
	const { queue, duplicates } = buildVariantQueue(texts, fonts, pinned);

	if (duplicates > 0) {
		console.warn(`  ⚠  Removed ${duplicates} duplicate variant definition(s) from config.\n`);
	}

	if (queue.length > QUEUE_WARN_THRESHOLD) {
		console.warn(`  ⚠  Large queue (${queue.length} variants). This may take a while.\n`);
	}

	const results = [];
	const skipped = [];

	for (const { text, font } of queue) {
		try {
			const art = await generateArt(text, font);
			results.push({ text, font, art });
			console.log(`  ✓  ${font.padEnd(24)}  "${text}"`);
		} catch (err) {
			skipped.push({ text, font, reason: err.message });
			console.log(`  ✗  ${font.padEnd(24)}  "${text}"`);
		}
	}

	if (results.length === 0) {
		console.error("\n  ✗  No variants generated. Every font failed. Aborting.");
		process.exit(1);
	}

	if (skipped.length > 0) {
		console.log("\n  Skipped:");
		for (const { text, font, reason } of skipped) {
			console.log(`    ${font} / "${text}" - ${reason}`);
		}
	}

	writeFileSync(OUT_PATH, formatGeneratedJson(results), "utf8");

	const col = 12;
	console.log(
		[
			"",
			`${"Queued:".padEnd(col)}${queue.length}`,
			`${"Generated:".padEnd(col)}${results.length}`,
			`${"Skipped:".padEnd(col)}${skipped.length}`,
			`${"Wrote:".padEnd(col)}${OUT_LABEL}`,
		].join("\n")
	);
}

main().catch((err) => {
	console.error(err instanceof Error ? `\n  Error: ${err.message}` : err);
	process.exit(1);
});
