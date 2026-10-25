/**
 * Lighthouse CI: `npm run lighthouse` builds the site and audits the static
 * output in dist/ with Lighthouse's default mobile profile (simulated slow 4G,
 * 4x CPU throttle), taking the median of 3 runs per page.
 *
 * Targets for a personal site, not a 100 chase:
 *   performance >= 0.9, with Core Web Vitals inside Google's "good" range
 *   (LCP <= 2.5 s, TBT <= 200 ms, CLS <= 0.1); accessibility 100 (every
 *   failing audit is a real barrier); best practices >= 0.95; SEO 100.
 *
 * SSR routes (/guestbook, /admin) are not in dist/; audit them on a deploy
 * preview. Reports are written to .lighthouseci/ (gitignored), never uploaded.
 */
module.exports = {
	ci: {
		collect: {
			staticDistDir: "./dist",
			url: [
				"http://localhost/",
				"http://localhost/blog/",
				"http://localhost/blog/2026-05-19-password-security-with-argon2id/",
			],
			numberOfRuns: 3,
		},
		assert: {
			aggregationMethod: "median-run",
			assertions: {
				"categories:performance": ["error", { minScore: 0.9 }],
				"categories:accessibility": ["error", { minScore: 1 }],
				"categories:best-practices": ["error", { minScore: 0.95 }],
				"categories:seo": ["error", { minScore: 1 }],
				"largest-contentful-paint": ["error", { maxNumericValue: 2500 }],
				"total-blocking-time": ["error", { maxNumericValue: 200 }],
				"cumulative-layout-shift": ["error", { maxNumericValue: 0.1 }],
			},
		},
		upload: {
			target: "filesystem",
			outputDir: ".lighthouseci",
		},
	},
};
