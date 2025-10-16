/**
 * Design Tokens - Color Palette
 *
 * Single source of truth for colors used across:
 * - Tailwind utilities (via tailwind.config.mjs)
 * - CSS custom properties (via global.css)
 * - JavaScript/TypeScript (via direct import)
 *
 * This consolidates colors that were previously defined in multiple locations:
 * 1. CSS variables in global.css (:root)
 * 2. Tailwind theme colors (tailwind.config.mjs)
 * 3. Hardcoded values throughout components
 *
 * @example
 * // In JavaScript/TypeScript
 * import colors from '@/config/design-tokens';
 * const primaryColor = colors.blue;
 *
 * @example
 * // In Tailwind
 * <div class="bg-palette-500 text-palette-700">
 *
 * @example
 * // In CSS
 * color: var(--blue);
 */

export default {
	/**
	 * Main color palette
	 * Numbered scale from 50 (lightest) to 900 (darkest)
	 */
	palette: {
		50: "#8e878c", // tangrey - Warm gray tone
		100: "#9f94a0", // neutralgrey - Neutral mid-gray
		200: "#bbb8bb", // lightgrey - Light gray
		300: "#dcb8b0", // pink - Soft pink accent
		400: "#e5cab7", // peach - Warm peach accent
		500: "#9bb0cd", // blue - Primary blue (used for links, accents)
		600: "#cad5db", // lightblue - Light blue tint
		700: "#120f19", // dark - Primary dark background
		800: "#947b82", // bold - Bold accent color
		900: "#201d29", // dark-alt - Alternative dark shade
	},

	/**
	 * Light theme specific colors
	 */
	light: {
		50: "#947b82", // bold-light - Bold accent in light mode
		100: "#ded9e3", // bg-light - Light background
		200: "#c3b8c1", // text-light - Light mode text
		300: "#635055", // accent-light - Light mode accent
	},

	/**
	 * Named semantic colors
	 * These provide human-readable names for easier reference
	 * Maps to palette numbers above
	 */
	tangrey: "#8e878c",
	neutralgrey: "#9f94a0",
	lightgrey: "#bbb8bb",
	pink: "#dcb8b0",
	peach: "#e5cab7",
	blue: "#9bb0cd",
	lightblue: "#cad5db",
	dark: "#120f19",
	bold: "#947b82",

	/**
	 * @deprecated Use palette.700 instead
	 */
	"dark-alt": "#201d29",
};
