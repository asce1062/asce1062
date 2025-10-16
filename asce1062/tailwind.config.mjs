import designTokens from "./src/config/design-tokens.mjs";
/** @type {import('tailwindcss').Config} */
export default {
	darkMode: ["class", '[data-theme="dark"]'],
	content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
	theme: {
		extend: {
			colors: {
				palette: designTokens.palette,
				light: designTokens.light,
			},
			fontFamily: {
				proto: ["0xProto", "monospace"],
				retro: ["uni0553", "monospace"],
			},
			spacing: {
				inline: "clamp(20px, 4vw, 80px)",
			},
		},
	},
	plugins: [],
};
