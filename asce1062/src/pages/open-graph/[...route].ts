import { OGImageRoute } from "astro-og-canvas";
import { getCollection } from "astro:content";
import type { APIRoute, GetStaticPathsOptions } from "astro";

// Explicitly enable prerendering for static build
export const prerender = true;

// Helper function to get OG route configuration
async function getOGRoute() {
	const posts = await getCollection("blog");
	const notes = await getCollection("notes");

	// Create pages object with blog post paths as keys
	const blogPages = Object.fromEntries(
		posts.map((post) => {
			// Remove .mdx extension from id to match URL structure
			const path = `/blog/${post.id.replace(".mdx", "")}`;
			return [path, { frontmatter: post.data }];
		})
	);

	// Add note paths
	const notePages = Object.fromEntries(
		notes.map((note) => {
			const path = `/notes/${note.id.replace(".mdx", "")}`;
			return [path, { frontmatter: note.data }];
		})
	);

	const pages = { ...blogPages, ...notePages };

	return OGImageRoute({
		param: "route",
		pages,
		getImageOptions: (_path, page) => ({
			title: page.frontmatter.title,
			description: page.frontmatter.description,
			logo: { path: "public/icon.png" },
			bgGradient: [[19, 15, 25]],
			font: {
				title: {
					families: ["0xProto"],
					size: 48,
					weight: "Bold",
				},
				description: {
					families: ["0xProto Italic", "0xProto"],
					size: 24,
					weight: "Normal",
				},
			},
			fonts: [
				"public/fonts/0xProto/0xProto-Regular.ttf",
				"public/fonts/0xProto/0xProto-Bold.ttf",
				"public/fonts/0xProto/0xProto-Italic.ttf",
			],
		}),
	});
}

export async function getStaticPaths(options: GetStaticPathsOptions) {
	const ogRoute = await getOGRoute();
	return ogRoute.getStaticPaths(options);
}

export const GET: APIRoute = async (context) => {
	const ogRoute = await getOGRoute();
	return ogRoute.GET(context);
};
