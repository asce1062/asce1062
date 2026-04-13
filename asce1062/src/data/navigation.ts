/**
 * Centralized navigation data for Header and Footer components
 * Single source of truth for all site navigation links
 */
import { SITE, SOCIAL } from "@/config/site-config";
import { getGithubProfileUrl } from "@/config/site-utils";

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
	section?: "main" | "explore" | "meta"; // Nav drawer grouping
}

/**
 * Sidebar section definitions
 * Order controls render order
 * */
export const navSections: { key: NavigationLink["section"]; label: string }[] = [
	{ key: "main", label: "main" },
	{ key: "explore", label: "explore" },
	{ key: "meta", label: "meta" },
];

const githubProfile = SOCIAL.profiles.find((p) => p.name === "GitHub");
const linkedinProfile = SOCIAL.profiles.find((p) => p.name === "LinkedIn");
const discordProfile = SOCIAL.profiles.find((p) => p.name === "Discord");

/**
 * Main site navigation links (Sidebar)
 */
export const mainNavigation: NavigationLink[] = [
	// ── main ──
	{
		name: "Home",
		href: "/",
		icon: "icon-house-heart",
		ariaLabel: "Go to the home page",
		animation: "rotate-left",
		section: "main",
	},
	{
		name: "About",
		href: "/about",
		icon: "icon-person",
		ariaLabel: "Learn more about Alex",
		animation: "rotate-right",
		section: "main",
	},
	{
		name: "Hello",
		href: "/hello",
		icon: "icon-chat-square-heart",
		ariaLabel: "How to reach Alex and where he is actually active online",
		animation: "rotate-left",
		section: "main",
	},
	{
		name: "Feed",
		href: "/rss.xml",
		icon: "icon-rss",
		ariaLabel: "Subscribe to RSS feed",
		animation: "rotate-right",
		section: "main",
	},
	{
		name: "Email",
		href: `mailto:${SOCIAL.email}`,
		icon: "icon-envelope-at",
		ariaLabel: `Email ${SITE.authorShort}`,
		animation: "rotate-left",
		section: "main",
	},
	{
		name: "Guestbook",
		href: "/guestbook",
		icon: "icon-journal-bookmark",
		ariaLabel: "Sign the guestbook",
		animation: "rotate-right",
		section: "main",
	},

	// ── explore ──
	{
		name: "Blog",
		href: "/blog",
		icon: "icon-journal-richtext",
		ariaLabel: "Read the blog",
		animation: "rotate-right",
		section: "explore",
	},
	{
		name: "Notebook",
		href: "/notes",
		icon: "icon-stickies",
		ariaLabel: "Browse notes",
		animation: "rotate-left",
		section: "explore",
	},
	{
		name: "Now",
		href: "/now",
		icon: "icon-hourglass-split",
		ariaLabel: "See what Alex is working on now",
		animation: "rotate-right",
		section: "explore",
	},
	{
		name: "Verify",
		href: "/verify",
		icon: "icon-patch-check",
		ariaLabel: "Identity verification. Canonical accounts and contact points",
		animation: "rotate-left",
		section: "explore",
	},
	{
		name: "Resume",
		href: "/blog/2025-06-19-resume",
		icon: "icon-body-text",
		ariaLabel: `View ${SITE.authorShort}'s resume`,
		animation: "rotate-right",
		section: "explore",
	},
	{
		name: "Interests",
		href: "/interests",
		icon: "icon-heart",
		ariaLabel: "The things Alex is genuinely into",
		animation: "rotate-left",
		section: "explore",
	},
	{
		name: "Tags",
		href: "/tags",
		icon: "icon-bookmarks",
		ariaLabel: "Browse posts by tag",
		animation: "rotate-right",
		section: "explore",
	},
	{
		name: "Why",
		href: "/notes/2026-03-12-guiding-principles",
		icon: "icon-question-circle",
		ariaLabel: "Guiding principles behind this site",
		animation: "rotate-left",
		section: "explore",
	},
	{
		name: "Changelog",
		href: "/changelog",
		icon: "icon-diff-modified",
		ariaLabel: "Project release history and recent changes",
		animation: "rotate-right",
		section: "explore",
	},
	{
		name: "Humans",
		href: "/humans.txt",
		icon: "icon-people",
		ariaLabel: "The humans behind this site",
		animation: "rotate-left",
		section: "explore",
	},
	{
		name: "Palette",
		href: "/palette",
		icon: "icon-palette",
		ariaLabel: "Design system color palette and tokens",
		animation: "rotate-right",
		section: "explore",
	},
	{
		name: "Privacy",
		href: "/privacy",
		icon: "icon-cookie",
		ariaLabel: "Privacy policy and data handling",
		animation: "rotate-left",
		section: "explore",
	},
	{
		name: "Licensing",
		href: "/notes/2026-03-12-licensing",
		icon: "icon-info-circle",
		ariaLabel: "Licensing terms and site disclaimer",
		animation: "rotate-right",
		section: "explore",
	},
	{
		name: "Projects",
		href: "/projects",
		icon: "icon-braces-asterisk",
		ariaLabel: "View projects",
		animation: "rotate-right",
		section: "explore",
	},
	{
		name: "Colophon",
		href: "/colophon",
		icon: "icon-book",
		ariaLabel: "Credits, philosophy, and the story behind this site",
		animation: "rotate-right",
		section: "explore",
	},
	{
		name: "Meta",
		href: "/meta",
		icon: "icon-gear",
		ariaLabel: "Site diagnostics and build metadata",
		animation: "rotate-left",
		section: "explore",
	},
	{
		name: "Search",
		href: "/search",
		icon: "icon-search-heart",
		ariaLabel: "Search the site",
		animation: "rotate-right",
		section: "explore",
	},
	{
		name: "8biticon",
		href: "/8biticon",
		icon: "icon-female",
		ariaLabel: "Create your own 8-bit pixel avatar",
		animation: "rotate-left",
		multiPathIcon: true,
		pathCount: 10,
		section: "explore",
	},

	// ── meta ──
	{
		name: "PGP Key",
		href: "/downloads/public.pgp",
		icon: "icon-key",
		ariaLabel: "Download Alex's PGP public key",
		animation: "rotate-right",
		section: "meta",
	},
	...(githubProfile
		? [
				{
					name: "GitHub",
					href: githubProfile.url,
					icon: "icon-github",
					ariaLabel: "Visit Alex's GitHub profile",
					animation: "rotate-left" as const,
					external: true,
					section: "meta" as const,
				},
			]
		: []),
	...(linkedinProfile
		? [
				{
					name: "LinkedIn",
					href: linkedinProfile.url,
					icon: "icon-linkedin",
					ariaLabel: "Visit Alex's LinkedIn profile",
					animation: "rotate-right" as const,
					external: true,
					section: "meta" as const,
				},
			]
		: []),
	{
		name: "Resume.pdf",
		href: "/resume",
		icon: "icon-filetype-pdf",
		ariaLabel: `View ${SITE.authorShort}'s resume as PDF`,
		animation: "rotate-left",
		section: "meta",
	},
	...(discordProfile
		? [
				{
					name: "Discord",
					href: discordProfile.url,
					icon: "icon-discord",
					ariaLabel: "Find Alex on Discord",
					animation: "rotate-left" as const,
					external: true,
					section: "meta" as const,
				},
			]
		: []),
];

