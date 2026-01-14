import designTokens from "./src/config/design-tokens.mjs";
/** @type {import('tailwindcss').Config} */
export default {
	darkMode: ["class", '[data-theme="dark"]'],
	content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
	theme: {
		extend: {
			colors: {
				light: designTokens.light,
				dark: designTokens.dark,
				base: {
					100: "var(--color-base-100)",
					200: "var(--color-base-200)",
					300: "var(--color-base-300)",
					content: "var(--color-base-content)",
				},
				primary: {
					DEFAULT: "var(--color-primary)",
					content: "var(--color-primary-content)",
				},
				secondary: {
					DEFAULT: "var(--color-secondary)",
					content: "var(--color-secondary-content)",
				},
				accent: {
					DEFAULT: "var(--color-accent)",
					content: "var(--color-accent-content)",
				},
				neutral: {
					DEFAULT: "var(--color-neutral)",
					content: "var(--color-neutral-content)",
				},
				info: {
					DEFAULT: "var(--color-info)",
					content: "var(--color-info-content)",
				},
				success: {
					DEFAULT: "var(--color-success)",
					content: "var(--color-success-content)",
				},
				warning: {
					DEFAULT: "var(--color-warning)",
					content: "var(--color-warning-content)",
				},
				error: {
					DEFAULT: "var(--color-error)",
					content: "var(--color-error-content)",
				},
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
