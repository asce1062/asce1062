/**
 * Design Tokens - Personal Retro Color Scheme
 *
 * Single source of truth for colors and design tokens used across:
 * - Tailwind utilities (via tailwind.config.mjs)
 * - CSS custom properties (via global.css)
 * - JavaScript/TypeScript (via direct import)
 *
 * STRUCTURE:
 * - palette: Numbered scale (50-900) with darker colors, used for light mode text/accents
 * - light: Numbered scale (50-900) with lighter colors, used for light mode backgrounds/dark mode text
 * - light.colors: Full color scales for light mode (brand, neutral, secondary, accent, error, warning, success)
 * - dark.colors: Full color scales for dark mode (inverted brightness for retro aesthetic)
 *
 * PATTERNS:
 *
 * 1. palette/light numbered scales:
 *    - Text: text-palette-X (dark text, light mode) / dark:text-light-X (light text, dark mode)
 *    - Backgrounds: bg-light-X (light bg, light mode) / dark:bg-palette-X (dark bg, dark mode)
 *    - Borders: border-light-X (light mode) / dark:border-palette-X (dark mode)
 *
 * 2. Semantic theme colors:
 *    Tailwind uses light.colors as default. Choose appropriate shades for contrast:
 *    - Light mode: Lighter backgrounds (50-200), darker text (700-900)
 *      Example: bg-neutral-100 text-neutral-900
 *    - Dark mode: Darker backgrounds (700-900), lighter text (50-200)
 *      Example: dark:bg-neutral-800 dark:text-neutral-100
 *    - Brand/Accent: Use mid-range for interactive elements
 *      Example: bg-brand-500 hover:bg-brand-600 dark:bg-brand-400 dark:hover:bg-brand-500
 *    - Status colors: Use consistent shades across themes
 *      Example: text-error-600 dark:text-error-400
 *
 * @example
 * // JavaScript/TypeScript - Legacy numbered scales
 * import tokens from '@/config/design-tokens';
 * const darkText = tokens.palette[900]; // "rgb(40, 35, 30)" - very dark for light mode
 * const lightBg = tokens.light[100]; // "rgb(231, 220, 199)" - cream for light mode
 *
 * @example
 * // JavaScript/TypeScript - Full theme color scales
 * import tokens from '@/config/design-tokens';
 * const lightBrand = tokens.light.colors.brand[500]; // "rgb(230, 140, 85)" - light mode brand
 * const darkBrand = tokens.dark.colors.brand[500]; // "rgb(239, 177, 149)" - dark mode brand
 * const lightNeutral = tokens.light.colors.neutral[700]; // "rgb(244, 238, 224)" - light neutral
 * const darkNeutral = tokens.dark.colors.neutral[700]; // "rgb(72, 60, 50)" - dark neutral
 * const errorColor = tokens.light.colors.error[500]; // Access status colors
 * const accentColor = tokens.dark.colors.accent[600]; // "rgb(185, 155, 80)" - retro gold
 *
 * @example
 * // Tailwind - Using numbered scales (palette/light)
 * <div class="bg-light-100 dark:bg-palette-900">
 *   <h1 class="text-palette-900 dark:text-light-900">Heading</h1>
 *   <p class="text-palette-700 dark:text-light-700">Body text</p>
 * </div>
 *
 * @example
 * // Tailwind - Using full theme scales (brand, neutral, etc.)
 * <button class="bg-brand-500 hover:bg-brand-600 text-neutral-900 dark:text-neutral-50">
 *   Click me
 * </button>
 * <div class="border-2 border-secondary-300 text-accent-600">
 *   Retro styled element
 * </div>
 * <p class="text-error-500">Error message</p>
 *
 * @example
 * // CSS - Legacy CSS variables (backward compatibility)
 * background-color: var(--tangrey);
 * color: var(--dark);
 * border-color: var(--neutral-border);
 */

