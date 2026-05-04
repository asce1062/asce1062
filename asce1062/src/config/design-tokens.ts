/**
 * Design Tokens Registry
 *
 * Static documentation data for the site's visual system.
 * Runtime values still come from src/styles/theme.css via CSS variables.
 */

// =============================================================================
// COLOR ROLES (Card-based palette display)
// =============================================================================

export interface ColorRole {
	id: string;
	name: string;
	description: string;
	tags: string[];
}

/**
 * Derive CSS variable from role id
 * e.g., "base-100" -> "--color-base-100"
 */
export function getCssVar(id: string): string {
	return `--color-${id}`;
}

/**
 * Derive content CSS variable from role id (if applicable)
 * - base-100, base-200, base-300 -> "--color-base-content"
 * - base-content -> null (no content var)
 * - semantic typography tokens -> null
 * - others -> "--color-{id}-content"
 */
export function getContentVar(id: string): string | null {
	if (id === "base-content") return null;
	if (id.startsWith("base-")) return "--color-base-content";
	if (id.endsWith("-content")) return null;
	if (["heading", "link", "muted", "code-bg", "atmosphere-ink", "guestbook-pattern-ink", "matrix-rain"].includes(id)) {
		return null;
	}
	return `--color-${id}-content`;
}

export const colorRoles: ColorRole[] = [
	{
		id: "base-100",
		name: "Base 100",
		description: "Primary page background: the warm void or parchment field.",
		tags: ["bg-base-100"],
	},
	{
		id: "base-200",
		name: "Base 200",
		description: "Secondary surfaces, panels, and quiet elevation.",
		tags: ["bg-base-200"],
	},
	{
		id: "base-300",
		name: "Base 300",
		description: "Tertiary surfaces, dividers, borders, and table rules.",
		tags: ["bg-base-300", "border-base-300"],
	},
	{
		id: "base-content",
		name: "Base Content",
		description: "Default body text against base surfaces.",
		tags: ["text-base-content"],
	},
	{
		id: "primary",
		name: "Primary",
		description: "Brand action color and active terminal accents.",
		tags: ["bg-primary", "text-primary"],
	},
	{
		id: "secondary",
		name: "Secondary",
		description: "Supporting accent for alternate emphasis.",
		tags: ["bg-secondary", "text-secondary"],
	},
	{
		id: "accent",
		name: "Accent",
		description: "Phosphor highlight for headings, focus, and identity moments.",
		tags: ["bg-accent", "text-accent"],
	},
	{
		id: "neutral",
		name: "Neutral",
		description: "Subdued UI fills that should stay out of the way.",
		tags: ["bg-neutral", "text-neutral-content"],
	},
	{
		id: "heading",
		name: "Heading",
		description: "Semantic heading color decoupled from raw status tokens.",
		tags: ["text-heading"],
	},
	{
		id: "link",
		name: "Link",
		description: "Semantic interactive text color for prose and utility links.",
		tags: ["text-link"],
	},
	{
		id: "muted",
		name: "Muted",
		description: "Captions, metadata, and low-emphasis explanatory text.",
		tags: ["text-muted"],
	},
	{
		id: "code-bg",
		name: "Code BG",
		description: "Inline code surface, slightly lifted from the page base.",
		tags: ["bg-code-bg"],
	},
	{
		id: "atmosphere-ink",
		name: "Atmosphere Ink",
		description: "Topography and ambient pattern ink, separate from surfaces.",
		tags: ["text-atmosphere-ink"],
	},
	{
		id: "guestbook-pattern-ink",
		name: "Guestbook Pattern Ink",
		description: "Dense guestbook pattern ink tuned quieter than atmosphere ink.",
		tags: ["text-guestbook-pattern-ink"],
	},
	{
		id: "matrix-rain",
		name: "Matrix Rain",
		description: "Optional matrix background glyph color.",
		tags: ["text-matrix-rain"],
	},
	{
		id: "info",
		name: "Info",
		description: "Informational messages and helpful hints.",
		tags: ["bg-info", "text-info"],
	},
	{
		id: "success",
		name: "Success",
		description: "Positive outcomes and confirmations.",
		tags: ["bg-success", "text-success"],
	},
	{
		id: "warning",
		name: "Warning",
		description: "Cautions, command names, and alert states.",
		tags: ["bg-warning", "text-warning"],
	},
	{
		id: "error",
		name: "Error",
		description: "Errors, destructive actions, and anomaly states.",
		tags: ["bg-error", "text-error"],
	},
];