/**
 * Sidebar option item.
 * Each entry renders a labelled toggle in the Options section.
 * Behaviour (storage key, DOM attribute) is wired in the corresponding
 * client script. The data layer only describes the UI.
 */
export interface SidebarOption {
	/** Unique id. Used as the checkbox id and the aria-describedby anchor. */
	id: string;
	/** Icon class name (icomoon). Rendered as <i class="icon nav-icon" />. */
	icon: string;
	/** Short label shown next to the icon (brief. one or two words). */
	label: string;
	/** One-sentence plain-language description shown on info hover/focus
	 *  and always visible on touch/no-hover devices. */
	description: string;
}

/**
 * Options section entries.
 * Toggle user preferences.
 */
export const sidebarOptions: SidebarOption[] = [
	{
		id: "cursor-blink-toggle",
		icon: "icon-command-palette",
		label: "Pause",
		description: "Stops the site's blinking cursor flourishes.",
	},
	{
		id: "match-device-theme-toggle",
		icon: "icon-sun",
		label: "Match device",
		description: "Follows your OS/browser preferred color scheme. Manually switching the theme turns this off.",
	},
	{
		id: "stars-background-toggle",
		icon: "icon-stars",
		label: "Stars",
		description: "Shows an animated star field behind the site.",
	},
	{
		id: "matrix-background-toggle",
		icon: "icon-columns",
		label: "Matrix",
		description: "Hiragana rain falls behind the site. Enabling this turns off Stars.",
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
	commitUrl: fullCommitHash ? `${getGithubProfileUrl()}/asce1062/commit/${fullCommitHash}` : null,
	buildTime: new Date().toISOString(),
};
