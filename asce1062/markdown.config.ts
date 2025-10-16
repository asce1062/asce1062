import rehypePrettyCode from "rehype-pretty-code";
import { rehypeAccessibleEmojis } from "rehype-accessible-emojis";
import extractToc from "@stefanprobst/remark-extract-toc";
import withTocExport from "@stefanprobst/remark-extract-toc/mdx";
import remarkSlug from "remark-slug"; // DEPRECATED: Replace with rehypeSlug
import type { Options as RehypePrettyCodeOptions } from "rehype-pretty-code";
import type { AstroUserConfig } from "astro";

// Import syntax themes
import lightTheme from "./public/theme/rosepine-dawn.json";
import darkTheme from "./public/theme/rosepine-dark.json";
import { transformerCopyButton } from "@rehype-pretty/transformers";

/**
 * Rehype Pretty Code configuration
 * @see https://rehype-pretty.pages.dev/
 */
const prettyCodeOptions: RehypePrettyCodeOptions = {
	theme: {
		dark: darkTheme as any,
		light: lightTheme as any,
	},
	transformers: [
		transformerCopyButton({
			visibility: "always",
			feedbackDuration: 2_500,
		}),
	],
	keepBackground: true, // Use theme for backgrounds
	defaultLang: "plaintext",
	onVisitLine(node) {
		// Prevent empty lines from collapsing
		if (node.children.length === 0) {
			node.children = [{ type: "text", value: " " }];
		}
	},
	onVisitHighlightedLine(node) {
		node.properties.className = ["line--highlighted"];
	},
	onVisitHighlightedChars(node) {
		node.properties.className = ["word--highlighted"];
	},
};

const markdownConfig: AstroUserConfig["markdown"] = {
	syntaxHighlight: false, // Handled by rehype-pretty-code
	remarkPlugins: [
		remarkSlug as any, // TODO: Replace with rehype-slug (remark-slug is deprecated, has type conflicts)
		[extractToc, { maxDepth: 3 }], // Extract TOC data up to h3
		[withTocExport, { name: "tableOfContents" }], // Export TOC as named export for MDX
	],
	rehypePlugins: [rehypeAccessibleEmojis as any, [rehypePrettyCode, prettyCodeOptions]],
};

export default markdownConfig;
