/**
 * The figlet greeting variants (src/data/ascii-art.json, ~66 KiB), loaded on
 * demand. They decorate the browser console and the sidebar easter egg, never
 * the first paint, so they are fetched once after the page instead of being
 * bundled into every page or inlined into its HTML.
 */
import type { AsciiVariant } from "@/scripts/asciiWidget";

/** The 404 art and the music alias belong to their own pages. */
const isGreeting = (v: AsciiVariant): boolean => v.text !== "404" && v.text !== "Alex.Immer";

let greetings: Promise<AsciiVariant[]> | null = null;

/** Resolves with the greeting variants, or [] when they could not be loaded (a later call retries). */
export function loadGreetingVariants(): Promise<AsciiVariant[]> {
	greetings ??= import("@/data/ascii-art.json")
		.then((m) => (m.default as AsciiVariant[]).filter(isGreeting))
		.catch(() => {
			greetings = null;
			return [];
		});
	return greetings;
}
