import { OGImageRoute } from "astro-og-canvas";
import { getCollection } from "astro:content";

const posts = await getCollection("blog");

// Create pages object with blog post paths as keys
const pages = Object.fromEntries(
	posts.map((post) => {
		// Remove .mdx extension from id to match URL structure
		const path = `/blog/${post.id.replace(".mdx", "")}`;
		return [path, { frontmatter: post.data }];
	})
);

export const { getStaticPaths, GET } = OGImageRoute({
	param: "route",
	pages,
	getImageOptions: (_path, page) => ({
		title: page.frontmatter.title,
		description: page.frontmatter.description,
		logo: { path: "public/icon.png" },
		bgGradient: [[19, 15, 25]],
		font: {
			title: {
				families: ["0xProto", "monospace"],
				size: 48,
				weight: "Bold",
			},
			description: {
				families: ["0xProto", "monospace"],
				size: 24,
			},
		},
		fonts: ["public/fonts/0xProto/0xProtoNerdFont-Regular.ttf"],
	}),
});