// =============================================================================
// COLOR VALUES (OKLCH)
// =============================================================================

export interface ColorValue {
	id: string;
	role: string;
	light: string;
	dark: string;
}

export const colorValues: ColorValue[] = [
	{ id: "base-100", role: "Base 100", light: "oklch(91.637% 0.034 90.515)", dark: "oklch(13% 0.018 270)" },
	{ id: "base-200", role: "Base 200", light: "oklch(88.272% 0.049 91.774)", dark: "oklch(20% 0.013 270)" },
	{ id: "base-300", role: "Base 300", light: "oklch(84.133% 0.065 90.856)", dark: "oklch(23% 0.015 270)" },
	{ id: "base-content", role: "Base Content", light: "oklch(41% 0.112 45.904)", dark: "oklch(90% 0.07 95)" },
	{ id: "primary", role: "Primary", light: "oklch(71% 0.185 19.571)", dark: "oklch(70% 0.191 22.216)" },
	{ id: "primary-content", role: "Primary Content", light: "oklch(96% 0.012 19.571)", dark: "oklch(25% 0.092 26.042)" },
	{ id: "secondary", role: "Secondary", light: "oklch(85% 0.15 154.449)", dark: "oklch(79% 0.209 151.711)" },
	{
		id: "secondary-content",
		role: "Secondary Content",
		light: "oklch(30% 0.09 151.328)",
		dark: "oklch(26% 0.065 152.934)",
	},
	{ id: "accent", role: "Accent", light: "oklch(60% 0.195 76)", dark: "oklch(85% 0.199 91.936)" },
	{ id: "accent-content", role: "Accent Content", light: "oklch(97% 0.012 76)", dark: "oklch(28% 0.066 53.813)" },
	{ id: "neutral", role: "Neutral", light: "oklch(84.1% 0.081 73.639)", dark: "oklch(16% 0.019 329.708)" },
	{ id: "neutral-content", role: "Neutral Content", light: "oklch(44% 0.011 73.639)", dark: "oklch(70% 0.01 56.259)" },
	{ id: "heading", role: "Heading", light: "var(--color-accent)", dark: "var(--color-accent)" },
	{ id: "link", role: "Link", light: "var(--color-warning)", dark: "var(--color-primary)" },
	{ id: "muted", role: "Muted", light: "oklch(58% 0.05 75)", dark: "oklch(68% 0.025 90)" },
	{ id: "code-bg", role: "Code BG", light: "oklch(86.272% 0.027 91.774)", dark: "oklch(16% 0.012 270)" },
	{ id: "atmosphere-ink", role: "Atmosphere Ink", light: "oklch(72% 0.075 90)", dark: "oklch(38% 0.032 270)" },
	{
		id: "guestbook-pattern-ink",
		role: "Guestbook Pattern Ink",
		light: "oklch(81.8% 0.054 90.3)",
		dark: "oklch(26% 0.018 277.9)",
	},
	{ id: "matrix-rain", role: "Matrix Rain", light: "oklch(70% 0.075 90)", dark: "oklch(24% 0.045 95)" },
	{ id: "info", role: "Info", light: "oklch(58% 0.158 241.966)", dark: "oklch(70% 0.165 254.624)" },
	{ id: "info-content", role: "Info Content", light: "oklch(96% 0.059 95.617)", dark: "oklch(28% 0.091 267.935)" },
	{ id: "success", role: "Success", light: "oklch(51% 0.096 186.391)", dark: "oklch(43% 0.078 188.216)" },
	{ id: "success-content", role: "Success Content", light: "oklch(96% 0.059 95.617)", dark: "oklch(92% 0.12 95.746)" },
	{ id: "warning", role: "Warning", light: "oklch(64% 0.222 41.116)", dark: "oklch(47% 0.157 37.304)" },
	{ id: "warning-content", role: "Warning Content", light: "oklch(96% 0.059 95.617)", dark: "oklch(92% 0.12 95.746)" },
	{ id: "error", role: "Error", light: "oklch(70% 0.191 22.216)", dark: "oklch(63% 0.237 25.331)" },
	{ id: "error-content", role: "Error Content", light: "oklch(40% 0.123 38.172)", dark: "oklch(26% 0.079 36.259)" },
];

