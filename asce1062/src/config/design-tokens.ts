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
	{ id: "base-100", role: "Base 100", dark: "oklch(15% 0.014 65)", light: "oklch(93% 0.02 85)" },
	{ id: "base-200", role: "Base 200", dark: "oklch(19% 0.016 65)", light: "oklch(89% 0.03 86)" },
	{ id: "base-300", role: "Base 300", dark: "oklch(24% 0.018 65)", light: "oklch(84% 0.04 86)" },
	{ id: "base-content", role: "Base Content", dark: "oklch(91% 0.012 85)", light: "oklch(34% 0.05 60)" },
	{ id: "primary", role: "Primary", dark: "oklch(80% 0.13 80)", light: "oklch(52% 0.12 65)" },
	{ id: "primary-content", role: "Primary Content", dark: "oklch(21% 0.04 75)", light: "oklch(97% 0.02 85)" },
	{ id: "secondary", role: "Secondary", dark: "oklch(80% 0.08 210)", light: "oklch(50% 0.09 205)" },
	{
		id: "secondary-content",
		role: "Secondary Content",
		dark: "oklch(20% 0.03 210)",
		light: "oklch(98% 0.01 205)",
	},
	{ id: "accent", role: "Accent", dark: "oklch(87% 0.135 88)", light: "oklch(48% 0.13 55)" },
	{ id: "accent-content", role: "Accent Content", dark: "oklch(22% 0.05 82)", light: "oklch(97% 0.02 80)" },
	{ id: "neutral", role: "Neutral", dark: "oklch(24% 0.014 65)", light: "oklch(84% 0.03 80)" },
	{ id: "neutral-content", role: "Neutral Content", dark: "oklch(73% 0.012 75)", light: "oklch(40% 0.02 70)" },
	{ id: "heading", role: "Heading", light: "var(--color-accent)", dark: "var(--color-accent)" },
	{ id: "link", role: "Link", light: "var(--color-primary)", dark: "var(--color-primary)" },
	{ id: "muted", role: "Muted", dark: "oklch(65% 0.018 75)", light: "oklch(46% 0.03 70)" },
	{ id: "code-bg", role: "Code BG", dark: "oklch(20% 0.014 65)", light: "oklch(87% 0.03 86)" },
	{ id: "atmosphere-ink", role: "Atmosphere Ink", dark: "oklch(34% 0.02 65)", light: "oklch(74% 0.035 85)" },
	{
		id: "guestbook-pattern-ink",
		role: "Guestbook Pattern Ink",
		dark: "oklch(26% 0.016 65)",
		light: "oklch(80% 0.03 86)",
	},
	{ id: "matrix-rain", role: "Matrix Rain", dark: "oklch(32% 0.05 145)", light: "oklch(60% 0.08 145)" },
	{ id: "info", role: "Info", dark: "oklch(72% 0.1 230)", light: "oklch(52% 0.13 240)" },
	{ id: "info-content", role: "Info Content", dark: "oklch(18% 0.04 230)", light: "oklch(98% 0.02 240)" },
	{ id: "success", role: "Success", dark: "oklch(74% 0.11 150)", light: "oklch(50% 0.1 155)" },
	{ id: "success-content", role: "Success Content", dark: "oklch(18% 0.04 150)", light: "oklch(98% 0.02 155)" },
	{ id: "warning", role: "Warning", dark: "oklch(82% 0.12 85)", light: "oklch(70% 0.13 75)" },
	{ id: "warning-content", role: "Warning Content", dark: "oklch(22% 0.05 80)", light: "oklch(25% 0.06 70)" },
	{ id: "error", role: "Error", dark: "oklch(65% 0.15 27)", light: "oklch(52% 0.16 27)" },
	{ id: "error-content", role: "Error Content", dark: "oklch(96% 0.015 27)", light: "oklch(98% 0.015 27)" },
];

// =============================================================================
// FLAVOR THEMES
// =============================================================================

