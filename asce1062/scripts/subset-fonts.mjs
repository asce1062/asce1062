/**
 * Builds the web fonts in public/fonts/0xProto/ from the source TTFs in
 * src/assets/fonts/0xProto/.
 *
 * Run with:  npm run fonts:subset
 *
 * The source is 0xProto Nerd Font Mono: ~11k glyphs, ~10.4k of them Nerd Font
 * icons in the Private Use Areas, so each weight is ~1 MB as woff2. The site
 * renders text, not icons, so every weight is split in two:
 *
 * - 0xProto-<Weight>.woff2: every non-icon glyph (Latin, punctuation, box
 *   drawing and block elements for the ASCII art). Ligatures and kerning for
 *   these glyphs are kept.
 * - 0xProto-Icons.woff2: the icons, from the Regular weight. Its @font-face
 *   declares the icon unicode-range, so a browser only downloads it on a page
 *   that actually renders an icon glyph.
 *
 * Keep TEXT_RANGES / ICON_RANGES in sync with the unicode-range values in
 * src/styles/global.css.
 *
 * The full TTFs stay in src/assets (not served): the Open Graph image
 * renderer reads them at build time.
 */

import subsetFont from "subset-font";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SOURCE_DIR = resolve(ROOT, "src/assets/fonts/0xProto");
const OUTPUT_DIR = resolve(ROOT, "public/fonts/0xProto");

const WEIGHTS = ["Regular", "Bold", "Italic"];

/** Everything outside the Private Use Areas (U+D800-DFFF are surrogates, not characters). */
const TEXT_RANGES = [
	[0x0000, 0xd7ff],
	[0xf900, 0xffff],
];

/** The Private Use Areas, where Nerd Fonts places its icons. */
const ICON_RANGES = [
	[0xe000, 0xf8ff],
	[0xf0000, 0x10ffff],
];

function rangesToText(ranges) {
	let text = "";
	for (const [start, end] of ranges) {
		for (let cp = start; cp <= end; cp++) text += String.fromCodePoint(cp);
	}
	return text;
}

async function writeSubset(sourceName, outputName, ranges) {
	const source = readFileSync(resolve(SOURCE_DIR, sourceName));
	const subset = await subsetFont(source, rangesToText(ranges), { targetFormat: "woff2" });
	const outputPath = resolve(OUTPUT_DIR, outputName);
	writeFileSync(outputPath, subset);
	console.log(`  ${relative(ROOT, outputPath).padEnd(45)} ${(subset.length / 1024).toFixed(1)} KiB`);
}

console.log("Subsetting 0xProto:");
for (const weight of WEIGHTS) {
	await writeSubset(`0xProto-${weight}.ttf`, `0xProto-${weight}.woff2`, TEXT_RANGES);
}
await writeSubset("0xProto-Regular.ttf", "0xProto-Icons.woff2", ICON_RANGES);
