/**
 * Design Tokens - Personal Retro Color Scheme
 *
 * Single source of truth for colors and design tokens used across:
 * - Tailwind utilities (via tailwind.config.mjs)
 * - CSS custom properties (via global.css)
 * - JavaScript/TypeScript (via direct import)
 *
 * STRUCTURE:
 * - Simplified semantic color system with light and dark themes
 * - Each theme defines: base, primary, secondary, accent, neutral, and status colors
 * - All colors include -content variants for proper contrast
 *
 * @example
 * // JavaScript/TypeScript
 * import tokens from '@/config/design-tokens';
 * const lightPrimary = tokens.light["color-primary"];
 * const darkBase = tokens.dark["color-base-100"];
 *
 * @example
 * // CSS custom properties
 * background-color: var(--color-base-100);
 * color: var(--color-primary);
 */

export default {
	light: {
		"color-base-100": "oklch(91.637% 0.034 90.515 / <alpha-value>)",
		"color-base-200": "oklch(88.272% 0.049 91.774 / <alpha-value>)",
		"color-base-300": "oklch(84.133% 0.065 90.856 / <alpha-value>)",
		"color-base-content": "oklch(41% 0.112 45.904 / <alpha-value>)",
		"color-primary": "oklch(88% 0.062 18.334 / <alpha-value>)",
		"color-primary-content": "oklch(39% 0.141 25.723 / <alpha-value>)",
		"color-secondary": "oklch(87% 0.15 154.449 / <alpha-value>)",
		"color-secondary-content": "oklch(39% 0.095 152.535 / <alpha-value>)",
		"color-accent": "oklch(90% 0.182 98.111 / <alpha-value>)",
		"color-accent-content": "oklch(41% 0.112 45.904 / <alpha-value>)",
		"color-neutral": "oklch(84.1% 0.081 73.639 / <alpha-value>)",
		"color-neutral-content": "oklch(44% 0.011 73.639 / <alpha-value>)",
		"color-info": "oklch(82% 0.111 230.318 / <alpha-value>)",
		"color-info-content": "oklch(39% 0.09 240.876 / <alpha-value>)",
		"color-success": "oklch(51% 0.096 186.391 / <alpha-value>)",
		"color-success-content": "oklch(96% 0.059 95.617 / <alpha-value>)",
		"color-warning": "oklch(64% 0.222 41.116 / <alpha-value>)",
		"color-warning-content": "oklch(96% 0.059 95.617 / <alpha-value>)",
		"color-error": "oklch(80% 0.114 19.571 / <alpha-value>)",
		"color-error-content": "oklch(40% 0.123 38.172 / <alpha-value>)",
		"radius-selector": "0rem",
		"radius-field": "0rem",
		"radius-box": "0rem",
		"size-selector": "0.25rem",
		"size-field": "0.25rem",
		border: "1px",
		depth: "1",
		noise: "1",
	},
	dark: {
		"color-base-100": "oklch(14.076% 0.004 285.822 / <alpha-value>)",
		"color-base-200": "oklch(20.219% 0.004 308.229 / <alpha-value>)",
		"color-base-300": "oklch(23.219% 0.004 308.229 / <alpha-value>)",
		"color-base-content": "oklch(96% 0.059 95.617 / <alpha-value>)",
		"color-primary": "oklch(70% 0.191 22.216 / <alpha-value>)",
		"color-primary-content": "oklch(25% 0.092 26.042 / <alpha-value>)",
		"color-secondary": "oklch(79% 0.209 151.711 / <alpha-value>)",
		"color-secondary-content": "oklch(26% 0.065 152.934 / <alpha-value>)",
		"color-accent": "oklch(85% 0.199 91.936 / <alpha-value>)",
		"color-accent-content": "oklch(28% 0.066 53.813 / <alpha-value>)",
		"color-neutral": "oklch(16% 0.019 329.708 / <alpha-value>)",
		"color-neutral-content": "oklch(70% 0.01 56.259 / <alpha-value>)",
		"color-info": "oklch(70% 0.165 254.624 / <alpha-value>)",
		"color-info-content": "oklch(28% 0.091 267.935 / <alpha-value>)",
		"color-success": "oklch(43% 0.078 188.216 / <alpha-value>)",
		"color-success-content": "oklch(92% 0.12 95.746 / <alpha-value>)",
		"color-warning": "oklch(47% 0.157 37.304 / <alpha-value>)",
		"color-warning-content": "oklch(92% 0.12 95.746 / <alpha-value>)",
		"color-error": "oklch(63% 0.237 25.331 / <alpha-value>)",
		"color-error-content": "oklch(26% 0.079 36.259 / <alpha-value>)",
		"radius-selector": "0rem",
		"radius-field": "0rem",
		"radius-box": "0rem",
		"size-selector": "0.25rem",
		"size-field": "0.25rem",
		border: "1px",
		depth: "1",
		noise: "1",
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
		sans: ["0xProto", "monospace"],
		mono: ["0xProto", "monospace"],
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