// =============================================================================
// FLAVOR THEMES
// =============================================================================

export type ThemeFlavorId = "crt-green" | "amber" | "synthwave" | "dos" | "void" | "ice" | "redline";

export interface FlavorTokenSet {
	"base-100": string;
	"base-200": string;
	"base-300": string;
	"base-content": string;
	primary: string;
	secondary: string;
	accent: string;
	heading: string;
	link: string;
	muted: string;
	"code-bg": string;
	"atmosphere-ink": string;
	"guestbook-pattern-ink": string;
	"matrix-rain": string;
}

export interface ThemeFlavor {
	id: ThemeFlavorId;
	label: string;
	description: string;
	swatch: string;
	dark: FlavorTokenSet;
	light: FlavorTokenSet;
}

export const flavorTokenIds: Array<keyof FlavorTokenSet> = [
	"base-100",
	"base-200",
	"base-300",
	"base-content",
	"primary",
	"secondary",
	"accent",
	"heading",
	"link",
	"muted",
	"code-bg",
	"atmosphere-ink",
	"guestbook-pattern-ink",
	"matrix-rain",
];

export const flavorTokenLabels: Record<keyof FlavorTokenSet, string> = {
	"base-100": "Base 100",
	"base-200": "Base 200",
	"base-300": "Base 300",
	"base-content": "Content",
	primary: "Primary",
	secondary: "Secondary",
	accent: "Accent",
	heading: "Heading",
	link: "Link",
	muted: "Muted",
	"code-bg": "Code BG",
	"atmosphere-ink": "Atmosphere",
	"guestbook-pattern-ink": "Guestbook",
	"matrix-rain": "Matrix",
};

