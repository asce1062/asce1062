export type AdornmentKind = "star" | "heart" | "ghost" | "ghost-alt";
export type AnimationType = "sparkle" | "scale";

export type RGBColor = { r: number; g: number; b: number };

export type MagicalTextOptions = {
	/** CSS color strings. Default: ['darkorange', 'purple'] */
	colors?: string[];
	/** Gradient sweep cycle duration in seconds. Default: 10 */
	animationTime?: number;
	/** Show floating adornments. Default: true */
	showAdornments?: boolean;
	/** Which SVG adornment to use. Default: 'star' */
	adornment?: AdornmentKind;
	/** Number of adornments. Default: 3 */
	adornmentCount?: number;
	/** Adornment width and height in px. Default: 16 */
	adornmentSize?: number;
	/** Adornment opacity 0–1. Default: 0.7 */
	adornmentOpacity?: number;
	/** Adornment animation cycle in seconds. Default: 1.25 */
	adornmentDuration?: number;
	/**
	 * Animation style. 'sparkle' rotates while scaling; 'scale' only scales.
	 * Defaults: star/heart → 'sparkle'; ghost/ghost-alt → 'scale'.
	 */
	animationType?: AnimationType;
};
