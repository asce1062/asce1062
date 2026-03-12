/**
 * Site utility functions
 *
 * Helper functions for URL generation, title formatting, etc.
 * Separated from site-config.ts to keep config as pure data.
 */
import { SITE, SEO, SOCIAL } from "./site-config";

/**
 * Get full page title with suffix
 */
export function getPageTitle(title: string): string {
	return `${title} - ${SITE.titleSuffix}`;
}

/**
 * Get OG image URL
 * @param imagePath - Image path or filename
 * @param baseUrl - Optional base URL override
 */
export function getOgImageUrl(imagePath: string = SEO.ogImage, baseUrl: string = SITE.url): string {
	return new URL(imagePath, baseUrl).href;
}

/**
 * Get GitHub profile URL derived from SOCIAL.github handle
 */
export function getGithubProfileUrl(): string {
	return `https://github.com/${SOCIAL.github}`;
}

/**
 * Extract URL strings from SOCIAL.profiles for use in JSON-LD sameAs arrays
 */
export function getSocialProfileUrls(): string[] {
	return SOCIAL.profiles.map((p) => p.url);
}