export const themeFlavors: ThemeFlavor[] = [
	{
		id: "crt-green",
		label: "CRT Green",
		description: "Phosphor green basement terminal with strong emission in dark mode.",
		swatch: "oklch(78% 0.22 145)",
		dark: {
			"base-100": "oklch(8% 0.025 145)",
			"base-200": "oklch(12% 0.03 145)",
			"base-300": "oklch(16% 0.035 145)",
			"base-content": "oklch(80% 0.16 148)",
			primary: "oklch(88% 0.26 145)",
			secondary: "oklch(62% 0.14 148)",
			accent: "oklch(76% 0.22 140)",
			heading: "oklch(92% 0.25 143)",
			link: "oklch(88% 0.24 105)",
			muted: "oklch(52% 0.09 148)",
			"code-bg": "oklch(10% 0.025 145)",
			"atmosphere-ink": "oklch(34% 0.08 145)",
			"guestbook-pattern-ink": "oklch(21% 0.053 145)",
			"matrix-rain": "oklch(26% 0.11 148)",
		},
		light: {
			"base-100": "oklch(96% 0.012 140)",
			"base-200": "oklch(92% 0.018 140)",
			"base-300": "oklch(87% 0.024 138)",
			"base-content": "oklch(28% 0.09 148)",
			primary: "oklch(42% 0.17 150)",
			secondary: "oklch(52% 0.13 148)",
			accent: "oklch(36% 0.14 145)",
			heading: "oklch(30% 0.14 150)",
			link: "oklch(36% 0.2 110)",
			muted: "oklch(55% 0.06 142)",
			"code-bg": "oklch(90% 0.022 138)",
			"atmosphere-ink": "oklch(76% 0.04 138)",
			"guestbook-pattern-ink": "oklch(79% 0.029 138)",
			"matrix-rain": "oklch(78% 0.075 148)",
		},
	},
	{
		id: "amber",
		label: "Amber",
		description: "Warm legacy terminal palette; closest light flavor to the default parchment.",
		swatch: "oklch(75% 0.2 70)",
		dark: {
			"base-100": "oklch(11% 0.028 50)",
			"base-200": "oklch(16% 0.032 52)",
			"base-300": "oklch(20% 0.036 55)",
			"base-content": "oklch(78% 0.14 78)",
			primary: "oklch(80% 0.2 72)",
			secondary: "oklch(65% 0.15 65)",
			accent: "oklch(86% 0.21 88)",
			heading: "oklch(88% 0.22 80)",
			link: "oklch(70% 0.24 40)",
			muted: "oklch(52% 0.08 75)",
			"code-bg": "oklch(13% 0.028 50)",
			"atmosphere-ink": "oklch(36% 0.08 58)",
			"guestbook-pattern-ink": "oklch(23.5% 0.054 54)",
			"matrix-rain": "oklch(28% 0.1 78)",
		},
		light: {
			"base-100": "oklch(91.637% 0.034 90.515)",
			"base-200": "oklch(88.272% 0.049 91.774)",
			"base-300": "oklch(84.133% 0.065 90.856)",
			"base-content": "oklch(41% 0.112 45.904)",
			primary: "oklch(85% 0.199 91.936)",
			secondary: "oklch(75% 0.183 55.934)",
			accent: "oklch(62% 0.195 76)",
			heading: "oklch(48% 0.18 68)",
			link: "oklch(50% 0.24 38)",
			muted: "oklch(55% 0.06 75)",
			"code-bg": "oklch(82% 0.072 88)",
			"atmosphere-ink": "oklch(72% 0.075 90)",
			"guestbook-pattern-ink": "oklch(79% 0.075 89)",
			"matrix-rain": "oklch(70% 0.075 90)",
		},
	},
	{
		id: "synthwave",
		label: "Synthwave",
		description: "Cosmic demo-scene violet with cyan and amber contrast.",
		swatch: "oklch(72% 0.28 330)",
		dark: {
			"base-100": "oklch(14% 0.09 281)",
			"base-200": "oklch(19% 0.09 281)",
			"base-300": "oklch(24% 0.09 281)",
			"base-content": "oklch(82% 0.1 275)",
			primary: "oklch(72% 0.22 350)",
			secondary: "oklch(82% 0.12 230)",
			accent: "oklch(78% 0.19 58)",
			heading: "oklch(82% 0.25 335)",
			link: "oklch(80% 0.18 195)",
			muted: "oklch(62% 0.05 280)",
			"code-bg": "oklch(17% 0.09 281)",
			"atmosphere-ink": "oklch(40% 0.1 281)",
			"guestbook-pattern-ink": "oklch(27% 0.095 281)",
			"matrix-rain": "oklch(30% 0.08 275)",
		},
		light: {
			"base-100": "oklch(97% 0.014 300)",
			"base-200": "oklch(94% 0.028 298)",
			"base-300": "oklch(89% 0.052 295)",
			"base-content": "oklch(36% 0.12 295)",
			primary: "oklch(58% 0.24 300)",
			secondary: "oklch(55% 0.18 192)",
			accent: "oklch(68% 0.19 58)",
			heading: "oklch(50% 0.26 296)",
			link: "oklch(42% 0.22 192)",
			muted: "oklch(58% 0.03 295)",
			"code-bg": "oklch(91% 0.028 298)",
			"atmosphere-ink": "oklch(78% 0.06 295)",
			"guestbook-pattern-ink": "oklch(86% 0.039 296.5)",
			"matrix-rain": "oklch(70% 0.09 295)",
		},
	},
	{
		id: "dos",
		label: "DOS Blue",
		description: "Classic deep-blue system UI: sharp, legible, intentionally glowless.",
		swatch: "oklch(82% 0.14 195)",
		dark: {
			"base-100": "oklch(20% 0.04 265)",
			"base-200": "oklch(24% 0.042 265)",
			"base-300": "oklch(28% 0.044 265)",
			"base-content": "oklch(96% 0.008 265)",
			primary: "oklch(82% 0.15 195)",
			secondary: "oklch(88% 0.1 240)",
			accent: "oklch(86% 0.16 182)",
			heading: "oklch(90% 0.14 185)",
			link: "oklch(76% 0.18 225)",
			muted: "oklch(68% 0.01 265)",
			"code-bg": "oklch(18% 0.038 265)",
			"atmosphere-ink": "oklch(44% 0.04 265)",
			"guestbook-pattern-ink": "oklch(32% 0.04 265)",
			"matrix-rain": "oklch(34% 0.024 265)",
		},
		light: {
			"base-100": "oklch(100% 0 0)",
			"base-200": "oklch(93% 0 0)",
			"base-300": "oklch(86% 0 0)",
			"base-content": "oklch(22% 0.031 278)",
			primary: "oklch(58% 0.158 241.966)",
			secondary: "oklch(55% 0.046 257)",
			accent: "oklch(60% 0.118 184)",
			heading: "oklch(28% 0.12 248)",
			link: "oklch(44% 0.2 255)",
			muted: "oklch(55% 0.015 260)",
			"code-bg": "oklch(90% 0 0)",
			"atmosphere-ink": "oklch(74% 0.012 260)",
			"guestbook-pattern-ink": "oklch(79% 0.006 130)",
			"matrix-rain": "oklch(68% 0.03 260)",
		},
	},
	{
		id: "void",
		label: "Void",
		description: "Monochrome negative space with only functional status color left intact.",
		swatch: "oklch(38% 0.003 0)",
		dark: {
			"base-100": "oklch(0% 0 0)",
			"base-200": "oklch(19% 0 0)",
			"base-300": "oklch(22% 0 0)",
			"base-content": "oklch(87.609% 0 0)",
			primary: "oklch(52% 0 0)",
			secondary: "oklch(38% 0 0)",
			accent: "oklch(60% 0 0)",
			heading: "oklch(92% 0 0)",
			link: "oklch(65% 0 0)",
			muted: "oklch(42% 0 0)",
			"code-bg": "oklch(8% 0 0)",
			"atmosphere-ink": "oklch(32% 0 0)",
			"guestbook-pattern-ink": "oklch(24% 0 0)",
			"matrix-rain": "oklch(22% 0 0)",
		},
		light: {
			"base-100": "oklch(100% 0 0)",
			"base-200": "oklch(97% 0 0)",
			"base-300": "oklch(94% 0 0)",
			"base-content": "oklch(8% 0 0)",
			primary: "oklch(16% 0 0)",
			secondary: "oklch(22% 0 0)",
			accent: "oklch(27% 0 0)",
			heading: "oklch(12% 0 0)",
			link: "oklch(32% 0 0)",
			muted: "oklch(55% 0 0)",
			"code-bg": "oklch(92% 0 0)",
			"atmosphere-ink": "oklch(78% 0 0)",
			"guestbook-pattern-ink": "oklch(79% 0 0)",
			"matrix-rain": "oklch(68% 0 0)",
		},
	},
	{
		id: "ice",
		label: "Ice",
		description: "Cold arctic precision with tight cyan glow in dark mode.",
		swatch: "oklch(74% 0.17 195)",
		dark: {
			"base-100": "oklch(9% 0.022 212)",
			"base-200": "oklch(14% 0.026 210)",
			"base-300": "oklch(18% 0.03 210)",
			"base-content": "oklch(94% 0.016 202)",
			primary: "oklch(76% 0.19 197)",
			secondary: "oklch(68% 0.16 205)",
			accent: "oklch(84% 0.18 190)",
			heading: "oklch(90% 0.18 195)",
			link: "oklch(72% 0.2 210)",
			muted: "oklch(58% 0.01 205)",
			"code-bg": "oklch(11% 0.02 212)",
			"atmosphere-ink": "oklch(36% 0.04 210)",
			"guestbook-pattern-ink": "oklch(22.5% 0.031 211)",
			"matrix-rain": "oklch(28% 0.06 205)",
		},
		light: {
			"base-100": "oklch(99% 0.006 210)",
			"base-200": "oklch(95% 0.01 210)",
			"base-300": "oklch(88% 0.014 210)",
			"base-content": "oklch(22% 0.04 218)",
			primary: "oklch(46% 0.17 200)",
			secondary: "oklch(54% 0.12 205)",
			accent: "oklch(58% 0.16 195)",
			heading: "oklch(28% 0.14 210)",
			link: "oklch(42% 0.2 198)",
			muted: "oklch(58% 0.012 210)",
			"code-bg": "oklch(92% 0.012 210)",
			"atmosphere-ink": "oklch(78% 0.018 210)",
			"guestbook-pattern-ink": "oklch(79% 0.012 210)",
			"matrix-rain": "oklch(68% 0.06 205)",
		},
	},
	{
		id: "redline",
		label: "Redline",
		description: "System anomaly tension: high-chroma red against dark terminal surfaces.",
		swatch: "oklch(58% 0.25 22)",
		dark: {
			"base-100": "oklch(8% 0.024 20)",
			"base-200": "oklch(12% 0.03 20)",
			"base-300": "oklch(16% 0.036 22)",
			"base-content": "oklch(90% 0.012 22)",
			primary: "oklch(60% 0.26 22)",
			secondary: "oklch(48% 0.2 18)",
			accent: "oklch(68% 0.28 16)",
			heading: "oklch(72% 0.28 18)",
			link: "oklch(72% 0.22 35)",
			muted: "oklch(52% 0.008 22)",
			"code-bg": "oklch(10% 0.024 20)",
			"atmosphere-ink": "oklch(34% 0.05 22)",
			"guestbook-pattern-ink": "oklch(21% 0.037 21)",
			"matrix-rain": "oklch(26% 0.09 22)",
		},
		light: {
			"base-100": "oklch(99% 0.006 22)",
			"base-200": "oklch(96% 0.016 22)",
			"base-300": "oklch(90% 0.04 22)",
			"base-content": "oklch(30% 0.1 22)",
			primary: "oklch(55% 0.26 22)",
			secondary: "oklch(48% 0.22 18)",
			accent: "oklch(62% 0.28 28)",
			heading: "oklch(48% 0.28 20)",
			link: "oklch(52% 0.26 35)",
			muted: "oklch(58% 0.015 22)",
			"code-bg": "oklch(93% 0.02 22)",
			"atmosphere-ink": "oklch(78% 0.04 22)",
			"guestbook-pattern-ink": "oklch(79% 0.025 22)",
			"matrix-rain": "oklch(70% 0.09 22)",
		},
	},
];

