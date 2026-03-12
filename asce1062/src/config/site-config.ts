/**
 * Site Configuration
 *
 * Single source of truth for all site-wide constants.
 * Import from @/config/site-config in components and pages.
 *
 * Usage:
 *   import { SITE, BLOG, SOCIAL, SEO, PWA, PROFESSIONAL, HOSTING } from "@/config/site-config";
 *   import { getPageTitle, getAbsoluteUrl, getOgImageUrl } from "@/config/site-utils";
 *
 * NOTE: not for secrets or sensitive values.
 */

// =============================================================================
// GROUPED EXPORTS
// =============================================================================

/**
 * Site identity and branding
 */
export const SITE = {
	/** Full legal name used in metadata and schemas */
	author: "Alex Mbugua Ngugi",
	/** Display name for greetings and casual references */
	authorShort: "Alex Mbugua",
	/** Primary site title (used in PWA manifest, OG site_name) */
	title: "Alex Mbugua",
	/** Tagline appended to page titles */
	titleSuffix: "Leader, Mentor, Engineer, Chip Musician",
	/** Default page description for SEO */
	description: "Building secure, performant, scalable solutions in the cloud",
	/** Canonical site URL (must match astro.config.mjs site value) */
	url: "https://alexmbugua.me",
} as const;

/**
 * Blog configuration
 */
export const BLOG = {
	title: "Alex Mbugua's Blog",
	description: "My space on the internet. Thoughts on life, tech, and everything in between. I'm happy you're here ^^",
} as const;

/**
 * Notebook (notes) configuration
 */
export const NOTEBOOK = {
	title: "Alex Mbugua's Notebook",
	description: "Short-form thoughts, observations, and micro-posts.",
} as const;

/**
 * Social and contact information
 */
export const SOCIAL = {
	/** Primary email address */
	email: "alex@alexmbugua.me",
	/** Twitter/X handle (without @) */
	twitter: "alex_immer",
	/** GitHub username */
	github: "asce1062",
	/** GitHub repository URL */
	repo: "https://github.com/asce1062/asce1062/tree/main/asce1062",
	/**
	 * Social profiles
	 * Single source of truth for identity verification and JSON-LD schemas.
	 * Fields: name (platform), url (canonical link), handle (optional display id), comment (optional note)
	 */
	profiles: [
		{ name: "GitHub", url: "https://github.com/asce1062", handle: "asce1062" },
		{ name: "LinkedIn", url: "https://www.linkedin.com/in/alex-mbugua", handle: "alex-mbugua" },
		{
			name: "X / Twitter",
			url: "https://x.com/alex_immer",
			handle: "@alex_immer",
			comment: "I don't use Twitter but I do own this account",
		},
		{ name: "TikTok", url: "https://www.tiktok.com/@asce1062", handle: "@asce1062" },
		{ name: "Discord", url: "https://discord.com/users/asce1062", handle: "asce1062" },
		{ name: "Facebook", url: "https://www.facebook.com/kaizoku.asce", handle: "kaizoku.asce" },
		{ name: "YouTube", url: "https://www.youtube.com/@asce1062", handle: "@asce1062" },
		{ name: "SoundCloud", url: "https://soundcloud.com/aleximmer", handle: "aleximmer" },
		{ name: "Twitch", url: "https://www.twitch.tv/asce1062", handle: "asce1062" },
		{ name: "Spotify", url: "https://open.spotify.com/user/alex.immer", handle: "alex.immer" },
		{ name: "Steam", url: "https://steamcommunity.com/id/alexasce", handle: "alexasce" },
		{ name: "Reddit", url: "https://www.reddit.com/user/asce1062/", handle: "u/asce1062" },
		{ name: "PSN Profile", url: "https://psnprofiles.com/asce-3341", handle: "asce-3341" },
		{ name: "XDA Forums", url: "https://xdaforums.com/m/asce1062.4692299/", handle: "asce1062" },
		{ name: "UnknownCheats", url: "https://www.unknowncheats.me/forum/members/413602.html", handle: "asce1062" },
		{ name: "CrustyWindows wiki", url: "https://crustywindo.ws/User:Asce1062", handle: "Asce1062" },
		{
			name: "alexmbugua.me",
			url: "https://alexmbugua.me",
			handle: "alexmbugua.me",
			comment: "This site, of course ^^",
		},
		{
			name: "Personal site mirror",
			url: "https://asce1062.github.io/asce1062",
			handle: "asce1062.github.io/asce1062",
			comment: "Mirror of this site hosted on GitHub Pages",
		},
		{
			name: "music.alexmbugua.me",
			url: "https://music.alexmbugua.me",
			handle: "music.alexmbugua.me",
			comment: "Music site",
		},
		{
			name: "Music site mirror",
			url: "https://asce1062.github.io/",
			handle: "asce1062.github.io",
			comment: "Mirror of music site hosted on GitHub Pages",
		},
	],
} as const;

