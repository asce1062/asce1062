import rehypePrettyCode from "rehype-pretty-code";
import rehypeExternalLinks from "rehype-external-links";
import { rehypeAccessibleEmojis } from "rehype-accessible-emojis";
import rehypeSlug from "rehype-slug";
import extractToc from "@stefanprobst/rehype-extract-toc";
import withTocExport from "@stefanprobst/rehype-extract-toc/mdx";
import getReadingTime from "reading-time";
import { toString } from "mdast-util-to-string";
import type { Options as RehypePrettyCodeOptions } from "rehype-pretty-code";
import type { AstroUserConfig } from "astro";
import { transformerCopyButton } from "@rehype-pretty/transformers";

/**
 * Custom remark plugin that calculates reading time and word count.
 * Writes directly to Astro's frontmatter.
 * @see https://docs.astro.build/en/recipes/reading-time/
 */
function remarkReadingTime() {
	return function (tree: any, { data }: any) {
		const textOnPage = toString(tree);
		const readingTime = getReadingTime(textOnPage);
		data.astro.frontmatter.readingTime = readingTime;
	};
}

/**
 * Rehype Pretty Code configuration
 * @see https://rehype-pretty.pages.dev/
 */
const prettyCodeOptions: RehypePrettyCodeOptions = {
	theme: {
		dark: "rose-pine",
		light: "rose-pine-dawn",
	},
	transformers: [
		transformerCopyButton({
			visibility: "always",
			feedbackDuration: 2_500,
		}),
	],
	grid: true, // Enable grid for full-width line highlighting
	keepBackground: true, // Use theme for backgrounds
	defaultLang: "javascript",
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
		remarkReadingTime, // Calculates readingTime (text, minutes, time, words)
	],
	rehypePlugins: [
		rehypeSlug, // Add id attrs to headings — must run before extractToc
		extractToc, // Attach TOC to vfile.data.toc — reads ids set by rehypeSlug
		[withTocExport, { name: "tableOfContents" }], // Export TOC as named export for MDX
		// rehype-accessible-emojis types don't satisfy Astro's strict rehype plugin
		// signature cast required. Tracked upstream in the plugin's type declarations.
		rehypeAccessibleEmojis as any,
		[
			rehypeExternalLinks,
			{
				target: "_blank",
				rel: ["noopener", "noreferrer"],
				content: {
					type: "element",
					tagName: "i",
					properties: { className: ["icon-box-arrow-up-right"], ariaHidden: "true" },
					children: [],
				},
			},
		],
		[rehypePrettyCode, prettyCodeOptions],
	],
};

export default markdownConfig;
