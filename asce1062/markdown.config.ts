import rehypePrettyCode from "rehype-pretty-code";
import lightTheme from "./public/theme/rosepine-dawn.json";
import darkTheme from "./public/theme/rosepine-dark.json";
import { transformerCopyButton } from "@rehype-pretty/transformers";
import { rehypeAccessibleEmojis } from "rehype-accessible-emojis";
import extractToc from "@stefanprobst/remark-extract-toc";
import withTocExport from "@stefanprobst/remark-extract-toc/mdx";
import remarkSlug from "remark-slug";

const markdownConfig = {
  syntaxHighlight: false,
  remarkPlugins: [
    remarkSlug, // (remark-slug is deprecated)
    [extractToc, { maxDepth: 3 }], // Extract TOC data up to h3 i.e ###
    [withTocExport, { name: "tableOfContents" }], // Export TOC as named export for MDX. Defaults to `tableOfContents`
  ],
  rehypePlugins: [
    rehypeAccessibleEmojis,
    [
      // https://rehype-pretty.pages.dev/
      // https://github.com/rehype-pretty/rehype-pretty-code/tree/master/examples/astro
      rehypePrettyCode,
      {
        theme: {
          dark: darkTheme,
          light: lightTheme,
        },
        transformers: [
          transformerCopyButton({
            visibility: "always",
            feedbackDuration: 2_500,
          }),
        ],
      },
    ],
  ],
};

export default markdownConfig;