// =============================================================================
// HEX COLOR VALUES
// Resolved sRGB hex equivalents of the base theme OKLCH tokens.
// Useful where CSS variables are unavailable: emails, canvas, OG image, console.
// =============================================================================

export interface HexColorValue {
	id: string;
	light: string;
	dark: string;
}

const hexColorValues: HexColorValue[] = [
	{ id: "base-100", light: "#ece3ca", dark: "#05070e" },
	{ id: "base-200", light: "#e4d8b4", dark: "#14161c" },
	{ id: "base-300", light: "#dbca9b", dark: "#1a1d24" },
	{ id: "base-content", light: "#793205", dark: "#ecdeaa" },
	{ id: "primary", light: "#ff6871", dark: "#ff6266" },
	{ id: "primary-content", light: "#faefee", dark: "#440607" },
	{ id: "secondary", light: "#74eaa1", dark: "#01df72" },
	{ id: "secondary-content", light: "#003a14", dark: "#022d14" },
	{ id: "accent", light: "#c06800", dark: "#fdc700" },
	{ id: "accent-content", light: "#faf4ec", dark: "#411e03" },
	{ id: "neutral", light: "#ebc390", dark: "#120a11" },
	{ id: "neutral-content", light: "#56524c", dark: "#a49d99" },
	{ id: "heading", light: "#c06800", dark: "#fdc700" },
	{ id: "link", light: "#f34700", dark: "#ff6266" },
	{ id: "muted", light: "#8c7659", dark: "#9e9887" },
	{ id: "code-bg", light: "#d8d2be", dark: "#0b0d13" },
	{ id: "info", light: "#0082ce", dark: "#4ea0ff" },
	{ id: "info-content", light: "#fef2c6", dark: "#162455" },
	{ id: "success", light: "#00776f", dark: "#005d58" },
	{ id: "success-content", light: "#fef2c6", dark: "#fde484" },
	{ id: "warning", light: "#f34700", dark: "#9f2d00" },
	{ id: "warning-content", light: "#fef2c6", dark: "#fde484" },
	{ id: "error", light: "#ff6266", dark: "#f82834" },
	{ id: "error-content", light: "#7c2808", dark: "#421104" },
	{ id: "atmosphere-ink", light: "#b7a36d", dark: "#3c4254" },
	{ id: "guestbook-pattern-ink", light: "#d1c39c", dark: "#22232d" },
	{ id: "matrix-rain", light: "#b09d67", dark: "#261f03" },
];

export const hexLight: Record<string, string> = Object.fromEntries(hexColorValues.map((c) => [c.id, c.light]));
export const hexDark: Record<string, string> = Object.fromEntries(hexColorValues.map((c) => [c.id, c.dark]));
