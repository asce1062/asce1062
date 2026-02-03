/**
 * Package dependency information
 *
 * Centralizes package.json access to avoid direct imports in pages.
 * This pattern is more robust across different TS/Vite configurations.
 */
import packageJson from "../../package.json";

/** Get a dependency version from dependencies or devDependencies */
function getVersion(pkg: string): string {
	return (
		(packageJson.dependencies as Record<string, string>)?.[pkg] ??
		(packageJson.devDependencies as Record<string, string>)?.[pkg] ??
		"unknown"
	);
}

export const DEPS = {
	astro: getVersion("astro"),
	tailwind: getVersion("tailwindcss"),
	typescript: getVersion("typescript"),
	mdx: getVersion("@astrojs/mdx"),
} as const;

/** Whether to show Node.js version on public pages (mild fingerprinting risk) */
export const SHOW_NODE_VERSION = false;
