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
				theme_color: "rgb(28, 25, 23)",
				background_color: "rgb(28, 25, 23)",
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
					// Mobile screenshots
					// Narrow form factor
					// Maximum 5
					{
						src: "/screenshots/mobile/home.png",
						sizes: "1242x2688",
						type: "image/png",
						form_factor: "narrow",
						label: "Home - Alex Mbugua's Portfolio",
					},
					{
						src: "/screenshots/mobile/blog.png",
						sizes: "1242x2688",
						type: "image/png",
						form_factor: "narrow",
						label: "Blog - Technical articles and thoughts",
					},
					{
						src: "/screenshots/mobile/now.png",
						sizes: "1242x2688",
						type: "image/png",
						form_factor: "narrow",
						label: "Now - What I'm currently working on",
					},
					{
						src: "/screenshots/mobile/8biticon.png",
						sizes: "1242x2688",
						type: "image/png",
						form_factor: "narrow",
						label: "8bit Avatar Generator - Create pixel art avatars",
					},
					{
						src: "/screenshots/mobile/guestbook.png",
						sizes: "1242x2688",
						type: "image/png",
						form_factor: "narrow",
						label: "Guestbook - Leave a message",
					},

					// Desktop screenshots
					// Wide form factor
					// Maximum 8
					{
						src: "/screenshots/desktop/home.png",
						sizes: "1280x720",
						type: "image/png",
						form_factor: "wide",
						label: "Home - Desktop View",
					},
					{
						src: "/screenshots/desktop/now.png",
						sizes: "1280x720",
						type: "image/png",
						form_factor: "wide",
						label: "Now - Desktop View",
					},
					{
						src: "/screenshots/desktop/guestbook.png",
						sizes: "1280x720",
						type: "image/png",
						form_factor: "wide",
						label: "Guestbook - Desktop View",
					},
					{
						src: "/screenshots/desktop/8biticon.png",
						sizes: "1280x720",
						type: "image/png",
						form_factor: "wide",
						label: "8bit Avatar Generator - Desktop View",
					},
					{
						src: "/screenshots/desktop/blog.png",
						sizes: "1280x720",
						type: "image/png",
						form_factor: "wide",
						label: "Blog - Desktop View",
					},
					{
						src: "/screenshots/desktop/blog-2025-10-05-the-beauty-of-being-realigned.png",
						sizes: "1280x720",
						type: "image/png",
						form_factor: "wide",
						label: "Blog Post - Desktop View",
					},
					{
						src: "/screenshots/desktop/search.png",
						sizes: "1280x720",
						type: "image/png",
						form_factor: "wide",
						label: "Search - Desktop View",
					},
					{
						src: "/screenshots/desktop/projects.png",
						sizes: "1280x720",
						type: "image/png",
						form_factor: "wide",
						label: "Projects - Desktop View",
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
					/\.pdf$/, // Don't intercept PDF files
					/^\/rss$/, // Allow /rss → /rss.xml redirect
					/^\/feed$/, // Allow /feed → /rss.xml redirect
					/^\/atom\.xml$/, // Allow /atom.xml → /rss.xml redirect
					/^\/sitemap$/, // Allow /sitemap → /sitemap-index.xml redirect
					/^\/resume$/, // Allow /resume → /blog/2025-06-19-resume/ redirect
					/^\/blog\/\d{4}\/\d{2}\/\d{2}\//, // Allow legacy blog patterns /blog/YYYY/MM/DD/slug
					/^\/search/, // Allow search page with or without query parameters
					/^\/8biticon/, // Allow avatar generator with or without query parameters
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
					// GitHub OpenGraph images for project cards
					{
						urlPattern: /^https:\/\/opengraph\.githubassets\.com\/.*/i,
						handler: "CacheFirst",
						options: {
							cacheName: "github-og-images-cache",
							expiration: {
								maxEntries: 1000,
								maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
							},
							cacheableResponse: {
								statuses: [0, 200],
							},
						},
					},
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
								maxEntries: 1000,
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
								maxEntries: 1000,
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
