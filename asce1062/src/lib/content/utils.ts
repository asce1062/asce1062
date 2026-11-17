/**
 * Content utilities
 * Shared helpers for content processing
 */

import type { CollectionEntry } from "astro:content";

type ContentEntry = CollectionEntry<"blog"> | CollectionEntry<"notes">;

/**
 * Format publication date for display
 */
export function formatDate(date: Date, format: "long" | "medium" | "short" = "long"): string {
	if (format === "short") {
		return date.toISOString().slice(0, 10);
	}

	return date.toLocaleDateString("en-US", {
		year: "numeric",
		month: format === "medium" ? "short" : "long",
		day: "numeric",
	});
}

/**
 * Generate content URL from entry ID and collection base path
 */
export function getContentUrl(id: string, basePath: string): string {
	return `${basePath}/${id.replace(".mdx", "")}`;
}

/**
 * Generate the canonical URL of a tag page.
 * The site's canonical form ends with a slash (it is what the sitemap and
 * <link rel="canonical"> emit), and the tag is a path segment, so it is encoded.
 */
export function getTagUrl(tag: string): string {
	return `/tags/${encodeURIComponent(tag)}/`;
}

/**
 * Sort content entries by publication date (newest first)
 */
export function sortByDate<T extends ContentEntry>(entries: T[]): T[] {
	return [...entries].sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime());
}

/**
 * Get all unique tags from content entries
 */
export function getAllTags(entries: ContentEntry[]): string[] {
	const tags = entries.map((entry) => entry.data.tags).flat();
	return [...new Set(tags)].sort();
}
