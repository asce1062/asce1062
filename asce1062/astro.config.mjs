import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import tailwind from "@astrojs/tailwind";
import mdx from "@astrojs/mdx";
import pagefind from "astro-pagefind";
import markdownConfig from "./markdown.config";
import AstroPWA from "@vite-pwa/astro";

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
		AstroPWA({
			mode: "production",
			base: "/",
			scope: "/",
			includeAssets: ["favicon.ico"],
			registerType: "autoUpdate",
			manifest: {
				name: "Alex Mbugua - Leader, Mentor, Engineer, Chip Musician",
				short_name: "Alex Mbugua",
				description: "Building secure, performant, scalable solutions in the cloud",
				theme_color: "#120f19",
				background_color: "#120f19",
				display: "standalone",
				start_url: "/",
				icons: [
					{
						src: "/pwa-192x192.png",
						sizes: "192x192",
						type: "image/png",
					},
					{
						src: "/pwa-512x512.png",
						sizes: "512x512",
						type: "image/png",
					},
					{
						src: "/pwa-maskable-512x512.png",
						sizes: "512x512",
						type: "image/png",
						purpose: "maskable",
					},
				],
				screenshots: [
					{
						src: "/screenshots/alexmbugua.me-desktop-1920x1590.png",
						sizes: "1920x1590",
						type: "image/png",
						form_factor: "wide",
						label: "Alex Mbugua's space on the internet - Desktop View",
					},
					{
						src: "/screenshots/alexmbugua.me-mobile-1440x3040.png",
						sizes: "1440x3040",
						type: "image/png",
						form_factor: "narrow",
						label: "Alex Mbugua's space on the internet - Mobile View",
					},
				],
			},
			workbox: {
				// SW lifecycle
				cleanupOutdatedCaches: true,
				clientsClaim: true,
				skipWaiting: true,

				// Offline fallback
				navigateFallback: "/offline",
				navigateFallbackDenylist: [
					/\.xml$/, // Don't intercept XML files (RSS, sitemap)
					/^\/rss$/, // Allow /rss → /rss.xml redirect
					/^\/feed$/, // Allow /feed → /rss.xml redirect
					/^\/atom\.xml$/, // Allow /atom.xml → /rss.xml redirect
					/^\/sitemap$/, // Allow /sitemap → /sitemap-index.xml redirect
					/^\/resume$/, // Allow /resume → /blog/2025-06-19-resume/ redirect
					/^\/blog\/\d{4}\/\d{2}\/\d{2}\//, // Allow legacy blog patterns /blog/YYYY/MM/DD/slug
					/^\/search(\?.*)?$/, // Allow search page with query parameters
					/^\/8biticon(\?.*)?$/, // Allow avatar generator with query parameters
				],

				// Precaching configuration
				globPatterns: [
					"**/*.{css,js,html,svg,png,ico,txt,xml,webp,jpg}",
					"**/fonts/**/*.{woff2,ttf,eot,woff}", // Include fonts in precache
				],
				globIgnores: [
					"**/fonts/icomoon/**", // Exclude icomoon backup directory
					"**/8bit/img/**", // Large avatar assets - cache at runtime
				],
				maximumFileSizeToCacheInBytes: 3 * 1024 * 1024, // 3 MB limit
				runtimeCaching: [
					// Local fonts (all fonts except icomoon backup directory)
					{
						urlPattern: /\/fonts\/.*\.(ttf|woff|woff2|eot|otf|svg)(\?.*)?$/i,
						handler: "CacheFirst",
						options: {
							cacheName: "local-fonts-cache",
							expiration: {
								maxEntries: 30,
								maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
							},
							cacheableResponse: {
								statuses: [0, 200],
							},
						},
					},
					// External fonts (Google)
					{
						urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
						handler: "CacheFirst",
						options: {
							cacheName: "google-fonts-cache",
							expiration: {
								maxEntries: 10,
								maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
							},
							cacheableResponse: {
								statuses: [0, 200],
							},
						},
					},
					{
						urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
						handler: "CacheFirst",
						options: {
							cacheName: "gstatic-fonts-cache",
							expiration: {
								maxEntries: 10,
								maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
							},
							cacheableResponse: {
								statuses: [0, 200],
							},
						},
					},
					// 8bit avatar images (runtime cache due to large size)
					{
						urlPattern: /\/8bit\/img\/.*\.png$/i,
						handler: "CacheFirst",
						options: {
							cacheName: "avatar-assets-cache",
							expiration: {
								maxEntries: 500,
								maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
							},
							cacheableResponse: {
								statuses: [0, 200],
							},
						},
					},
					// Other images
					{
						urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
						handler: "CacheFirst",
						options: {
							cacheName: "image-cache",
							expiration: {
								maxEntries: 100,
								maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
							},
							cacheableResponse: {
								statuses: [0, 200],
							},
						},
					},
				],
			},
			devOptions: {
				enabled: true,
				navigateFallback: "/offline",
				type: "module",
			},
			experimental: {
				directoryAndTrailingSlashHandler: true,
			},
		}),
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
