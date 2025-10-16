import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import tailwind from "@astrojs/tailwind";
import mdx from "@astrojs/mdx";
import pagefind from "astro-pagefind";
import markdownConfig from "./markdown.config";

// https://astro.build/config
export default defineConfig({
	site: "https://alexmbugua.me/",
	build: {
		assets: "astro",
		inlineStylesheets: "auto", // Optimize CSS delivery
	},
	integrations: [
		tailwind({
			applyBaseStyles: true,
			nesting: true, // Enable CSS nesting
		}),
		sitemap({
			filter: (page) => !page.includes("/404") && !page.includes("/success"),
			changefreq: "weekly",
			priority: 0.7,
			lastmod: new Date(),
		}),
		mdx(),
		pagefind(),
	],
	markdown: markdownConfig,
	vite: {
		build: {
			cssMinify: "lightningcss", // Faster CSS minification
		},
	},
	experimental: {
		contentIntellisense: true, // Better IDE support
	},
});
