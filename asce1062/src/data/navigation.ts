/**
 * Centralized navigation data for Header and Footer components
 * Single source of truth for all site navigation links
 */

export interface NavigationLink {
	name: string;
	href: string;
	icon?: string;
	ariaLabel?: string;
	external?: boolean;
	download?: boolean;
	animation?: "rotate-left" | "rotate-right";
}

export interface SocialLink extends NavigationLink {
	platform: string;
}

/**
 * Main site navigation links (Footer)
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
		name: "Now",
		href: "/now",
		icon: "icon-hourglass-split",
		ariaLabel: "Visit the Now page",
		animation: "rotate-right",
	},
	{
		name: "Projects",
		href: "/projects",
		icon: "icon-kanban",
		ariaLabel: "Visit the Projects page",
		animation: "rotate-left",
	},
	{
		name: "Blog",
		href: "/blog",
		icon: "icon-bookmark-heart",
		ariaLabel: "Visit the Blog page",
		animation: "rotate-right",
	},
	{
		name: "Tags",
		href: "/tags",
		icon: "icon-bookmarks",
		ariaLabel: "Visit the Blog Tags page",
		animation: "rotate-left",
	},
	{
		name: "Search",
		href: "/search",
		icon: "icon-search-heart",
		ariaLabel: "Search the site",
		animation: "rotate-right",
	},
	{
		name: "Guestbook",
		href: "/guestbook",
		icon: "icon-journal-bookmark",
		ariaLabel: "Visit the Guestbook page",
		animation: "rotate-left",
	},
	{
		name: "RSS Feed",
		href: "/rss.xml",
		icon: "icon-rss",
		ariaLabel: "Subscribe to my blog",
		animation: "rotate-right",
	},
];

/**
 * Social media links (Header)
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
 * Contact and resume links (Header)
 */
export const contactLinks: NavigationLink[] = [
	{
		name: "Resume",
		href: "/blog/2025-06-19-resume",
		icon: "icon-eye",
		ariaLabel: "View Alex's resume",
	},
	{
		name: "Resume.pdf",
		href: "/Alex%20Mbugua%20Ngugi%20-%20Resume.pdf",
		icon: "icon-cloud-download",
		ariaLabel: "Download Alex's resume as PDF",
		download: true,
	},
	{
		name: "alex.mbugua@outlook.com",
		href: "mailto:alex.mbugua@outlook.com",
		icon: "icon-envelope-at",
		ariaLabel: "Email Alex Mbugua",
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
	author: "Alex Mbugua",
	greeting: "hi, i'm Alex.",
	email: "alex.mbugua@outlook.com",
	githubRepo: "https://github.com/asce1062/asce1062/tree/main/asce1062",
	astroUrl: "https://astro.build",
	commitHash: shortCommitHash,
	commitHashFull: fullCommitHash,
	commitUrl: fullCommitHash ? `https://github.com/asce1062/asce1062/commit/${fullCommitHash}` : null,
};
