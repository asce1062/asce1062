/**
 * Serialise a flat style object into an inline `style` attribute value.
 *
 * Callers may pass values that trace back to stored data (guestbook entry
 * styles), so a declaration can never be allowed to smuggle in a second one.
 * Astro already escapes the attribute for HTML; this guards the CSS layer.
 * Declarations that fail validation are dropped, the rest are kept.
 */

/** camelCase longhand (`borderRadius`), kebab-case, or a custom property. */
const STANDARD_PROPERTY = /^-?[a-zA-Z][a-zA-Z0-9-]*$/;
const CUSTOM_PROPERTY = /^--[a-zA-Z0-9_-]+$/;

/**
 * Characters that can end the declaration, open a block or comment, start an
 * escape, or break out of the attribute's markup context.
 */
const UNSAFE_VALUE = /[;{}<>\\\p{Cc}]|\/\*|\*\//u;

function toPropertyName(key: string): string | null {
	// Custom properties are case-sensitive and pass through untouched.
	if (CUSTOM_PROPERTY.test(key)) return key;
	if (!STANDARD_PROPERTY.test(key)) return null;
	return key.replace(/([A-Z])/g, "-$1").toLowerCase();
}

/** Unclosed quotes or brackets would swallow the declarations that follow. */
function isBalanced(value: string): boolean {
	let depth = 0;
	let quote: string | null = null;
	for (const char of value) {
		if (quote) {
			if (char === quote) quote = null;
			continue;
		}
		if (char === '"' || char === "'") quote = char;
		else if (char === "(") depth += 1;
		else if (char === ")") depth -= 1;
		if (depth < 0) return false;
	}
	return depth === 0 && quote === null;
}

function isSafeValue(value: unknown): value is string {
	if (typeof value !== "string") return false;
	const trimmed = value.trim();
	return trimmed.length > 0 && !UNSAFE_VALUE.test(trimmed) && isBalanced(trimmed);
}

export function serializeStyle(style: Record<string, string>): string {
	return Object.entries(style)
		.flatMap(([key, value]) => {
			const property = toPropertyName(key);
			if (property === null || !isSafeValue(value)) return [];
			return [`${property}: ${value}`];
		})
		.join("; ");
}
