import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright runs against the built site in dist/, served statically. Run
 * `npm run build` first. SSR routes (/guestbook, /admin, /api) are not in
 * dist/, so nothing here can reach the production database or email.
 *
 * Projects:
 *   site - post-build checks over every built page (npm run check:site)
 *   e2e  - user journeys and axe accessibility checks (npm run test:e2e)
 *
 * channel "chrome" drives the installed Google Chrome: Playwright no longer
 * ships its own Chromium for macOS 13.
 */
const PORT = 4410;

export default defineConfig({
	testDir: "e2e",
	fullyParallel: true,
	forbidOnly: true,
	reporter: "list",
	use: {
		baseURL: `http://127.0.0.1:${PORT}`,
		...devices["Desktop Chrome"],
		channel: "chrome",
		// The PWA worker precaches the whole site in every fresh context.
		serviceWorkers: "block",
	},
	projects: [
		// Checks the built markup as served; content must read right without JS.
		{ name: "site", testMatch: "site/**/*.site.ts", use: { javaScriptEnabled: false } },
		{ name: "e2e", testMatch: "**/*.e2e.ts" },
	],
	webServer: {
		command: `npx serve dist --listen ${PORT} --no-clipboard --no-request-logging`,
		url: `http://127.0.0.1:${PORT}/`,
		reuseExistingServer: false,
	},
});
