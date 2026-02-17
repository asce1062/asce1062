import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import { getImage } from "astro:assets";
import type { ImageMetadata } from "astro";
import fs from "fs";
import path from "path";
import { BLOG } from "@/config/site-config";
import { sortByDate, getContentUrl } from "@/lib/content/utils";

// Dynamically import all blog images
const images = import.meta.glob<{ default: ImageMetadata }>("../assets/blog/*.{jpg,jpeg,png,webp}", { eager: true });

// Create image map from dynamic imports
// Normalize paths to match frontmatter format: /src/assets/blog/filename.ext
const imageMap = Object.entries(images).reduce(
	(acc, [path, module]) => {
		// Convert ../assets/blog/filename.ext to /src/assets/blog/filename.ext
		const normalizedPath = path.replace("../assets/", "/src/assets/");
		acc[normalizedPath] = module.default;
		return acc;
	},
	{} as Record<string, ImageMetadata>
);

export async function GET(context: { site: string | URL }) {
	const blog = await getCollection("blog");
	const sortedPosts = sortByDate(blog);

	// Process images to get optimized URLs
	const postsWithOptimizedImages = await Promise.all(
		sortedPosts.map(async (post) => {
			const imageAsset = imageMap[post.data.image.url];
			const optimizedImage = imageAsset ? await getImage({ src: imageAsset, format: "webp" }) : null;

			return {
				...post,
				optimizedImageUrl: optimizedImage
					? new URL(optimizedImage.src, context.site).href
					: new URL(post.data.image.url.replace("/src/assets/", "/astro/"), context.site).href,
			};
		})
	);

	const publicDir = path.resolve("./public");
	const primaryImagePath = path.join(publicDir, "social-preview.png");

	// Use primary if it exists, otherwise fallback
	const channelImage = fs.existsSync(primaryImagePath)
		? new URL("/social-preview.png", context.site).href
		: new URL("/social-preview-no-bg.png", context.site).href;

	// Get most recent date for <lastBuildDate> and <pubDate>
	const lastBuildDate = sortedPosts[0]?.data.pubDate.toUTCString();

	return rss({
		title: BLOG.title,
		description: BLOG.description,
		site: context.site,
		items: postsWithOptimizedImages.map((post) => ({
			title: post.data.title,
			pubDate: post.data.pubDate,
			description: `<img src="${post.optimizedImageUrl}" alt="${post.data.image.alt}" /><br/><br/>${post.data.description}`,
			link: `${getContentUrl(post.id, "/blog")}/`,
			categories: post.data.tags,
		})),
		customData: `
      <language>en</language>
      <lastBuildDate>${lastBuildDate}</lastBuildDate>
      <pubDate>${lastBuildDate}</pubDate>
      <ttl>60</ttl>
      <generator>Astro RSS Generator</generator>
      <!-- Podcast Metadata for platforms like YouTube -->
      <managingEditor>tnkratos@gmail.com (Alex Mbugua Ngugi)</managingEditor>
      <image>
        <url>${channelImage}</url>
        <title>${BLOG.title}</title>
        <link>${context.site}</link>
      </image>
      <itunes:owner>
        <itunes:name>Alex Mbugua Ngugi</itunes:name>
        <itunes:email>tnkratos@gmail.com</itunes:email>
      </itunes:owner>
      <itunes:author>Alex Mbugua Ngugi</itunes:author>
      <itunes:explicit>no</itunes:explicit>
      <itunes:category text="Society &amp; Culture">
        <itunes:category text="Personal Journals" />
      </itunes:category>
      <itunes:category text="Society &amp; Culture">
        <itunes:category text="Philosophy" />
      </itunes:category>
      <itunes:category text="Technology"/>
      <itunes:category text="Religion &amp; Spirituality">
        <itunes:category text="Spirituality" />
      </itunes:category>
      <itunes:category text="Religion &amp; Spirituality">
        <itunes:category text="Christianity" />
      </itunes:category>
      <itunes:category text="Education">
        <itunes:category text="How To" />
      </itunes:category>
      <itunes:category text="Music"/>
      <atom:link href="${new URL("/rss.xml", context.site).href}" rel="self" type="application/rss+xml" />
      <copyright>© ${new Date().getFullYear()} Alex Mbugua Ngugi. You are free to Share i.e copy and redistribute the material in any medium or format. You are free to Adapt i.e transform, and build upon the material. Content by Alex Ngugi is licensed under Attribution Non-Commercial Creative Commons License (https://creativecommons.org/licenses/by-nc-sa/4.0/). For commercial uses, don't hesitate to contact me: mailto:tnkratos@gmail.com</copyright>
    `,
		xmlns: {
			dc: "http://purl.org/dc/elements/1.1/",
			atom: "http://www.w3.org/2005/Atom",
			itunes: "http://www.itunes.com/dtds/podcast-1.0.dtd",
		},
	});
}
