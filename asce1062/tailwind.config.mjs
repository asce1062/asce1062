import designTokens from "./src/config/design-tokens.mjs";
/** @type {import('tailwindcss').Config} */
export default {
	darkMode: ["class", '[data-theme="dark"]'],
	content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
	theme: {
		extend: {
			colors: {
				// palette/light structure (backward compatibility)
				palette: designTokens.palette,
				light: designTokens.light,

				// Brand colors (warm peach/coral)
				brand: designTokens.light.colors.brand,

				// Neutral colors (warm beige/brown)
				neutral: designTokens.light.colors.neutral,

				// Secondary colors (mint/cyan)
				secondary: designTokens.light.colors.secondary,

				// Accent colors (gold/mustard)
				accent: designTokens.light.colors.accent,

				// Status colors
				error: designTokens.light.colors.error,
				warning: designTokens.light.colors.warning,
				success: designTokens.light.colors.success,

				// Semantic colors
				"brand-primary": designTokens.light.semanticColors["brand-primary"],
				"default-font": designTokens.light.semanticColors["default-font"],
				"subtext-color": designTokens.light.semanticColors["subtext-color"],
				"neutral-border": designTokens.light.semanticColors["neutral-border"],
				white: designTokens.light.semanticColors.white,
				black: designTokens.dark.semanticColors.black,
				"default-background": designTokens.light.semanticColors["default-background"],
			},
			fontSize: designTokens.fontSize,
			fontFamily: designTokens.fontFamily,
			boxShadow: designTokens.boxShadow,
			borderRadius: designTokens.borderRadius,
			container: {
				padding: {
					DEFAULT: "16px",
					sm: "calc((100vw + 16px - 640px) / 2)",
					md: "calc((100vw + 16px - 768px) / 2)",
					lg: "calc((100vw + 16px - 1024px) / 2)",
					xl: "calc((100vw + 16px - 1280px) / 2)",
					"2xl": "calc((100vw + 16px - 1536px) / 2)",
				},
			},
			spacing: designTokens.spacing,
			screens: {
				mobile: {
					max: "767px",
				},
			},
		},
	},
	plugins: [],
};
