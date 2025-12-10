/**
 * Reusable code formatting utility using rehype-pretty-code
 * Based on: https://rehype-pretty.pages.dev/
 *
 * @example
 * ```ts
 * // Format a code block
 * const html = await formatCode('const x = 1;', { lang: 'typescript' });
 *
 * // Format with line numbers and highlighting
 * const html = await formatCode(code, {
 *   lang: 'js',
 *   showLineNumbers: true,
 *   highlightLines: [1, 2, 3],
 * });
 *
 * // Format inline code
 * const html = await formatInlineCode('useState(0)', { lang: 'js' });
 * ```
 */

import { unified } from "unified";
import rehypeParse from "rehype-parse";
import rehypeStringify from "rehype-stringify";
import rehypePrettyCode from "rehype-pretty-code";
import { transformerCopyButton } from "@rehype-pretty/transformers";
import type { Options as RehypePrettyCodeOptions, Theme } from "rehype-pretty-code";
import type { ShikiTransformer } from "shiki";
import type { Element as HastElement } from "hast";

// Import themes from config
import lightTheme from "@/theme/rosepine-dawn.json";
import darkTheme from "@/theme/rosepine-dark.json";

/**
 * Code formatting options
 */
export interface CodeFormatOptions {
	/**
	 * Language for syntax highlighting (e.g., 'js', 'typescript', 'json')
	 * @default 'plaintext'
	 */
	lang?: string;

	/**
	 * Theme to use for highlighting
	 * - 'auto': Use both light and dark themes with CSS variables
	 * - 'light': Use only light theme
	 * - 'dark': Use only dark theme
	 * - Custom theme object
	 * @default 'auto'
	 */
	theme?: "auto" | "light" | "dark" | Theme | Record<string, Theme>;

	/**
	 * Keep the background color from the theme
	 * @default true
	 */
	keepBackground?: boolean;

	/**
	 * Show line numbers
	 * @default false
	 */
	showLineNumbers?: boolean;

	/**
	 * Line numbers to highlight (1-indexed)
	 * @example [1, 2, 3] or [[1, 3], [5, 7]]
	 */
	highlightLines?: number[] | [number, number][];

	/**
	 * Highlighted line IDs for custom styling
	 * @example { a: [1, 2], b: [3, 4] }
	 */
	highlightLineIds?: Record<string, number[]>;

	/**
	 * Characters to highlight with optional IDs
	 * @example ['/carrot/', '/apple/'] or { v: '/age/', s: '/setAge/' }
	 */
	highlightChars?: string[] | Record<string, string>;

	/**
	 * Code block title
	 */
	title?: string;

	/**
	 * Code block caption
	 */
	caption?: string;

	/**
	 * Show copy button
	 * @default true
	 */
	showCopyButton?: boolean;

	/**
	 * Copy button feedback duration in milliseconds
	 * @default 2500
	 */
	copyButtonDuration?: number;

	/**
	 * Additional Shiki transformers
	 */
	transformers?: ShikiTransformer[];

	/**
	 * Custom tokens map for inline code highlighting
	 * @example { fn: 'entity.name.function' }
	 */
	tokensMap?: Record<string, string>;

	/**
	 * Disable grid layout (for full-width line highlighting)
	 * @default false
	 */
	disableGrid?: boolean;

	/**
	 * Default language for unspecified code
	 */
	defaultLang?: string | { block?: string; inline?: string };

	/**
	 * Custom visitor hooks
	 */
	onVisitLine?: (element: HastElement) => void;
	onVisitHighlightedLine?: (element: HastElement) => void;
	onVisitHighlightedChars?: (element: HastElement, id?: string) => void;
	onVisitTitle?: (element: HastElement) => void;
	onVisitCaption?: (element: HastElement) => void;
}

/**
 * Get theme configuration based on options
 */
function getThemeConfig(themeOption: CodeFormatOptions["theme"] = "auto") {
	if (themeOption === "auto") {
		// Use both themes with CSS variables for auto dark/light mode
		return {
			dark: darkTheme,
			light: lightTheme,
		};
	}

	if (themeOption === "light") {
		return lightTheme;
	}

	if (themeOption === "dark") {
		return darkTheme;
	}

	// Custom theme
	return themeOption;
}

/**
 * Build meta string from options
 */
function buildMetaString(options: CodeFormatOptions): string {
	const meta: string[] = [];

	// Line numbers
	if (options.showLineNumbers) {
		meta.push("showLineNumbers");
	}

	// Highlight lines
	if (options.highlightLines) {
		const lines = options.highlightLines
			.map((line) => {
				if (Array.isArray(line)) {
					return `${line[0]}-${line[1]}`;
				}
				return String(line);
			})
			.join(",");
		meta.push(`{${lines}}`);
	}

	// Highlight line IDs
	if (options.highlightLineIds) {
		Object.entries(options.highlightLineIds).forEach(([id, lines]) => {
			const lineStr = lines.join(",");
			meta.push(`{${lineStr}}#${id}`);
		});
	}

	// Highlight chars
	if (options.highlightChars) {
		if (Array.isArray(options.highlightChars)) {
			options.highlightChars.forEach((char) => {
				meta.push(char);
			});
		} else {
			Object.entries(options.highlightChars).forEach(([id, char]) => {
				meta.push(`${char}#${id}`);
			});
		}
	}

	// Title
	if (options.title) {
		meta.push(`title="${options.title}"`);
	}

	// Caption
	if (options.caption) {
		meta.push(`caption="${options.caption}"`);
	}

	return meta.join(" ");
}