export default {
	palette: {
		50: "rgb(65, 60, 55)", // tangrey - source: dark.colors.neutral-300
		100: "rgb(90, 85, 78)", // neutralgrey - source: dark.colors.neutral-400
		200: "rgb(130, 120, 108)", // lightgrey - source: dark.colors.neutral-500
		300: "rgb(247, 168, 120)", // pink - source: light.colors.brand-400
		400: "rgb(255, 193, 158)", // peach - source: light.colors.brand-300
		500: "rgb(110, 195, 188)", // blue - source: light.colors.secondary-500
		600: "rgb(180, 225, 220)", // lightblue - source: light.colors.secondary-300
		700: "rgb(28, 25, 23)", // dark - source: light.colors.neutral-950
		800: "rgb(185, 155, 80)", // bold - source: light.colors.accent-600
		900: "rgb(40, 35, 30)", // dark-alt - source: light.colors.neutral-900
	},
	light: {
		50: "rgb(130, 118, 100)", // tangrey - source: light.colors.neutral-500
		100: "rgb(170, 155, 130)", // neutralgrey - source: light.colors.neutral-400
		200: "rgb(200, 182, 152)", // lightgrey - source: light.colors.neutral-300
		300: "rgb(180, 105, 65)", // pink - source: dark.colors.brand-400
		400: "rgb(130, 75, 50)", // peach - source: dark.colors.brand-300
		500: "rgb(65, 170, 183)", // blue - source: dark.colors.secondary-500
		600: "rgb(38, 95, 102)", // lightblue - source: dark.colors.secondary-300
		700: "rgb(244, 238, 224)", // light - source: dark.colors.neutral-950
		800: "rgb(255, 213, 79)", // bold - source: dark.colors.accent-600
		900: "rgb(235, 228, 215)", // light-alt - source: dark.colors.neutral-900
		colors: {
			// peach/coral
			brand: {
				50: "rgb(255, 250, 245)",
				100: "rgb(255, 237, 225)",
				200: "rgb(255, 218, 195)",
				300: "rgb(255, 193, 158)",
				400: "rgb(247, 168, 120)",
				500: "rgb(239, 177, 149)",
				600: "rgb(230, 145, 101)",
				700: "rgb(210, 115, 75)",
				800: "rgb(180, 90, 55)",
				900: "rgb(140, 70, 40)",
			},
			// beige/tan
			neutral: {
				0: "rgb(244, 238, 224)", // base-100 - cream
				50: "rgb(240, 232, 216)",
				100: "rgb(231, 220, 199)", // base-200 - light tan
				200: "rgb(217, 202, 174)", // base-300 - tan
				300: "rgb(200, 182, 152)",
				400: "rgb(170, 155, 130)",
				500: "rgb(130, 118, 100)",
				600: "rgb(90, 87, 86)", // neutral
				700: "rgb(72, 60, 50)", // base-content - dark brown
				800: "rgb(55, 48, 42)",
				900: "rgb(40, 35, 30)",
				950: "rgb(28, 25, 23)",
			},
			// coral/salmon
			error: {
				50: "rgb(255, 245, 245)",
				100: "rgb(255, 230, 230)",
				200: "rgb(255, 205, 205)",
				300: "rgb(255, 180, 180)",
				400: "rgb(247, 154, 154)",
				500: "rgb(239, 154, 154)",
				600: "rgb(229, 115, 115)",
				700: "rgb(211, 85, 85)",
				800: "rgb(183, 65, 65)",
				900: "rgb(150, 50, 50)",
			},
			// orange/amber
			warning: {
				50: "rgb(255, 250, 240)",
				100: "rgb(255, 243, 224)",
				200: "rgb(255, 230, 190)",
				300: "rgb(255, 210, 145)",
				400: "rgb(255, 190, 90)",
				500: "rgb(255, 167, 38)",
				600: "rgb(245, 145, 20)",
				700: "rgb(220, 120, 10)",
				800: "rgb(190, 95, 5)",
				900: "rgb(150, 70, 0)",
			},
			// teal/cyan
			success: {
				50: "rgb(230, 250, 248)",
				100: "rgb(204, 245, 241)",
				200: "rgb(153, 235, 228)",
				300: "rgb(102, 220, 210)",
				400: "rgb(64, 200, 188)",
				500: "rgb(38, 166, 154)",
				600: "rgb(28, 145, 135)",
				700: "rgb(20, 120, 112)",
				800: "rgb(15, 95, 88)",
				900: "rgb(10, 70, 65)",
			},
			// mint
			secondary: {
				50: "rgb(240, 252, 250)",
				100: "rgb(224, 248, 245)",
				200: "rgb(214, 237, 234)",
				300: "rgb(180, 225, 220)",
				400: "rgb(145, 210, 205)",
				500: "rgb(110, 195, 188)",
				600: "rgb(80, 175, 168)",
				700: "rgb(60, 150, 143)",
				800: "rgb(45, 125, 118)",
				900: "rgb(30, 95, 88)",
			},
			accent: {
				50: "rgb(255, 252, 235)",
				100: "rgb(255, 247, 210)",
				200: "rgb(245, 230, 165)",
				300: "rgb(230, 210, 130)",
				400: "rgb(217, 192, 110)",
				500: "rgb(204, 174, 98)", // accent - gold/mustard
				600: "rgb(185, 155, 80)",
				700: "rgb(165, 135, 65)",
				800: "rgb(140, 112, 50)",
				900: "rgb(110, 85, 35)",
			},
		},
		semanticColors: {
			"brand-primary": "rgb(239, 177, 149)",
			"default-font": "rgb(72, 60, 50)",
			"subtext-color": "rgb(130, 118, 100)",
			"neutral-border": "rgb(217, 202, 174)",
			white: "rgb(244, 238, 224)",
			"default-background": "rgb(244, 238, 224)",
		},
	},
	dark: {
		colors: {
			// Bright peach
			brand: {
				50: "rgb(50, 30, 25)",
				100: "rgb(70, 40, 30)",
				200: "rgb(95, 55, 40)",
				300: "rgb(130, 75, 50)",
				400: "rgb(180, 105, 65)",
				500: "rgb(230, 140, 85)",
				600: "rgb(255, 165, 100)",
				700: "rgb(255, 183, 120)",
				800: "rgb(255, 200, 145)",
				900: "rgb(255, 225, 190)",
			},
			// Dark brown
			neutral: {
				0: "rgb(18, 16, 14)", // Very dark brown
				50: "rgb(28, 25, 23)", // Dark brown bg
				100: "rgb(38, 35, 32)", // base-200
				200: "rgb(48, 45, 42)", // base-300
				300: "rgb(65, 60, 55)",
				400: "rgb(90, 85, 78)",
				500: "rgb(130, 120, 108)",
				600: "rgb(170, 158, 142)",
				700: "rgb(200, 188, 170)",
				800: "rgb(220, 210, 195)",
				900: "rgb(235, 228, 215)",
				950: "rgb(244, 238, 224)", // Light cream
			},
			// Bright coral-red
			error: {
				50: "rgb(45, 20, 20)",
				100: "rgb(65, 25, 25)",
				200: "rgb(90, 30, 30)",
				300: "rgb(120, 40, 40)",
				400: "rgb(165, 55, 55)",
				500: "rgb(210, 75, 75)",
				600: "rgb(239, 83, 80)",
				700: "rgb(245, 108, 108)",
				800: "rgb(250, 140, 140)",
				900: "rgb(255, 180, 180)",
			},
			// Bright orange
			warning: {
				50: "rgb(40, 28, 0)",
				100: "rgb(60, 40, 0)",
				200: "rgb(85, 55, 0)",
				300: "rgb(115, 75, 5)",
				400: "rgb(155, 105, 15)",
				500: "rgb(200, 135, 25)",
				600: "rgb(255, 167, 38)",
				700: "rgb(255, 185, 70)",
				800: "rgb(255, 205, 110)",
				900: "rgb(255, 230, 160)",
			},
			// Bright teal
			success: {
				50: "rgb(15, 35, 32)",
				100: "rgb(20, 50, 45)",
				200: "rgb(25, 70, 65)",
				300: "rgb(30, 95, 88)",
				400: "rgb(35, 125, 115)",
				500: "rgb(42, 160, 148)",
				600: "rgb(50, 190, 176)",
				700: "rgb(80, 210, 195)",
				800: "rgb(120, 230, 215)",
				900: "rgb(170, 245, 235)",
			},
			// Bright cyan
			secondary: {
				50: "rgb(15, 35, 38)",
				100: "rgb(20, 48, 52)",
				200: "rgb(28, 68, 73)",
				300: "rgb(38, 95, 102)",
				400: "rgb(50, 130, 140)",
				500: "rgb(65, 170, 183)",
				600: "rgb(77, 208, 225)",
				700: "rgb(105, 220, 235)",
				800: "rgb(140, 232, 243)",
				900: "rgb(185, 245, 250)",
			},
			// Bright yellow-gold
			accent: {
				50: "rgb(38, 32, 10)",
				100: "rgb(55, 45, 15)",
				200: "rgb(78, 65, 20)",
				300: "rgb(110, 90, 28)",
				400: "rgb(150, 120, 38)",
				500: "rgb(195, 158, 50)",
				600: "rgb(255, 213, 79)",
				700: "rgb(255, 225, 115)",
				800: "rgb(255, 235, 155)",
				900: "rgb(255, 245, 200)",
			},
		},
		semanticColors: {
			"brand-primary": "rgb(255, 165, 100)",
			"default-font": "rgb(235, 228, 215)",
			"subtext-color": "rgb(170, 158, 142)",
			"neutral-border": "rgb(48, 45, 42)",
			black: "rgb(18, 16, 14)",
			"default-background": "rgb(28, 25, 23)",
		},
	},
	fontSize: {
		caption: ["12px", { lineHeight: "16px", fontWeight: "400", letterSpacing: "0em" }],
		"caption-bold": ["12px", { lineHeight: "16px", fontWeight: "700", letterSpacing: "0em" }],
		body: ["14px", { lineHeight: "20px", fontWeight: "400", letterSpacing: "0em" }],
		"body-bold": ["14px", { lineHeight: "20px", fontWeight: "700", letterSpacing: "0em" }],
		"heading-3": ["16px", { lineHeight: "20px", fontWeight: "800", letterSpacing: "0em" }],
		"heading-2": ["20px", { lineHeight: "24px", fontWeight: "800", letterSpacing: "0em" }],
		"heading-1": ["30px", { lineHeight: "36px", fontWeight: "800", letterSpacing: "0em" }],
		"monospace-body": ["14px", { lineHeight: "20px", fontWeight: "400", letterSpacing: "0em" }],
	},
	fontFamily: {
		caption: ["0xProto", "monospace"],
		"caption-bold": ["0xProto", "monospace"],
		body: ["0xProto", "monospace"],
		"body-bold": ["0xProto", "monospace"],
		"heading-3": ["0xProto", "monospace"],
		"heading-2": ["0xProto", "monospace"],
		"heading-1": ["0xProto", "monospace"],
		"monospace-body": ["0xProto", "monospace"],
		proto: ["0xProto", "monospace"],
		retro: ["uni0553", "monospace"],
	},
	boxShadow: {
		sm: "0px 1px 2px 0px rgba(0, 0, 0, 0.05)",
		default: "0px 1px 2px 0px rgba(0, 0, 0, 0.05)",
		md: "0px 4px 16px -2px rgba(0, 0, 0, 0.08), 0px 2px 4px -1px rgba(0, 0, 0, 0.08)",
		lg: "0px 12px 32px -4px rgba(0, 0, 0, 0.08), 0px 4px 8px -2px rgba(0, 0, 0, 0.08)",
		overlay: "0px 12px 32px -4px rgba(0, 0, 0, 0.08), 0px 4px 8px -2px rgba(0, 0, 0, 0.08)",
	},
	borderRadius: {
		sm: "0px",
		md: "0px",
		DEFAULT: "0px",
		lg: "0px",
		full: "9999px",
	},
	spacing: {
		112: "28rem",
		144: "36rem",
		192: "48rem",
		256: "64rem",
		320: "80rem",
		inline: "clamp(20px, 4vw, 80px)",
	},
};
