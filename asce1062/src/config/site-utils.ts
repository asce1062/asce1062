/**
 * Site utility functions
 *
 * Helper functions for URL generation, title formatting, etc.
 * Separated from site-config.ts to keep config as pure data.
 */
import { SITE, SEO } from "./site-config";

/**
 * Get full page title with suffix
 */
export function getPageTitle(title: string): string {
	return `${title} - ${SITE.titleSuffix}`;
}

/**
 * Get absolute URL from path
 * @param path - Relative path (e.g., "/blog")
 * @param baseUrl - Optional base URL override (defaults to SITE.url)
 */
export function getAbsoluteUrl(path: string, baseUrl: string = SITE.url): string {
	return new URL(path, baseUrl).href;
}

/**
 * Get OG image URL
 * @param imagePath - Image path or filename
 * @param baseUrl - Optional base URL override
 */
export function getOgImageUrl(imagePath: string = SEO.ogImage, baseUrl: string = SITE.url): string {
	return new URL(imagePath, baseUrl).href;
}
