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
 * Calculate accurate reading time for a blog post
 * Based on average reading speed of 200 words per minute
 * @param content - Raw MDX content from entry.body
 * @returns Formatted reading time string (e.g., "4 min read")
 */
export function estimateReadingTime(content: string | undefined): string {
	if (!content) {
		return "1 min read"; // Fallback for empty content
	}

	const wordsPerMinute = 200;

	// Remove MDX frontmatter (between --- markers)
	let cleanedContent = content.replace(/^---[\s\S]*?---/m, "");

	// Remove imports
	cleanedContent = cleanedContent.replace(/^import\s+.*?from\s+['"].*?['"];?\s*/gm, "");

	// Remove JSX/HTML tags
	cleanedContent = cleanedContent.replace(/<[^>]+>/g, "");

	// Remove code blocks (```...```)
	cleanedContent = cleanedContent.replace(/```[\s\S]*?```/g, "");

	// Remove inline code (`...`)
	cleanedContent = cleanedContent.replace(/`[^`]+`/g, "");

	// Remove markdown links but keep text: [text](url) → text
	cleanedContent = cleanedContent.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

	// Remove markdown images: ![alt](url)
	cleanedContent = cleanedContent.replace(/!\[([^\]]*)\]\([^)]+\)/g, "");

	// Remove HTML comments
	cleanedContent = cleanedContent.replace(/<!--[\s\S]*?-->/g, "");

	// Remove markdown headers (#, ##, etc.) but keep text
	cleanedContent = cleanedContent.replace(/^#{1,6}\s+/gm, "");

	// Clean up extra whitespace
	cleanedContent = cleanedContent.trim().replace(/\s+/g, " ");

	// Count words
	const wordCount = cleanedContent.split(/\s+/).filter((word) => word.length > 0).length;

	// Calculate reading time
	const minutes = Math.max(1, Math.ceil(wordCount / wordsPerMinute));

	return `${minutes} min read`;
}
