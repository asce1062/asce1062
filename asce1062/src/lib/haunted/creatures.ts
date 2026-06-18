/**
 * Creature SVG registry for the Haunted component.
 *
 * SVG strings are sourced from the shared adornments registry so they stay in
 * sync with MagicalText sparkles. To add a creature:
 *   1. Add the key to `AdornmentKind` in src/lib/shared/adornments.ts.
 *   2. Add the SVG string + AdornmentConfig entry to ADORNMENTS there.
 *   3. Add the key → svg mapping below.
 */

import type { CreatureKind } from "./types";
import { ADORNMENTS } from "../shared/adornments";

export const CREATURES: Record<CreatureKind, string> = {
	ghost: ADORNMENTS.ghost.svg,
	"ghost-alt": ADORNMENTS["ghost-alt"].svg,
	heart: ADORNMENTS.heart.svg,
	star: ADORNMENTS.star.svg,
	"north-star": ADORNMENTS["north-star"].svg,
	"music-note": ADORNMENTS["music-note"].svg,
	cassette: ADORNMENTS["cassette"].svg,
};
