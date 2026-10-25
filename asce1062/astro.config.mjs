import { defineConfig } from "astro/config";
import netlify from "@astrojs/netlify";
import sitemap from "@astrojs/sitemap";
import mdx from "@astrojs/mdx";
import pagefind from "astro-pagefind";
import markdownConfig from "./markdown.config";
import { createPwaIntegration } from "./src/integrations/pwa";
import { readdir, copyFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const isProduction = process.env.NODE_ENV === "production" || process.env.NETLIFY === "true";

// https://astro.build/config
export default defineConfig({
	site: "https://alexmbugua.me/",
	...(isProduction && { adapter: netlify({ imageCDN: false }) }),
	build: {
		assets: "astro",
		inlineStylesheets: "auto", // Optimize CSS delivery
	},
	integrations: [
		sitemap({
			// Utility, noindex and admin pages stay out of the sitemap (they also carry noindex).
			filter: (page) => !/^\/(404|success|search|offline|meta|admin|\.well-known)(\/|$)/.test(new URL(page).pathname),
			changefreq: "weekly",
			priority: 0.7,
			lastmod: new Date(),
		}),
		mdx(),
		pagefind(),
		createPwaIntegration({
			mode: "production",
			base: "/",
			scope: "/",
			includeAssets: ["favicon.ico"],
			registerType: "autoUpdate",
			manifest: {
				name: "Alex Mbugua - Leader, Mentor, Engineer, Chip Musician",
				short_name: "Alex Mbugua",
				description: "Building secure, performant, scalable solutions in the cloud",
				theme_color: "#09090b",
				background_color: "#09090b",
				display: "standalone",
				start_url: "/",
				icons: [
					{
						src: "/icons/pwa-192x192.png",
						sizes: "192x192",
						type: "image/png",
					},
					{
						src: "/icons/pwa-512x512.png",
						sizes: "512x512",
						type: "image/png",
					},
					{
						src: "/icons/pwa-maskable-512x512.png",
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

				// Strip known query params before precache lookup so URLs like
				// /?theme=dark resolve to the cached / instead of falling back to /offline.
				// Netlify appends ?dpl=<deploy-id> to some transformed asset URLs.
				ignoreURLParametersMatching: [/^theme$/, /^dpl$/, /^utm_\w+/i, /^fbclid$/i, /^ref$/i],

				// Offline fallback lives in runtimeCaching (navigation route), not
				// navigateFallback. navigateFallback is an app-shell setting: it answers
				// every non-precached navigation with the offline page even when online,
				// which broke slashless URLs (/about), redirects (/sps) and SSR routes.
				// Must be null, not omitted: vite-plugin-pwa defaults it to "index.html".
				navigateFallback: null,

				// Precaching configuration
				// Explicitly set globDirectory to dist/ so Workbox scans the correct
				// directory on Netlify SSR builds. @astrojs/netlify v7 sets
				// config.build.client to .netlify/build/ (the SSR function dir), which
				// vite-plugin-pwa would otherwise use — producing "no files matched"
				// warnings and an empty precache manifest.
				globDirectory: fileURLToPath(new URL("dist/", import.meta.url)),
				// Precache the app shell only. Images (~74 MiB of originals and posts)
				// and the manifest screenshots are runtime-cached on demand below.
				globPatterns: [
					"astro/**/*.{js,css}",
					// Only the formats browsers use; legacy ttf/eot/svg fallbacks are never fetched
					"**/fonts/**/*.{woff2,woff}",
					"icons/favicon-*.png", // favicon.ico and the PWA icons come from includeAssets
					// Pages that work offline from the first visit; others are cached as visited
					"{index,about/index,hello/index,now/index,offline/index}.html",
				],
				globIgnores: [
					"**/fonts/icomoon/**", // Requested with a ?<token> query, so runtime-cached instead
					// Nerd Font icons (~880 KiB): fetched via unicode-range only when a page needs them
					"**/fonts/0xProto/0xProto-Icons.woff2",
				],
				maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB limit
				runtimeCaching: [
					// Navigations not in the precache go to the network; the offline page is
					// served only when the network fails. These two must stay first so they
					// win over the asset routes.
					// Admin, guestbook and search are never cached (private or always-live).
					{
						urlPattern: ({ request, url }) =>
							request.mode === "navigate" && /^\/(admin|guestbook|search)(\/|$)/.test(url.pathname),
						handler: "NetworkOnly",
						options: {
							precacheFallback: { fallbackURL: "/offline/index.html" },
						},
					},
					// Every other page is cached as it is read, so visited pages work offline.
					// Only plain 200s are stored: redirects (/sps, slashless URLs) come back as
					// opaque redirects (status 0) and must not be replayed from the cache.
					{
						urlPattern: ({ request }) => request.mode === "navigate",
						handler: "NetworkFirst",
						options: {
							cacheName: "pages-cache",
							// A stalled connection falls back to the cached copy instead of hanging.
							networkTimeoutSeconds: 3,
							expiration: {
								maxEntries: 50,
								maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
							},
							cacheableResponse: { statuses: [200] },
							precacheFallback: { fallbackURL: "/offline/index.html" },
						},
					},
					// API routes. Never cache, always hit the network
					{
						urlPattern: ({ url }) => url.pathname.startsWith("/api/"),
						handler: "NetworkOnly",
					},
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
					// Local fonts, plus the icomoon stylesheet (versioned by its ?<token> query)
					{
						urlPattern: /\/fonts\/.*\.(ttf|woff|woff2|eot|otf|svg|css)(\?.*)?$/i,
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
						urlPattern: /\/8bit\/img\/.*\.png(\?.*)?$/i,
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
						urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)(\?.*)?$/i,
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
		// @astrojs/netlify sets config.build.client to .netlify/build/ (its SSR build
		// directory) rather than dist/. The PWA plugin picks that up as both the glob
		// source and the output directory, so sw.js ends up in .netlify/build/ and not in
		// dist/ where Netlify serves static files.
		//
		// This integration runs after PWA generation in astro:build:done and copies
		// sw.js + workbox-*.js from .netlify/build/ to dist/. If the source doesn't
		// exist (e.g. local static builds where vite-plugin-pwa writes directly to
		// dist/) it exits silently.
		{
			name: "pwa-sw-copy-to-dist",
			hooks: {
				"astro:build:done": async ({ dir, logger }) => {
					// dir = file:///…/dist/  →  ../.netlify/build/ is the PWA output
					const buildDir = new URL("../.netlify/build/", dir);
					try {
						const files = await readdir(fileURLToPath(buildDir));
						const swFiles = files.filter((f) => f === "sw.js" || /^workbox-.+\.js$/.test(f));
						if (swFiles.length === 0) return;
						await Promise.all(
							swFiles.map((f) => copyFile(fileURLToPath(new URL(f, buildDir)), fileURLToPath(new URL(f, dir))))
						);
						logger.info(`Copied ${swFiles.join(", ")} from .netlify/build/ to dist/`);
					} catch {
						// .netlify/build/ absent on local static builds — public/sw.js
						// placeholder already covers dist/sw.js in that case.
					}
				},
			},
		},
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