/**
 * SEO and metadata defaults
 */
export const SEO = {
	/** Default locale for OG and language tags */
	locale: "en_US",
	/** Default language code */
	language: "en",
	/** Default OG image filename (relative to site root) */
	ogImage: "social-preview.png",
	/** SEO keywords */
	keywords: [
		"leader",
		"mentor",
		"engineer",
		"chip musician",
		"site",
		"portfolio",
		"blog",
		"guestbook",
		"Alex Mbugua",
		"Alex Ngugi",
		"Alex Mbugua Ngugi",
		"asce1062",
		"Alex.Immer",
	],
} as const;

/**
 * PWA and theming configuration
 * Colors derived from theme.css oklch values:
 * https://oklch.net/
 * - Light base-100: oklch(91.637% 0.034 90.515) ≈ #ece3ca
 * - Dark base-100: oklch(14.076% 0.004 285.822) ≈ #09090b
 */
export const PWA = {
	/** Theme colors for light/dark modes (matches theme.css base-100 values) */
	themeColors: {
		light: "#ece3ca",
		dark: "#09090b",
	},
	/** Background color (dark mode base-100) */
	backgroundColor: "#09090b",
} as const;

/**
 * Professional information (for schemas)
 */
export const PROFESSIONAL = {
	jobTitle: "Full-Stack Engineer",
	almaMater: "Jomo Kenyatta University Of Agriculture And Technology",
	skills: [
		"Software Engineering",
		"Cloud Architecture",
		"Security",
		"Performance Optimization",
		"Scalable Solutions",
		"Full-Stack Development",
		"Leadership",
		"Mentoring",
		"Chip Music",
	],
} as const;

/**
 * Hosting and infrastructure configuration
 */
export const HOSTING = {
	primary: {
		name: "Netlify",
		url: "https://www.netlify.com",
		description: "Edge CDN with automatic HTTPS & CI/CD",
	},
	alternate: {
		name: "GitHub Pages",
		url: "https://pages.github.com",
		description: "Available at asce1062.github.io/asce1062",
	},
	registrar: {
		name: "Namecheap",
		url: "https://www.namecheap.com",
	},
	cicd: {
		name: "Netlify Build + GitHub Actions",
		description: "Auto-deploy on push to main branch",
	},
	forms: {
		name: "Astro DB + Turso",
		url: "https://turso.tech",
		description: "Self-hosted libSQL database for guestbook submissions",
	},
} as const;

/**
 * Controlled domains and subdomains
 * Single source of truth for identity verification, JSON-LD, and infrastructure docs.
 * Fields: a root domain and an optional list of subdomains/paths.
 */
export const DOMAINS = [
	{
		root: "alexmbugua.me",
		subdomains: [
			"music.alexmbugua.me",
			"music-api.alexmbugua.me",
			"cdn.alexmbugua.me",
			"api.alexmbugua.me",
			"send.alexmbugua.me",
		],
	},
	{
		root: "asce1062.github.io",
		subdomains: ["asce1062.github.io/asce1062"],
	},
] as const;