export type ThemeFlavorId = "observatory" | "crt-green" | "amber" | "synthwave" | "dos" | "void" | "ice" | "redline";

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
		id: "observatory",
		label: "Observatory",
		description: "Deep-space indigo dome with nebula violet, cyan starlight, and soft celestial glow.",
		swatch: "oklch(78% 0.12 285)",
		dark: {
			"base-100": "oklch(13% 0.03 275)",
			"base-200": "oklch(17% 0.035 275)",
			"base-300": "oklch(22% 0.04 278)",
			"base-content": "oklch(93% 0.015 250)",
			primary: "oklch(78% 0.12 285)",
			secondary: "oklch(80% 0.1 210)",
			accent: "oklch(85% 0.12 90)",
			heading: "oklch(86% 0.13 288)",
			link: "oklch(82% 0.11 210)",
			muted: "oklch(64% 0.03 265)",
			"code-bg": "oklch(16% 0.03 275)",
			"atmosphere-ink": "oklch(34% 0.05 278)",
			"guestbook-pattern-ink": "oklch(26% 0.04 278)",
			"matrix-rain": "oklch(34% 0.06 250)",
		},
		light: {
			"base-100": "oklch(96% 0.012 250)",
			"base-200": "oklch(92% 0.018 255)",
			"base-300": "oklch(87% 0.026 260)",
			"base-content": "oklch(30% 0.06 275)",
			primary: "oklch(48% 0.14 280)",
			secondary: "oklch(50% 0.1 215)",
			accent: "oklch(52% 0.12 65)",
			heading: "oklch(42% 0.15 282)",
			link: "oklch(46% 0.13 220)",
			muted: "oklch(48% 0.04 270)",
			"code-bg": "oklch(90% 0.02 258)",
			"atmosphere-ink": "oklch(76% 0.03 262)",
			"guestbook-pattern-ink": "oklch(81% 0.02 260)",
			"matrix-rain": "oklch(58% 0.08 250)",
		},
	},
	{
		id: "crt-green",
		label: "CRT Green",
		description: "Phosphor green basement terminal with strong emission in dark mode.",
		swatch: "oklch(78% 0.22 145)",
		dark: {
			"base-100": "oklch(8% 0.025 145)",
			"base-200": "oklch(12% 0.03 145)",
			"base-300": "oklch(16% 0.035 145)",
			"base-content": "oklch(84% 0.15 148)",
			primary: "oklch(86% 0.17 145)",
			secondary: "oklch(64% 0.13 148)",
			accent: "oklch(78% 0.16 140)",
			heading: "oklch(90% 0.17 143)",
			link: "oklch(88% 0.17 115)",
			muted: "oklch(60% 0.1 148)",
			"code-bg": "oklch(10% 0.025 145)",
			"atmosphere-ink": "oklch(34% 0.08 145)",
			"guestbook-pattern-ink": "oklch(21% 0.053 145)",
			"matrix-rain": "oklch(30% 0.11 148)",
		},
		light: {
			"base-100": "oklch(96% 0.012 140)",
			"base-200": "oklch(92% 0.018 140)",
			"base-300": "oklch(87% 0.024 138)",
			"base-content": "oklch(28% 0.09 148)",
			primary: "oklch(42% 0.15 150)",
			secondary: "oklch(52% 0.13 148)",
			accent: "oklch(38% 0.13 145)",
			heading: "oklch(30% 0.13 150)",
			link: "oklch(40% 0.15 118)",
			muted: "oklch(46% 0.09 145)",
			"code-bg": "oklch(90% 0.022 138)",
			"atmosphere-ink": "oklch(76% 0.04 138)",
			"guestbook-pattern-ink": "oklch(79% 0.029 138)",
			"matrix-rain": "oklch(60% 0.11 148)",
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
			"base-content": "oklch(82% 0.13 78)",
			primary: "oklch(80% 0.16 72)",
			secondary: "oklch(66% 0.14 65)",
			accent: "oklch(86% 0.16 88)",
			heading: "oklch(88% 0.16 80)",
			link: "oklch(78% 0.17 55)",
			muted: "oklch(60% 0.09 75)",
			"code-bg": "oklch(13% 0.028 50)",
			"atmosphere-ink": "oklch(36% 0.08 58)",
			"guestbook-pattern-ink": "oklch(23.5% 0.054 54)",
			"matrix-rain": "oklch(30% 0.1 78)",
		},
		light: {
			"base-100": "oklch(93% 0.03 88)",
			"base-200": "oklch(89% 0.045 90)",
			"base-300": "oklch(84% 0.06 89)",
			"base-content": "oklch(36% 0.08 55)",
			primary: "oklch(56% 0.14 68)",
			secondary: "oklch(58% 0.15 50)",
			accent: "oklch(50% 0.14 62)",
			heading: "oklch(46% 0.15 65)",
			link: "oklch(50% 0.17 45)",
			muted: "oklch(48% 0.07 68)",
			"code-bg": "oklch(87% 0.05 88)",
			"atmosphere-ink": "oklch(74% 0.07 90)",
			"guestbook-pattern-ink": "oklch(80% 0.055 89)",
			"matrix-rain": "oklch(60% 0.1 78)",
		},
	},
	{
		id: "synthwave",
		label: "Synthwave",
		description: "Cosmic demo-scene violet with cyan and amber contrast.",
		swatch: "oklch(72% 0.28 330)",
		dark: {
			"base-100": "oklch(14% 0.07 281)",
			"base-200": "oklch(19% 0.075 281)",
			"base-300": "oklch(24% 0.08 281)",
			"base-content": "oklch(86% 0.08 275)",
			primary: "oklch(72% 0.17 350)",
			secondary: "oklch(82% 0.11 230)",
			accent: "oklch(80% 0.15 60)",
			heading: "oklch(80% 0.16 335)",
			link: "oklch(82% 0.13 195)",
			muted: "oklch(66% 0.05 280)",
			"code-bg": "oklch(17% 0.075 281)",
			"atmosphere-ink": "oklch(40% 0.09 281)",
			"guestbook-pattern-ink": "oklch(27% 0.08 281)",
			"matrix-rain": "oklch(32% 0.07 300)",
		},
		light: {
			"base-100": "oklch(97% 0.014 300)",
			"base-200": "oklch(94% 0.028 298)",
			"base-300": "oklch(89% 0.05 295)",
			"base-content": "oklch(34% 0.11 295)",
			primary: "oklch(52% 0.18 300)",
			secondary: "oklch(50% 0.14 195)",
			accent: "oklch(56% 0.15 55)",
			heading: "oklch(46% 0.19 298)",
			link: "oklch(44% 0.16 195)",
			muted: "oklch(48% 0.06 296)",
			"code-bg": "oklch(91% 0.028 298)",
			"atmosphere-ink": "oklch(78% 0.06 295)",
			"guestbook-pattern-ink": "oklch(86% 0.039 296.5)",
			"matrix-rain": "oklch(58% 0.12 298)",
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
			primary: "oklch(82% 0.13 195)",
			secondary: "oklch(88% 0.09 240)",
			accent: "oklch(86% 0.13 182)",
			heading: "oklch(90% 0.12 185)",
			link: "oklch(80% 0.13 225)",
			muted: "oklch(72% 0.012 265)",
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
			primary: "oklch(48% 0.16 255)",
			secondary: "oklch(50% 0.05 257)",
			accent: "oklch(52% 0.12 200)",
			heading: "oklch(30% 0.13 250)",
			link: "oklch(44% 0.18 258)",
			muted: "oklch(46% 0.02 260)",
			"code-bg": "oklch(90% 0 0)",
			"atmosphere-ink": "oklch(74% 0.012 260)",
			"guestbook-pattern-ink": "oklch(79% 0.006 130)",
			"matrix-rain": "oklch(58% 0.06 258)",
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
			primary: "oklch(72% 0 0)",
			secondary: "oklch(52% 0 0)",
			accent: "oklch(82% 0 0)",
			heading: "oklch(94% 0 0)",
			link: "oklch(80% 0 0)",
			muted: "oklch(60% 0 0)",
			"code-bg": "oklch(8% 0 0)",
			"atmosphere-ink": "oklch(32% 0 0)",
			"guestbook-pattern-ink": "oklch(24% 0 0)",
			"matrix-rain": "oklch(28% 0 0)",
		},
		light: {
			"base-100": "oklch(100% 0 0)",
			"base-200": "oklch(97% 0 0)",
			"base-300": "oklch(94% 0 0)",
			"base-content": "oklch(12% 0 0)",
			primary: "oklch(20% 0 0)",
			secondary: "oklch(34% 0 0)",
			accent: "oklch(27% 0 0)",
			heading: "oklch(12% 0 0)",
			link: "oklch(28% 0 0)",
			muted: "oklch(48% 0 0)",
			"code-bg": "oklch(92% 0 0)",
			"atmosphere-ink": "oklch(78% 0 0)",
			"guestbook-pattern-ink": "oklch(79% 0 0)",
			"matrix-rain": "oklch(58% 0 0)",
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
			primary: "oklch(78% 0.14 197)",
			secondary: "oklch(70% 0.13 205)",
			accent: "oklch(84% 0.14 190)",
			heading: "oklch(90% 0.14 195)",
			link: "oklch(76% 0.15 210)",
			muted: "oklch(64% 0.02 205)",
			"code-bg": "oklch(11% 0.02 212)",
			"atmosphere-ink": "oklch(36% 0.04 210)",
			"guestbook-pattern-ink": "oklch(22.5% 0.031 211)",
			"matrix-rain": "oklch(30% 0.06 205)",
		},
		light: {
			"base-100": "oklch(99% 0.006 210)",
			"base-200": "oklch(95% 0.01 210)",
			"base-300": "oklch(88% 0.014 210)",
			"base-content": "oklch(22% 0.04 218)",
			primary: "oklch(46% 0.13 200)",
			secondary: "oklch(52% 0.1 205)",
			accent: "oklch(50% 0.12 195)",
			heading: "oklch(30% 0.13 210)",
			link: "oklch(42% 0.15 200)",
			muted: "oklch(48% 0.03 210)",
			"code-bg": "oklch(92% 0.012 210)",
			"atmosphere-ink": "oklch(78% 0.018 210)",
			"guestbook-pattern-ink": "oklch(79% 0.012 210)",
			"matrix-rain": "oklch(58% 0.06 205)",
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
			primary: "oklch(64% 0.17 22)",
			secondary: "oklch(54% 0.15 18)",
			accent: "oklch(70% 0.18 16)",
			heading: "oklch(72% 0.18 18)",
			link: "oklch(74% 0.17 40)",
			muted: "oklch(60% 0.02 22)",
			"code-bg": "oklch(10% 0.024 20)",
			"atmosphere-ink": "oklch(34% 0.05 22)",
			"guestbook-pattern-ink": "oklch(21% 0.037 21)",
			"matrix-rain": "oklch(28% 0.09 22)",
		},
		light: {
			"base-100": "oklch(99% 0.006 22)",
			"base-200": "oklch(96% 0.016 22)",
			"base-300": "oklch(90% 0.04 22)",
			"base-content": "oklch(28% 0.09 22)",
			primary: "oklch(52% 0.19 24)",
			secondary: "oklch(48% 0.17 18)",
			accent: "oklch(54% 0.19 28)",
			heading: "oklch(46% 0.19 22)",
			link: "oklch(50% 0.18 35)",
			muted: "oklch(48% 0.05 22)",
			"code-bg": "oklch(93% 0.02 22)",
			"atmosphere-ink": "oklch(78% 0.04 22)",
			"guestbook-pattern-ink": "oklch(79% 0.025 22)",
			"matrix-rain": "oklch(60% 0.11 22)",
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
	{ id: "base-100", light: "#eee7d9", dark: "#0f0a06" },
	{ id: "base-200", light: "#e4dac5", dark: "#19120c" },
	{ id: "base-300", light: "#d6c9ae", dark: "#251e16" },
	{ id: "base-content", light: "#4b321c", dark: "#e5e1d9" },
	{ id: "primary", light: "#975800", dark: "#e9b452" },
	{ id: "primary-content", light: "#fbf4e6", dark: "#231502" },
	{ id: "secondary", light: "#00717c", dark: "#7dccda" },
	{ id: "secondary-content", light: "#f1fbfc", dark: "#031a1e" },
	{ id: "accent", light: "#934400", dark: "#f9cf62" },
	{ id: "accent-content", light: "#fcf4e6", dark: "#261800" },
	{ id: "neutral", light: "#d5c9b5", dark: "#241e18" },
	{ id: "neutral-content", light: "#4f463c", dark: "#aca7a0" },
	{ id: "heading", light: "#934400", dark: "#f9cf62" },
	{ id: "link", light: "#975800", dark: "#e9b452" },
	{ id: "muted", light: "#635546", dark: "#968e83" },
	{ id: "code-bg", light: "#ddd3be", dark: "#1b150f" },
	{ id: "info", light: "#0070ab", dark: "#5bb0d7" },
	{ id: "info-content", light: "#edfbff", dark: "#001420" },
	{ id: "success", light: "#2a7449", dark: "#76be86" },
	{ id: "success-content", light: "#effdf3", dark: "#041608" },
	{ id: "warning", light: "#cd9130", dark: "#e8be62" },
	{ id: "warning-content", light: "#331b00", dark: "#271700" },
	{ id: "error", light: "#b33832", dark: "#dc665b" },
	{ id: "error-content", light: "#fff5f3", dark: "#fceeec" },
	{ id: "atmosphere-ink", light: "#b5aa92", dark: "#3f362d" },
	{ id: "guestbook-pattern-ink", light: "#c6bda8", dark: "#2a231c" },
	{ id: "matrix-rain", light: "#618d62", dark: "#223a23" },
];

export const hexLight: Record<string, string> = Object.fromEntries(hexColorValues.map((c) => [c.id, c.light]));
export const hexDark: Record<string, string> = Object.fromEntries(hexColorValues.map((c) => [c.id, c.dark]));
