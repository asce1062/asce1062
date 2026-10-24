/**
 * The only way pages read content collections.
 *
 * Drafts (`draft: true` in frontmatter) are excluded here, once, so they never
 * reach a page, list, tag page, prev/next link, RSS item, OG image or the
 * search index. Kept apart from utils.ts, which must stay importable in unit
 * tests (astro:content is a build-time virtual module).
 */
import { getCollection, type CollectionEntry } from "astro:content";

type PublishableCollection = "blog" | "notes";

export function getPublishedEntries<C extends PublishableCollection>(collection: C): Promise<CollectionEntry<C>[]> {
	return getCollection(collection, ({ data }) => !data.draft);
}
