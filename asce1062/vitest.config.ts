import { configDefaults, defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		// Playwright owns e2e/; its specs are not Vitest tests.
		exclude: [...configDefaults.exclude, "e2e/**"],
		coverage: {
			provider: "v8",
			include: ["src/**/*.{ts,js,mjs}", "scripts/**/*.mjs"],
			exclude: ["**/__tests__/**", "**/*.d.ts"],
			reporter: ["text-summary", "html"],
			/**
			 * Floors sit just under the coverage measured when they were set
			 * (2026-10-26), so a drop fails `npm run test:coverage`. Raise them as
			 * coverage grows; never lower them to make a run pass.
			 *
			 * The global floor is low because browser UI controllers (terminal
			 * modal, music player, nav brand) are exercised by the e2e suite, not
			 * unit tests. The logic layers carry their own, stricter floors.
			 */
			thresholds: {
				statements: 42,
				branches: 41,
				functions: 45,
				lines: 43,
				"src/lib/api/**": { statements: 84, branches: 76, functions: 81, lines: 85 },
				"src/lib/db/**": { statements: 95, branches: 71, functions: 83, lines: 97 },
				"src/lib/textEffects/**": { statements: 89, branches: 78, functions: 89, lines: 93 },
			},
		},
	},
	resolve: {
		alias: {
			"@": path.resolve(import.meta.dirname, "./src"),
		},
	},
});
