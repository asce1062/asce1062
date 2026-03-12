/**
 * Console Easter Egg
 *
 * Prints a pre-computed figlet ASCII art greeting in the browser console.
 * Art is generated at build time (scripts/generate-ascii.mjs)
 *
 * Fires on every page navigation. Initial load and every Astro soft navigation.
 * Picks a new random variant each time, so the font changes as you move around the site.
 *
 * Colors are sourced from design-tokens.ts (hexDark)
 *
 * Note: there is no reliable cross-browser API to detect when DevTools is opened,
 * so we fire on page load/navigation, the closest practical equivalent.
 */
import asciiData from "@/data/ascii-art.json";

type AsciiVariant = { readonly text: string; readonly font: string; readonly art: string };
const asciiVariants = (asciiData as AsciiVariant[]).filter((v) => v.text !== "404");
import { hexDark } from "@/config/design-tokens";

// ── Palette (dark theme) ──
const C = {
	primary: hexDark["primary"],
	secondary: hexDark["secondary"],
	accent: hexDark["accent"],
	warning: hexDark["warning"],
	success: hexDark["success"],
	info: hexDark["info"],
	baseContent: hexDark["base-content"],
	neutralContent: hexDark["neutral-content"],
} as const;

const mono = "font-family:monospace;";

// ── Narrow local type for the User-Agent Client Hints API ──
// navigator.userAgentData is Chromium-only and experimental.
// We type it locally rather than using `any` or polluting globals.
interface UADataShim {
	platform: string;
}

// ── Helpers ──

function pickRandom<T>(arr: readonly T[]): T | undefined {
	if (arr.length === 0) return undefined;
	return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Progressive-enhancement platform detection.
 *
 * 1. Prefer `navigator.userAgentData.platform`
 * 		- structured, no parsing needed.
 *    - Chromium-only (Chrome, Edge, Opera).
 * 		- Firefox and Safari return undefined.
 *
 * 2. Fall back to a deliberately coarse UA-string heuristic.
 *    We check only broad OS families, not browser versions, device models, etc.
 *    Android/iOS are tested before Linux/Macintosh because Android UAs include
 *    "Linux" and modern iPads can include "Macintosh".
 *
 * Label is "Platform:" not "OS:" (honest about the best-effort nature).
 */
function getPlatformLabel(): string {
	const uaData = (navigator as Navigator & { userAgentData?: UADataShim }).userAgentData;
	if (uaData?.platform) return uaData.platform;

	// Coarse fallback. update as needed
	const ua = navigator.userAgent;
	if (ua.includes("Android")) return "Android";
	if (ua.includes("iPhone") || ua.includes("iPad") || ua.includes("iPod")) return "iOS";
	if (ua.includes("Windows NT")) return "Windows";
	if (ua.includes("Macintosh")) return "macOS";
	if (ua.includes("Linux")) return "Linux";
	return "Unknown";
}

function getTheme(): string {
	return document.documentElement.getAttribute("data-theme") ?? "unknown";
}

/** Best-effort SW status. never throws, never breaks the easter egg. */
async function getSwStatus(): Promise<string> {
	try {
		if (!("serviceWorker" in navigator)) return "Not supported";
		const reg = await navigator.serviceWorker.getRegistration();
		if (!reg) return "Not registered";
		if (reg.active) return `Active \u2014 scope: ${reg.scope}`;
		if (reg.installing) return "Installing\u2026";
		return "Waiting";
	} catch {
		return "Unavailable";
	}
}

// ── Main ──

async function printEgg(): Promise<void> {
	const variant = pickRandom(asciiVariants);

	const platform = getPlatformLabel();
	const lang = navigator.language ?? "unknown";
	const network = navigator.onLine ? "Online" : "Offline";
	const theme = getTheme();
	const sw = await getSwStatus();

	const lbl = (s: string) => s.padEnd(14);
	const div = "\u2500".repeat(28);
	const swColor = sw.startsWith("Active") ? C.success : C.info;

	// ── Single console.log. one source location, no noise ──
	// Order: prompt → blank → [font] → art → blank → divider → info → closing
	const parts: string[] = [];
	const styles: string[] = [];

	// prompt. username matches the text of the randomly selected art variant
	const promptUser = variant?.text ?? "asce1062";
	parts.push(`%c${promptUser}%c@%calexmbugua.me%c:~$ %cneofetch%c_\n\n`);
	styles.push(
		`color:${C.primary};${mono}font-weight:bold;`, // username
		`color:${C.neutralContent};${mono}`, // @
		`color:${C.secondary};${mono}font-weight:bold;`, // alexmbugua.me
		`color:${C.accent};${mono}font-weight:bold;`, // :~$
		`color:${C.warning};${mono}`, // neofetch
		`color:${C.neutralContent};${mono}` // _
	);

	// [font] + art
	if (variant) {
		parts.push(`%c[${variant.font}]\n%c${variant.art.trimEnd()}\n\n`);
		styles.push(
			`color:${C.neutralContent};${mono}font-style:italic;`, // [font]
			`color:${C.secondary};${mono}line-height:1.3;` // art
		);
	}

	// divider + info rows + closing
	parts.push(
		`%c${div}\n`,
		`%c${lbl("Platform:")}%c${platform}\n`,
		`%c${lbl("Language:")}%c${lang}\n`,
		`%c${lbl("Network:")}%c${network}\n`,
		`%c${lbl("Theme:")}%c${theme}\n`,
		`%c${lbl("SW:")}%c${sw}\n`,
		`%c${div}\n\n`,
		`%cPoking around the source? %cI\u2019m happy you\u2019re here ^^\n%cSay hi \u2192 %chttps://alexmbugua.me/hello`
	);
	styles.push(
		`color:${C.neutralContent};${mono}`, // divider
		`color:${C.baseContent};${mono}`, // Platform: key
		`color:${C.info};${mono}`, // platform val
		`color:${C.baseContent};${mono}`, // Language: key
		`color:${C.info};${mono}`, // lang val
		`color:${C.baseContent};${mono}`, // Network: key
		`color:${C.info};${mono}`, // network val
		`color:${C.baseContent};${mono}`, // Theme: key
		`color:${C.info};${mono}`, // theme val
		`color:${C.baseContent};${mono}`, // SW: key
		`color:${swColor};${mono}`, // sw val
		`color:${C.neutralContent};${mono}`, // divider
		`color:${C.baseContent};${mono}`, // "Poking around…"
		`color:${C.primary};${mono}`, // "I'm happy…"
		`color:${C.baseContent};${mono}`, // "Say hi →"
		`color:${C.success};${mono}` // URL
	);

	console.log(parts.join(""), ...styles);
}

// astro:page-load fires on both initial load and every soft navigation (ClientRouter),
// so this single listener covers all cases without double-firing.
// Using a named function reference means re-evaluating this module (unlikely in Astro's
// bundling model) would not stack duplicate listeners.
document.addEventListener("astro:page-load", printEgg);
