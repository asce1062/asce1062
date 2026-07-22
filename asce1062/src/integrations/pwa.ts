import type { AstroIntegration } from "astro";
import type { Plugin } from "vite";
import { VitePWA, type VitePWAOptions, type VitePluginPWAAPI } from "vite-plugin-pwa";

type PwaPluginFactory = typeof VitePWA;
type PwaPlugin = Plugin & { api: Pick<VitePluginPWAAPI, "generateSW"> };

export function createPwaIntegration(
	options: Partial<VitePWAOptions>,
	pluginFactory: PwaPluginFactory = VitePWA
): AstroIntegration {
	const plugins = pluginFactory(options);
	const pwaPlugin = plugins.find((plugin): plugin is PwaPlugin => plugin.name === "vite-plugin-pwa" && "api" in plugin);

	return {
		name: "alexmbugua:pwa",
		hooks: {
			"astro:config:setup": ({ updateConfig }) => {
				updateConfig({
					vite: {
						plugins,
					},
				});
			},
			"astro:build:done": async () => {
				await pwaPlugin?.api.generateSW();
			},
		},
	};
}