/**
 * Format code with syntax highlighting
 *
 * @param code - The code string to format
 * @param options - Formatting options
 * @returns HTML string with syntax highlighting
 *
 * @example
 * ```ts
 * const html = await formatCode('const x = 1;', { lang: 'typescript' });
 * ```
 */
export async function formatCode(code: string, options: CodeFormatOptions = {}): Promise<string> {
	const lang = options.lang || options.defaultLang || "plaintext";
	const metaString = buildMetaString(options);

	// Build transformers array
	const transformers: ShikiTransformer[] = [...(options.transformers || [])];

	// Add copy button transformer if enabled
	if (options.showCopyButton !== false) {
		transformers.push(
			transformerCopyButton({
				visibility: "always",
				feedbackDuration: options.copyButtonDuration || 2500,
			})
		);
	}

	// Build rehype-pretty-code options
	const rehypeOptions: RehypePrettyCodeOptions = {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		theme: getThemeConfig(options.theme) as any,
		keepBackground: options.keepBackground ?? true,
		grid: !options.disableGrid,
		defaultLang: options.defaultLang,
		tokensMap: options.tokensMap,
		transformers,
		onVisitLine: options.onVisitLine,
		onVisitHighlightedLine: options.onVisitHighlightedLine,
		onVisitHighlightedChars: options.onVisitHighlightedChars,
		onVisitTitle: options.onVisitTitle,
		onVisitCaption: options.onVisitCaption,
	};

	// Create code block HTML
	const codeBlock = `<pre><code class="language-${lang}"${metaString ? ` data-meta="${metaString}"` : ""}>${escapeHtml(code)}</code></pre>`;

	// Process with unified pipeline
	const file = await unified()
		.use(rehypeParse, { fragment: true })
		.use(rehypePrettyCode, rehypeOptions)
		.use(rehypeStringify)
		.process(codeBlock);

	return String(file);
}

/**
 * Format inline code with syntax highlighting
 *
 * @param code - The inline code string to format
 * @param options - Formatting options (limited compared to block code)
 * @returns HTML string with syntax highlighting
 *
 * @example
 * ```ts
 * const html = await formatInlineCode('useState(0)', { lang: 'js' });
 * const html = await formatInlineCode('getStringLength', { token: 'entity.name.function' });
 * ```
 */
export async function formatInlineCode(
	code: string,
	options: {
		lang?: string;
		token?: string;
		theme?: CodeFormatOptions["theme"];
		tokensMap?: Record<string, string>;
	} = {}
): Promise<string> {
	const suffix = options.token ? `{:.${options.token}}` : options.lang ? `{:${options.lang}}` : "";

	// Build rehype-pretty-code options
	const rehypeOptions: RehypePrettyCodeOptions = {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		theme: getThemeConfig(options.theme) as any,
		keepBackground: true,
		tokensMap: options.tokensMap,
	};

	// Process with unified pipeline
	const file = await unified()
		.use(rehypeParse, { fragment: true })
		.use(rehypePrettyCode, rehypeOptions)
		.use(rehypeStringify)
		.process(`<code>${escapeHtml(code)}${suffix}</code>`);

	return String(file);
}

/**
 * Format JSON data with syntax highlighting
 *
 * @param data - The data to format as JSON
 * @param options - Formatting options
 * @returns HTML string with syntax highlighting
 *
 * @example
 * ```ts
 * const html = await formatJSON({ name: 'John', age: 30 }, { showLineNumbers: true });
 * ```
 */
export async function formatJSON(data: unknown, options: Omit<CodeFormatOptions, "lang"> = {}): Promise<string> {
	const jsonString = JSON.stringify(data, null, 2);
	return formatCode(jsonString, { ...options, lang: "json" });
}

/**
 * Escape HTML special characters
 */
function escapeHtml(str: string): string {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

/**
 * Preset configurations for common use cases
 */
export const presets = {
	/**
	 * Default preset with copy button and auto theme
	 */
	default: {
		theme: "auto" as const,
		keepBackground: true,
		showCopyButton: true,
	},

	/**
	 * Minimal preset without copy button
	 */
	minimal: {
		theme: "auto" as const,
		keepBackground: false,
		showCopyButton: false,
	},

	/**
	 * Documentation preset with line numbers
	 */
	docs: {
		theme: "auto" as const,
		keepBackground: true,
		showCopyButton: true,
		showLineNumbers: true,
	},

	/**
	 * Inline code preset
	 */
	inline: {
		theme: "auto" as const,
		keepBackground: false,
	},
} satisfies Record<string, Partial<CodeFormatOptions>>;
