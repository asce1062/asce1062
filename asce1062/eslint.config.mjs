import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import astroPlugin from "eslint-plugin-astro";
import astroParser from "astro-eslint-parser";

/**
 * ESLint Flat Config (v9+)
 * @see https://eslint.org/docs/latest/use/configure/configuration-files
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

	// TypeScript files configuration
	{
		files: ["**/*.ts", "**/*.tsx"],
		languageOptions: {
			parser: tsparser,
			parserOptions: {
				ecmaVersion: "latest",
				sourceType: "module",
			},
			globals: {
				// Node.js globals
				process: "readonly",
				console: "readonly",
				Buffer: "readonly",
				__dirname: "readonly",
				__filename: "readonly",
				// Browser DOM globals
				window: "readonly",
				document: "readonly",
				navigator: "readonly",
				fetch: "readonly",
				URL: "readonly",
				URLSearchParams: "readonly",
				Image: "readonly",
				// Browser types
				HTMLElement: "readonly",
				HTMLButtonElement: "readonly",
				HTMLCanvasElement: "readonly",
				HTMLDetailsElement: "readonly",
				HTMLInputElement: "readonly",
				HTMLIFrameElement: "readonly",
				HTMLImageElement: "readonly",
				HTMLLabelElement: "readonly",
				HTMLSelectElement: "readonly",
				Element: "readonly",
				Event: "readonly",
				KeyboardEvent: "readonly",
				MouseEvent: "readonly",
				CustomEvent: "readonly",
				NodeListOf: "readonly",
				CanvasRenderingContext2D: "readonly",
				// Browser Storage
				localStorage: "readonly",
				sessionStorage: "readonly",
				// Timers
				setTimeout: "readonly",
				clearTimeout: "readonly",
				setInterval: "readonly",
				clearInterval: "readonly",
				requestIdleCallback: "readonly",
				requestAnimationFrame: "readonly",
			},
		},
		plugins: {
			"@typescript-eslint": tseslint,
		},
		rules: {
			...tseslint.configs.recommended.rules,
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

	// Astro files configuration
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

	// JavaScript/Module files configuration
	{
		files: ["**/*.js", "**/*.mjs"],
		languageOptions: {
			ecmaVersion: "latest",
			sourceType: "module",
			globals: {
				process: "readonly",
				console: "readonly",
				Buffer: "readonly",
				__dirname: "readonly",
				__filename: "readonly",
			},
		},
		rules: {
			"no-console": ["warn", { allow: ["warn", "error"] }],
			"prefer-const": "error",
			"no-var": "error",
		},
	},

	// Configuration and script files (less strict)
	{
		files: ["**/*.config.js", "**/*.config.mjs", "**/*.config.ts", "**/tailwind.config.mjs", "**/astro.config.mjs"],
		rules: {
			"no-console": "off",
			"@typescript-eslint/no-var-requires": "off",
		},
	},

	// Astro environment types (allow triple-slash references)
	{
		files: ["**/env.d.ts"],
		rules: {
			"@typescript-eslint/triple-slash-reference": "off",
		},
	},
];
