/**
 * Site Configuration
 *
 * Single source of truth for all site-wide constants.
 * Import from @/config/site-config in components and pages.
 *
 * Usage:
 *   import { SITE, BLOG, SOCIAL, SEO, PWA, PROFESSIONAL, HOSTING } from "@/config/site-config";
 *   import { getPageTitle, getAbsoluteUrl, getOgImageUrl } from "@/config/site-config";
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
 * Social and contact information
 */
export const SOCIAL = {
	/** Primary email address */
	email: "alex.mbugua@outlook.com",
	/** Twitter/X handle (without @) */
	twitter: "alex_immer",
	/** GitHub username */
	github: "asce1062",
	/** GitHub repository URL */
	repo: "https://github.com/asce1062/asce1062/tree/main/asce1062",
	/** Social profile URLs for JSON-LD schemas */
	profiles: [
		"https://github.com/asce1062",
		"https://www.linkedin.com/in/alex-mbugua",
		"https://x.com/alex_immer",
		"https://discord.com/users/asce1062",
		"https://www.facebook.com/kaizoku.asce",
		"https://www.youtube.com/@asce1062",
		"https://soundcloud.com/aleximmer",
		"https://asce1062.github.io",
		"https://alexmbugua.me",
		"https://steamcommunity.com/id/alexasce",
		"https://www.reddit.com/user/asce1062/",
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
		name: "Netlify Forms",
		url: "https://www.netlify.com/platform/core/forms/",
		description: "Form handling service for guestbook submissions",
	},
} as const;

// =============================================================================
// HELPER FUNCTIONS (Re-exported from site-utils.ts)
// =============================================================================
export { getPageTitle, getAbsoluteUrl, getOgImageUrl } from "./site-utils";
