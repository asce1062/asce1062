/**
 * Global Music Initialization
 * Ensures MusicSDK and PlayerController are available site-wide
 */

import { PlayerController } from "./music/PlayerController";
import { MusicSDKService } from "@/lib/music/services/MusicSDKService";

/**
 * Initialize global music SDK and player
 * This ensures the SDK and player are available on all pages, not just /music
 */
export async function initGlobalMusicPlayer(): Promise<void> {
	try {
		// Step 1: Initialize SDK if not already done
		if (!window.musicSDK) {
			const sdkService = new MusicSDKService();
			await sdkService.initialize();
		}

		// Step 2: Initialize PlayerController if not already done
		if (!window.musicPlayer) {
			const player = new PlayerController();
			await player.init();
			window.musicPlayer = player;
		}
	} catch (error) {
		console.error("❌ Failed to initialize global music system:", error);
	}
}
