import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import tailwind from "@astrojs/tailwind";
import mdx from "@astrojs/mdx";
import rehypePrettyCode from "rehype-pretty-code";
import lightTheme from "./public/theme/rosepine-dawn.json";
import darkTheme from "./public/theme/rosepine-dark.json";
import { transformerCopyButton } from "@rehype-pretty/transformers";

// https://astro.build/config
export default defineConfig({
  site: "https://alexmbugua.me/",
  //output: "server",
  build: {
    assets: "astro",
  },
  integrations: [
    tailwind({ applyBaseStyles: true }),
    sitemap({
      filter: (page) => page !== "https://alexmbugu.me/404",
    }),
    mdx(),
  ],
  markdown: {
    syntaxHighlight: false,
    rehypePlugins: [
      [
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
  },
});
