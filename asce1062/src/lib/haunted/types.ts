import type { AdornmentKind } from "../shared/adornments";

/** Creature shape keys — currently aliases AdornmentKind, can diverge independently. */
export type CreatureKind = AdornmentKind;

export type HauntedCreatureOptions = {
	/** Fly-out duration in seconds. Default: 1.5 */
	animationTime?: number;
	/** Number of creatures to spawn. Default: 6 */
	numberOf?: number;
	/** Travel distance in pixels. Default: 200 */
	distance?: number;
	/** If false, creatures fly out only once (not reset across hovers). Default: true */
	repeat?: boolean;
	/** Width and height of each creature SVG in px. Default: { width: 44, height: 44 } */
	dimensions?: { width: number; height: number };
	/**
	 * CSS colors for creatures that use fill="currentColor".
	 * Multiple colors are distributed across creatures in round-robin
	 * order. Default: ["--color-primary"] from the active theme, tracks flavor changes.
	 * Has no effect on creatures with hardcoded SVG fills.
	 */
	colors?: string[];
};

export type HauntedGlowOptions = {
	/** Glow pulse cycle in seconds. Default: 3 */
	animationTime?: number;
	/** box-shadow value at glow lowest point. Default: '0px 0px 0px rgba(255,0,0,0)' */
	boxShadowOff?: string;
	/** box-shadow value at glow highest point. Default: '0px 0px 40px rgba(255,0,0,1)' */
	boxShadowOn?: string;
};

export type HauntedOptions = {
	creature?: CreatureKind;
	creatureOptions?: HauntedCreatureOptions;
	glowOptions?: HauntedGlowOptions;
	/** Set true to disable all effects. Default: false */
	disableFun?: boolean;
};
