import { test as base, expect } from "@playwright/test";

type Appearance = { theme: "dark" | "light"; flavor?: string };

type Fixtures = {
	/** Seed theme/flavor prefs before the first paint, as a returning visitor's would load. */
	appearance: (appearance: Appearance) => Promise<void>;
	pageErrors: string[];
};

export const test = base.extend<Fixtures>({
	// Auto fixture: any uncaught page error fails the test that caused it.
	pageErrors: [
		async ({ page }, use) => {
			const errors: string[] = [];
			page.on("pageerror", (error) => errors.push(error.message));
			await use(errors);
			expect(errors, "uncaught page errors").toEqual([]);
		},
		{ auto: true },
	],

	appearance: async ({ page }, use) => {
		await use(async ({ theme, flavor = "" }) => {
			await page.addInitScript(
				([theme, flavor]) => {
					localStorage.setItem("theme", theme);
					if (flavor) localStorage.setItem("theme-flavor", flavor);
				},
				[theme, flavor] as const
			);
		});
	},
});

export { expect };

/** Representative built pages: one per layout. */
export const PAGES = {
	home: "/",
	blogIndex: "/blog/",
	post: "/blog/2026-05-19-password-security-with-argon2id/",
	notesIndex: "/notes/",
	note: "/notes/2026-03-12-guiding-principles/",
	about: "/about/",
	tag: "/tags/security/",
	privacy: "/privacy/",
} as const;
