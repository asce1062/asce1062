/// <reference path="../.astro/types.d.ts" />
/// <reference types="@astrojs/db" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
	// GitHub
	readonly GITHUB_PAT: string | undefined;

	// Astro DB (Turso)
	readonly ASTRO_DB_REMOTE_URL: string | undefined;
	readonly ASTRO_DB_APP_TOKEN: string | undefined;

	// Build
	readonly COMMIT_REF: string | undefined;

	// Admin
	readonly ADMIN_TOKEN: string | undefined;

	// Guestbook moderation
	readonly GUESTBOOK_HASH_PEPPER: string | undefined;

	// Email notifications (Resend)
	readonly RESEND_API_KEY: string | undefined;
	/** Verified sender with display name, e.g. "Guestbook <guestbook@alexmbugua.me>" */
	readonly GUESTBOOK_FROM_EMAIL: string | undefined;
	/** Admin recipient; falls back to SOCIAL.email */
	readonly GUESTBOOK_NOTIFY_TO: string | undefined;
	/** Dedicated reply-to alias for copy emails; falls back to GUESTBOOK_NOTIFY_TO */
	readonly GUESTBOOK_REPLY_TO: string | undefined;
	/** Per-attempt Resend fetch timeout in ms (default 10000, min 1000) */
	readonly GUESTBOOK_EMAIL_TIMEOUT_MS: string | undefined;
	/** Max retries for 429/5xx Resend errors (default 2, max 5) */
	readonly GUESTBOOK_EMAIL_RETRIES: string | undefined;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}

declare module "virtual:pwa-info" {
	export interface PwaInfo {
		webManifest: {
			href: string;
			useCredentials?: boolean;
		};
	}
	export const pwaInfo: PwaInfo | undefined;
}
