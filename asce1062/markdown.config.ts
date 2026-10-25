import rehypePrettyCode from "rehype-pretty-code";
import rehypeExternalLinks from "rehype-external-links";
import { unified } from "@astrojs/markdown-remark";
import { rehypeAccessibleEmojis } from "rehype-accessible-emojis";
import rehypeSlug from "rehype-slug";
import extractToc from "@stefanprobst/rehype-extract-toc";
import withTocExport from "@stefanprobst/rehype-extract-toc/mdx";
import getReadingTime from "reading-time";
import { toString } from "mdast-util-to-string";
import type { Options as RehypePrettyCodeOptions } from "rehype-pretty-code";
import type { AstroUserConfig } from "astro";
import { transformerCopyButton } from "@rehype-pretty/transformers";
import { bundledThemes } from "shiki/themes";
import type { ThemeRegistrationRaw } from "shiki";

type RehypePluginEntry = NonNullable<NonNullable<Parameters<typeof unified>[0]>["rehypePlugins"]>[number];

/**
 * Custom remark plugin that calculates reading time and word count.
 * Writes directly to Astro's frontmatter.
 * @see https://docs.astro.build/en/recipes/reading-time/
 */
function remarkReadingTime() {
	return function (tree: unknown, file: { data: Record<string, unknown> }) {
		// Astro places the page frontmatter on file.data.astro before remark plugins run.
		const astro = file.data.astro as { frontmatter: Record<string, unknown> };
		astro.frontmatter.readingTime = getReadingTime(toString(tree));
	};
}

/**
 * Rose Pine token colors that fall below WCAG AA (4.5:1) on their own code
 * background, replaced by the same hue and chroma at the nearest OKLCH
 * lightness that reaches ~4.6:1. Dawn is low-contrast by design: 7 of its 9
 * token colors failed, its gold at 2.05:1.
 */
const AA_TOKEN_COLORS: Record<"rose-pine" | "rose-pine-dawn", Record<string, string>> = {
	"rose-pine": {
		"#31748f": "#488aa6", // 3.38 -> 4.60
		"#6e6a86": "#837f9c", // 3.42 -> 4.61
	},
	"rose-pine-dawn": {
		"#797593": "#6f6b89", // 4.02 -> 4.64
		"#ea9d34": "#9c6203", // 2.05 -> 4.61
		"#d7827e": "#a85855", // 2.60 -> 4.61
		"#56949f": "#397882", // 3.14 -> 4.61
		"#907aa9": "#7b6693", // 3.47 -> 4.63
		"#9893a5": "#716d7e", // 2.73 -> 4.61
		"#b4637a": "#a6566d", // 3.84 -> 4.61
	},
};

export async function loadAccessibleTheme(name: keyof typeof AA_TOKEN_COLORS): Promise<ThemeRegistrationRaw> {
	const { tokenColors = [], ...theme } = (await bundledThemes[name]()).default;
	const replacements = AA_TOKEN_COLORS[name];
	// Shiki reads token rules from `settings` or `tokenColors`; the raw type requires `settings`.
	const settings = tokenColors.map((token) => {
		const foreground = token.settings.foreground?.toLowerCase();
		const replacement = foreground ? replacements[foreground] : undefined;
		return replacement ? { ...token, settings: { ...token.settings, foreground: replacement } } : token;
	});
	return { ...theme, settings };
}

/**
 * Rehype Pretty Code configuration
 * @see https://rehype-pretty.pages.dev/
 */
const prettyCodeOptions: RehypePrettyCodeOptions = {
	theme: {
		dark: await loadAccessibleTheme("rose-pine"),
		light: await loadAccessibleTheme("rose-pine-dawn"),
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
	processor: unified({
		remarkPlugins: [
			remarkReadingTime, // Calculates readingTime (text, minutes, time, words)
		],
		rehypePlugins: [
			rehypeSlug, // Add id attrs to headings (must run before extractToc)
			// The next three plugins type their transformer as Node -> Node, which does not
			// satisfy Astro's Root -> Root plugin signature; they work at runtime, so cast to
			// the config's own plugin entry type.
			extractToc as RehypePluginEntry, // Attach TOC to vfile.data.toc (reads ids set by rehypeSlug)
			[withTocExport, { name: "tableOfContents" }] as RehypePluginEntry, // Export TOC as named export for MDX
			rehypeAccessibleEmojis as RehypePluginEntry,
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
	}),
};

export default markdownConfig;
