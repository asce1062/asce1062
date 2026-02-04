/**
 * Centralized navigation data for Header and Footer components
 * Single source of truth for all site navigation links
 */
import { SITE, SOCIAL } from "@/config/site-config";

export interface NavigationLink {
	name: string;
	href: string;
	icon?: string;
	ariaLabel?: string;
	external?: boolean;
	download?: boolean;
	animation?: "rotate-left" | "rotate-right";
	multiPathIcon?: boolean; // For icons with multiple path elements
	pathCount?: number; // Number of path elements for multi-path icons
}

export interface SocialLink extends NavigationLink {
	platform: string;
}

/**
 * Main site navigation links (Header)
 */
export const mainNavigation: NavigationLink[] = [
	{
		name: "Home",
		href: "/",
		icon: "icon-house-heart",
		ariaLabel: "Visit the Home page",
		animation: "rotate-left",
	},
	{
		name: "Guestbook",
		href: "/guestbook",
		icon: "icon-journal-bookmark",
		ariaLabel: "Visit the Guestbook page",
		animation: "rotate-right",
	},
	{
		name: "Blog",
		href: "/blog",
		icon: "icon-journal-richtext",
		ariaLabel: "Visit the Blog page",
		animation: "rotate-left",
	},
	{
		name: "Projects",
		href: "/projects",
		icon: "icon-braces-asterisk",
		ariaLabel: "Visit the Projects page",
		animation: "rotate-right",
	},
	{
		name: "Now",
		href: "/now",
		icon: "icon-hourglass-split",
		ariaLabel: "Visit the Now page",
		animation: "rotate-left",
	},
	// {
	// 	name: "Search",
	// 	href: "/search",
	// 	icon: "icon-search-heart",
	// 	ariaLabel: "Visit the Search blogs page",
	// 	animation: "rotate-right",
	// },
	{
		name: "8biticon",
		href: "/8biticon",
		icon: "icon-female",
		ariaLabel: "Create your own 8-bit pixel avatar",
		animation: "rotate-right",
		multiPathIcon: true,
		pathCount: 10,
	},
	{
		name: "Tags",
		href: "/tags",
		icon: "icon-bookmarks",
		ariaLabel: "Visit the Blog Tags page",
		animation: "rotate-left",
	},
	{
		name: "Resume",
		href: "/resume",
		icon: "icon-filetype-pdf",
		ariaLabel: "Visit the view Alex's resume as PDF page",
		animation: "rotate-right",
	},
	{
		name: "Colophon",
		href: "/colophon",
		icon: "icon-book",
		ariaLabel: "Credits, philosophy, and the story behind this site",
		animation: "rotate-left",
	},
	{
		name: "Palette",
		href: "/palette",
		icon: "icon-palette",
		ariaLabel: "Design system color palette and tokens",
		animation: "rotate-right",
	},
	{
		name: "Meta",
		href: "/meta",
		icon: "icon-gear",
		ariaLabel: "Site diagnostics and build metadata",
		animation: "rotate-left",
	},
	{
		name: "RSS Feed",
		href: "/rss.xml",
		icon: "icon-rss",
		ariaLabel: "Subscribe to my blog",
		animation: "rotate-left",
	},
];

/**
 * Social media links (Footer)
 */
export const socialLinks: SocialLink[] = [
	{
		name: "asce1062",
		href: "https://github.com/asce1062",
		icon: "icon-github",
		platform: "GitHub",
		external: true,
		ariaLabel: "Visit Alex's GitHub profile",
	},
	{
		name: "Alex Mbugua",
		href: "https://www.linkedin.com/in/alex-mbugua",
		icon: "icon-linkedin",
		platform: "LinkedIn",
		external: true,
		ariaLabel: "Visit Alex's LinkedIn profile",
	},
];

/**
 * Contact and resume links (Footer)
 */
export const contactLinks: NavigationLink[] = [
	{
		name: "Resume",
		href: "/blog/2025-06-19-resume",
		icon: "icon-body-text",
		ariaLabel: `View ${SITE.authorShort}'s resume`,
	},
	{
		name: "Resume.pdf",
		href: "/resume",
		icon: "icon-filetype-pdf",
		ariaLabel: `View ${SITE.authorShort}'s resume as PDF`,
	},
	{
		name: SOCIAL.email,
		href: `mailto:${SOCIAL.email}`,
		icon: "icon-envelope-at",
		ariaLabel: `Email ${SITE.authorShort}`,
	},
];

/**
 * Get the current commit hash from environment variable
 * Returns full hash or null if not set
 * Uses COMMIT_REF (Netlify's environment variable)
 */
function getFullCommitHash(): string | null {
	return import.meta.env.COMMIT_REF || null;
}

/**
 * Get the shortened commit hash (first 7 characters)
 */
function getShortCommitHash(): string | null {
	const hash = getFullCommitHash();
	return hash ? hash.substring(0, 7) : null;
}

/**
 * Site metadata
 */
const fullCommitHash = getFullCommitHash();
const shortCommitHash = getShortCommitHash();

export const siteMetadata = {
	author: SITE.authorShort,
	greeting: "Alex.",
	email: SOCIAL.email,
	githubRepo: SOCIAL.repo,
	astroUrl: "https://astro.build",
	commitHash: shortCommitHash,
	commitHashFull: fullCommitHash,
	commitUrl: fullCommitHash ? `https://github.com/${SOCIAL.github}/asce1062/commit/${fullCommitHash}` : null,
	buildTime: new Date().toISOString(),
};
