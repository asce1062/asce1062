/**
 * Design Tokens Registry
 *
 * Pure data registry of all design tokens used in the site.
 * This file does NOT read CSS at runtime - it's a static reference
 * that the /palette page uses to render swatches and documentation.
 *
 * The actual values come from src/styles/theme.css via CSS variables.
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
 * e.g., "base-100" → "--color-base-100"
 */
export function getCssVar(id: string): string {
	return `--color-${id}`;
}

/**
 * Derive content CSS variable from role id (if applicable)
 * - base-100, base-200, base-300 → "--color-base-content"
 * - base-content → null (no content var)
 * - others → "--color-{id}-content"
 */
export function getContentVar(id: string): string | null {
	if (id === "base-content") return null;
	if (id.startsWith("base-")) return "--color-base-content";
	if (id.endsWith("-content")) return null; // *-content IDs have no nested content var
	return `--color-${id}-content`;
}

export const colorRoles: ColorRole[] = [
	{
		id: "base-100",
		name: "Base 100",
		description: "Primary background, the foundation of your interface",
		tags: ["bg-base-100"],
	},
	{
		id: "base-200",
		name: "Base 200",
		description: "Secondary surfaces for visual hierarchy",
		tags: ["bg-base-200"],
	},
	{
		id: "base-300",
		name: "Base 300",
		description: "Tertiary elements and subtle boundaries",
		tags: ["bg-base-300", "border-base-300"],
	},
	{
		id: "base-content",
		name: "Base Content",
		description: "Default text color for readability on base surfaces",
		tags: ["text-base-content"],
	},
	{
		id: "primary",
		name: "Primary",
		description: "Brand color for primary actions and key interactions",
		tags: ["bg-primary", "text-primary"],
	},
	{
		id: "secondary",
		name: "Secondary",
		description: "Alternative emphasis for supporting actions",
		tags: ["bg-secondary", "text-secondary"],
	},
	{
		id: "accent",
		name: "Accent",
		description: "Highlights and special elements that pop",
		tags: ["bg-accent", "text-accent"],
	},
	{
		id: "neutral",
		name: "Neutral",
		description: "Muted elements for subtle, unobtrusive UI",
		tags: ["bg-neutral", "text-neutral-content"],
	},
	{
		id: "info",
		name: "Info",
		description: "Informational messages and helpful hints",
		tags: ["bg-info", "text-info"],
	},
	{
		id: "success",
		name: "Success",
		description: "Positive outcomes and confirmations",
		tags: ["bg-success", "text-success"],
	},
	{
		id: "warning",
		name: "Warning",
		description: "Cautions and alerts that need attention",
		tags: ["bg-warning", "text-warning"],
	},
	{
		id: "error",
		name: "Error",
		description: "Errors and destructive actions",
		tags: ["bg-error", "text-error"],
	},
];

// =============================================================================
// COLOR VALUES (OKLCH) - For ingredients table
// =============================================================================

export interface ColorValue {
	id: string;
	role: string;
	light: string;
	dark: string;
}

export const colorValues: ColorValue[] = [
	// Base
	{ id: "base-100", role: "Base 100", light: "oklch(91.637% 0.034 90.515)", dark: "oklch(14.076% 0.004 285.822)" },
	{ id: "base-200", role: "Base 200", light: "oklch(88.272% 0.049 91.774)", dark: "oklch(20.219% 0.004 308.229)" },
	{ id: "base-300", role: "Base 300", light: "oklch(84.133% 0.065 90.856)", dark: "oklch(23.219% 0.004 308.229)" },
	{ id: "base-content", role: "Base Content", light: "oklch(41% 0.112 45.904)", dark: "oklch(96% 0.059 95.617)" },
	// Semantic
	{ id: "primary", role: "Primary", light: "oklch(80% 0.114 19.571)", dark: "oklch(70% 0.191 22.216)" },
	{ id: "primary-content", role: "Primary Content", light: "oklch(39% 0.141 25.723)", dark: "oklch(25% 0.092 26.042)" },
	{ id: "secondary", role: "Secondary", light: "oklch(92% 0.084 155.995)", dark: "oklch(79% 0.209 151.711)" },
	{
		id: "secondary-content",
		role: "Secondary Content",
		light: "oklch(44% 0.119 151.328)",
		dark: "oklch(26% 0.065 152.934)",
	},
	{ id: "accent", role: "Accent", light: "oklch(68% 0.162 75.834)", dark: "oklch(85% 0.199 91.936)" },
	{ id: "accent-content", role: "Accent Content", light: "oklch(41% 0.112 45.904)", dark: "oklch(28% 0.066 53.813)" },
	{ id: "neutral", role: "Neutral", light: "oklch(84.1% 0.081 73.639)", dark: "oklch(16% 0.019 329.708)" },
	{ id: "neutral-content", role: "Neutral Content", light: "oklch(44% 0.011 73.639)", dark: "oklch(70% 0.01 56.259)" },
	// Status
	{ id: "info", role: "Info", light: "oklch(58% 0.158 241.966)", dark: "oklch(70% 0.165 254.624)" },
	{ id: "info-content", role: "Info Content", light: "oklch(96% 0.059 95.617)", dark: "oklch(28% 0.091 267.935)" },
	{ id: "success", role: "Success", light: "oklch(51% 0.096 186.391)", dark: "oklch(43% 0.078 188.216)" },
	{ id: "success-content", role: "Success Content", light: "oklch(96% 0.059 95.617)", dark: "oklch(92% 0.12 95.746)" },
	{ id: "warning", role: "Warning", light: "oklch(64% 0.222 41.116)", dark: "oklch(47% 0.157 37.304)" },
	{ id: "warning-content", role: "Warning Content", light: "oklch(96% 0.059 95.617)", dark: "oklch(92% 0.12 95.746)" },
	{ id: "error", role: "Error", light: "oklch(70% 0.191 22.216)", dark: "oklch(63% 0.237 25.331)" },
	{ id: "error-content", role: "Error Content", light: "oklch(40% 0.123 38.172)", dark: "oklch(26% 0.079 36.259)" },
];
