// eslint.mjs
import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import astroPlugin from "eslint-plugin-astro";
import astroParser from "astro-eslint-parser";
import globals from "globals";

/**
 * ESLint Flat Config (v9+)
 * Uses `globals` package instead of maintaining a globals list
 * - Splits TS configs:
 *    - Browser-ish TS: src/pages/**, src/components/**
 *    - Node/server TS: src/lib/** (including src/lib/api/**)
 */
export default [
	// Base recommended rules
	js.configs.recommended,

	// Global ignores (applied to all configs)
	{
		ignores: [
			"dist/**",
			"node_modules/**",
			".astro/**",
			"public/**",
			"*.config.mjs",
			"*.config.ts",
			"scripts/**",
			".netlify/**",
		],
	},

	/**
	 * TypeScript
	 * Browser (pages/components)
	 */
	{
		files: ["src/pages/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}"],
		languageOptions: {
			parser: tsparser,
			parserOptions: {
				ecmaVersion: "latest",
				sourceType: "module",
			},
			globals: {
				...globals.es2023,
				...globals.browser,
			},
		},
		plugins: {
			"@typescript-eslint": tseslint,
		},
		rules: {
			...tseslint.configs.recommended.rules,

			"no-undef": "off",

			"@typescript-eslint/no-unused-vars": [
				"error",
				{
					argsIgnorePattern: "^_",
					varsIgnorePattern: "^_",
					caughtErrorsIgnorePattern: "^_",
				},
			],
			"@typescript-eslint/no-explicit-any": "warn",
			"no-console": ["warn", { allow: ["warn", "error"] }],
			"prefer-const": "error",
			"no-var": "error",
		},
	},

	/**
	 * TypeScript
	 * Node/server
	 */
	{
		files: ["src/lib/**/*.{ts,tsx}"],
		languageOptions: {
			parser: tsparser,
			parserOptions: {
				ecmaVersion: "latest",
				sourceType: "module",
			},
			globals: {
				...globals.es2023,
				...globals.node,
			},
		},
		plugins: {
			"@typescript-eslint": tseslint,
		},
		rules: {
			...tseslint.configs.recommended.rules,

			"no-undef": "off",

			"@typescript-eslint/no-unused-vars": [
				"error",
				{
					argsIgnorePattern: "^_",
					varsIgnorePattern: "^_",
					caughtErrorsIgnorePattern: "^_",
				},
			],
			"@typescript-eslint/no-explicit-any": "warn",
			"no-console": ["warn", { allow: ["warn", "error"] }],
			"prefer-const": "error",
			"no-var": "error",
		},
	},

	/**
	 * TypeScript
	 * Everything else in src (fallback)
	 * Keeps linting consistent for other folders (e.g. src/data, src/utils)
	 */
	{
		files: ["src/**/*.{ts,tsx}"],
		ignores: ["src/pages/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}", "src/lib/**/*.{ts,tsx}"],
		languageOptions: {
			parser: tsparser,
			parserOptions: {
				ecmaVersion: "latest",
				sourceType: "module",
			},
			globals: {
				...globals.es2023,
				...globals.node,
				...globals.browser,
			},
		},
		plugins: {
			"@typescript-eslint": tseslint,
		},
		rules: {
			...tseslint.configs.recommended.rules,
			"no-undef": "off",

			"@typescript-eslint/no-unused-vars": [
				"error",
				{
					argsIgnorePattern: "^_",
					varsIgnorePattern: "^_",
					caughtErrorsIgnorePattern: "^_",
				},
			],
			"@typescript-eslint/no-explicit-any": "warn",
			"no-console": ["warn", { allow: ["warn", "error"] }],
			"prefer-const": "error",
			"no-var": "error",
		},
	},

	/**
	 * TypeScript
	 * Node scripts outside src (db/, scripts/, etc.)
	 */
	{
		files: ["db/**/*.{ts,tsx}", "scripts/**/*.{ts,tsx}", "*.{ts,tsx}"],
		languageOptions: {
			parser: tsparser,
			parserOptions: {
				ecmaVersion: "latest",
				sourceType: "module",
			},
			globals: {
				...globals.es2023,
				...globals.node,
			},
		},
		plugins: { "@typescript-eslint": tseslint },
		rules: {
			...tseslint.configs.recommended.rules,

			"no-undef": "off",

			"@typescript-eslint/no-unused-vars": [
				"error",
				{ argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
			],
			"@typescript-eslint/no-explicit-any": "warn",
			"no-console": ["warn", { allow: ["warn", "error"] }],
			"prefer-const": "error",
			"no-var": "error",
		},
	},

	/**
	 * Astro files configuration
	 */
	...astroPlugin.configs.recommended.map((config) => ({
		...config,
		files: ["**/*.astro"],
	})),
	{
		files: ["**/*.astro"],
		languageOptions: {
			parser: astroParser,
			parserOptions: {
				parser: tsparser,
				ecmaVersion: "latest",
				sourceType: "module",
				extraFileExtensions: [".astro"],
			},
			globals: {
				Astro: "readonly",
			},
		},
		rules: {
			"astro/no-set-html-directive": "error",
			"astro/no-unused-css-selector": "warn",
			// Disable rules that conflict with Astro
			"no-undef": "off",
		},
	},

	/**
	 * JavaScript/Module files configuration
	 */
	{
		files: ["**/*.js", "**/*.mjs"],
		languageOptions: {
			ecmaVersion: "latest",
			sourceType: "module",
			globals: {
				...globals.es2023,
				...globals.node,
			},
		},
		rules: {
			"no-console": ["warn", { allow: ["warn", "error"] }],
			"prefer-const": "error",
			"no-var": "error",
		},
	},

	/**
	 * Configuration and script files (less strict)
	 */
	{
		files: ["**/*.config.js", "**/*.config.mjs", "**/*.config.ts", "**/tailwind.config.mjs", "**/astro.config.mjs"],
		rules: {
			"no-console": "off",
			"@typescript-eslint/no-var-requires": "off",
		},
	},

	/**
	 * Console easter egg (intentional console.log usage)
	 */
	{
		files: ["src/scripts/consoleEgg.ts"],
		rules: {
			"no-console": "off",
		},
	},

	/**
	 * Astro environment types (allow triple-slash references)
	 */
	{
		files: ["**/env.d.ts"],
		rules: {
			"@typescript-eslint/triple-slash-reference": "off",
		},
	},

	/**
	 * Vitest test files.
	 * Inject test globals (describe, it, expect, vi)
	 */
	{
		files: ["**/*.test.{ts,js}", "**/*.spec.{ts,js}", "**/__tests__/**/*.{ts,js}"],
		languageOptions: {
			globals: {
				...globals.node,
				describe: "readonly",
				it: "readonly",
				expect: "readonly",
				vi: "readonly",
				beforeEach: "readonly",
				afterEach: "readonly",
				beforeAll: "readonly",
				afterAll: "readonly",
			},
		},
		rules: {
			"no-console": "off",
		},
	},
];
