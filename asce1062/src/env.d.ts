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
