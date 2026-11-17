/**
 * Table of contents helpers
 */

import type { TableOfContents, TableOfContentsEntry } from "@/types";

/**
 * How many nested levels the table of contents shows: a top-level entry, its
 * children and its grandchildren. Anything nested deeper is left out so the
 * floating list stays short enough to scan. TableOfContents.astro nests
 * exactly this many lists; change both together.
 */
export const MAX_TOC_DEPTH = 3;

/**
 * Return a copy of the tree with every entry nested deeper than `maxDepth`
 * levels removed. Levels are counted by nesting (top-level entries are level 1),
 * not by heading rank. The input is not modified.
 */
export function limitTocDepth(entries: TableOfContents, maxDepth: number): TableOfContents {
	if (maxDepth < 1) return [];

	return entries.map((entry): TableOfContentsEntry => {
		if (!entry.children) return entry;
		return { ...entry, children: limitTocDepth(entry.children, maxDepth - 1) };
	});
}
