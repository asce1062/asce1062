import { describe, expect, it, vi } from "vitest";
import type { VitePWA } from "vite-plugin-pwa";
import { createPwaIntegration } from "../pwa";

describe("createPwaIntegration", () => {
	it("registers the vite-plugin-pwa plugin set with Astro", () => {
		const integration = createPwaIntegration({ manifest: false });
		const updateConfig = vi.fn();
		const setup = integration.hooks["astro:config:setup"];

		expect(setup).toBeTypeOf("function");
		setup?.({ updateConfig } as unknown as Parameters<NonNullable<typeof setup>>[0]);

		expect(updateConfig).toHaveBeenCalledOnce();
		const update = updateConfig.mock.calls[0]?.[0];
		expect(update.vite.plugins.map((plugin: { name: string }) => plugin.name)).toEqual([
			"vite-plugin-pwa",
			"vite-plugin-pwa:info",
			"vite-plugin-pwa:build",
			"vite-plugin-pwa:dev-sw",
			"vite-plugin-pwa:pwa-assets",
		]);
	});

	it("generates the service worker after Astro finishes building", async () => {
		const generateSW = vi.fn();
		const pluginFactory = vi.fn(() => [{ name: "vite-plugin-pwa", api: { generateSW } }]) as unknown as typeof VitePWA;
		const integration = createPwaIntegration({ manifest: false }, pluginFactory);
		const buildDone = integration.hooks["astro:build:done"];

		expect(buildDone).toBeTypeOf("function");
		await buildDone?.({} as Parameters<NonNullable<typeof buildDone>>[0]);

		expect(generateSW).toHaveBeenCalledOnce();
	});
});
