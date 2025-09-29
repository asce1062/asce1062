import { OGImageRoute } from "astro-og-canvas";

export const { getStaticPaths, GET } = OGImageRoute({
  param: "route",

  pages: import.meta.glob("/src/pages/blog/*.mdx", { eager: true }),

  getImageOptions: (_path, page) => ({
    title: page.frontmatter.title,
    description: page.frontmatter.description,
    logo: { path: "public/icon.png" },
    bgGradient: [[19, 15, 25]],
    font: {
      title: {
        families: ["0xProto", "monospace"],
        size: 48,
      },
      description: {
        families: ["0xProto", "monospace"],
        size: 24,
      },
    },
    fonts: ["public/fonts/0xProto/0xProtoNerdFont-Regular.ttf"],
  }),
});
