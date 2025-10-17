/**
 * Blog utilities
 * Shared helpers for blog post processing
 */

import type { CollectionEntry } from "astro:content";

/**
 * Format blog post publication date for display
 */
export function formatPostDate(date: Date, format: "long" | "short" = "long"): string {
	if (format === "short") {
		// ISO format: YYYY-MM-DD
		return date.toISOString().slice(0, 10);
	}

	// Long format: Month Day, Year
	return date.toLocaleDateString("en-US", {
		year: "numeric",
		month: "long",
		day: "numeric",
	});
}

/**
 * Generate blog post URL from post ID
 * Removes .mdx extension and adds /blog/ prefix
 */
export function getPostUrl(postId: string): string {
	return `/blog/${postId.replace(".mdx", "")}`;
}

/**
 * Sort posts by publication date (newest first)
 */
export function sortPostsByDate(posts: CollectionEntry<"blog">[]): CollectionEntry<"blog">[] {
	return [...posts].sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime());
}

/**
 * Get all unique tags from blog posts
 */
export function getAllTags(posts: CollectionEntry<"blog">[]): string[] {
	const tags = posts.map((post) => post.data.tags).flat();
	return [...new Set(tags)].sort();
}

/**
 * Calculate reading time estimation for a blog post
 * Based on average reading speed of 200 words per minute
 * Uses title and description length as a rough heuristic since MDX pages can't be easily parsed
 */
export function estimateReadingTime(title: string, description: string): string {
	// Rough estimation: typical blog posts are 500-1500 words
	// We'll use title + description length as indicator
	const combinedText = `${title} ${description}`;
	const wordCount = combinedText.split(/\s+/).length;

	// Estimate full article is 30-50x the description length
	const estimatedArticleWords = wordCount * 40;
	const minutes = Math.max(1, Math.ceil(estimatedArticleWords / 200));

	return `${minutes} min read`;
}
