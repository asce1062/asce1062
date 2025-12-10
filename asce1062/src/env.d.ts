/// <reference path="../.astro/types.d.ts" />
/// <reference types="vite-plugin-pwa/client" />

declare module "virtual:pwa-info" {
	export interface PwaInfo {
		webManifest: {
			href: string;
			useCredentials?: boolean;
		};
	}
	export const pwaInfo: PwaInfo | undefined;
}

// Music Service Environment Variables
interface ImportMetaEnv {
	readonly MUSIC_CLIENT_ID: string;
	readonly MUSIC_CLIENT_SECRET: string;
	readonly PUBLIC_MUSIC_CDN_URL: string;
	readonly PUBLIC_MUSIC_API_URL: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
