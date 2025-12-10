/**
 * Music SDK Service
 * Handles SDK initialization, authentication, and data loading
 */

import { MusicServiceClient } from "@asce1062/music-service-sdk";
import { musicStore } from "@/scripts/music/MusicStore";
import type { Album, Track, TrackerModule, Manifest } from "@/types/music";

export interface LibraryData {
	albums: Album[];
	tracks: Track[];
	trackerModules: TrackerModule[];
	manifest: Manifest;
}

// Global initialization promise to prevent multiple instances
let initializationPromise: Promise<MusicServiceClient> | null = null;

export class MusicSDKService {
	private sdk: MusicServiceClient | null = null;

	/**
	 * Initialize the SDK and authenticate
	 * Uses a global promise to ensure only ONE instance is ever created
	 */
	async initialize(): Promise<void> {
		// If SDK already exists globally, reuse it
		if (window.musicSDK) {
			this.sdk = window.musicSDK;
			return;
		}

		// If initialization is in progress, wait for it
		if (initializationPromise) {
			this.sdk = await initializationPromise;
			return;
		}

		// Start new initialization
		initializationPromise = this.createSDKInstance();

		try {
			this.sdk = await initializationPromise;
			window.musicSDK = this.sdk;
		} catch (error) {
			// Clear promise on error so it can be retried
			initializationPromise = null;
			throw error;
		}
	}

	/**
	 * Create and authenticate a new SDK instance
	 */
	private async createSDKInstance(): Promise<MusicServiceClient> {
		const sessionToken = await this.getSessionToken();
		const apiUrl = import.meta.env.PUBLIC_MUSIC_API_URL || "https://music-api.alexmbugua.me/v1";

		const config = {
			clientId: import.meta.env.PUBLIC_MUSIC_CLIENT_ID || "alexmbugua-personal",
			clientSecret: sessionToken,
			apiEndpoint: apiUrl,
			debug: import.meta.env.DEV,
			enableGapless: false, // Temporarily disable gapless to fix preload errors
		};

		const sdk = new MusicServiceClient(config);
		await sdk.authenticate();

		return sdk;
	}

	/**
	 * Get or refresh session token
	 * Tokens are JWT with 2-hour expiry, signed with HMAC-SHA256
	 */
	private async getSessionToken(): Promise<string> {
		// Check for cached token
		const cachedToken = localStorage.getItem("music_session_token");
		const expiresAt = localStorage.getItem("music_session_expires");

		if (cachedToken && expiresAt) {
			const expiryTime = new Date(expiresAt).getTime();
			const now = Date.now();

			// Return cached token if it has more than 5 minutes left
			// (refresh 5 minutes before expiry to prevent mid-session expiration)
			if (expiryTime - now > 5 * 60 * 1000) {
				return cachedToken;
			}
		}

		// Fetch new JWT from API
		const authResponse = await fetch("/api/music/auth");
		if (!authResponse.ok) {
			throw new Error("Failed to fetch session token");
		}

		const authData = await authResponse.json();
		if (!authData.success || !authData.token) {
			throw new Error("Invalid authentication response");
		}

		// Cache the new JWT
		localStorage.setItem("music_session_token", authData.token);
		if (authData.expiresAt) {
			localStorage.setItem("music_session_expires", authData.expiresAt.toString());
		}

		return authData.token;
	}

	/**
	 * Load all library data (albums, tracks, trackers, manifest)
	 */
	async loadLibraryData(): Promise<LibraryData> {
		// Use global SDK if this instance's SDK is not initialized
		const sdk = this.sdk || window.musicSDK;

		if (!sdk) {
			throw new Error("SDK not initialized. Call initialize() first or ensure global SDK is available.");
		}

		try {
			musicStore.setLoading(true);

			// Load all data in parallel
			const [albums, tracks, trackerModules, manifest] = await Promise.all([
				sdk.getAllAlbums(),
				sdk.getAllTracks(),
				sdk.getAllTrackers(),
				sdk.getManifest(),
			]);

			// Store in music store
			musicStore.setLibraryData({
				albums,
				tracks,
				trackerModules,
				manifest,
			});

			return { albums, tracks, trackerModules, manifest };
		} catch (error) {
			console.error("Failed to load library data:", error);
			musicStore.setError("Failed to load music library");
			throw error;
		} finally {
			musicStore.setLoading(false);
		}
	}

	/**
	 * Get the SDK instance (returns global SDK if local instance not initialized)
	 */
	getSDK(): MusicServiceClient | null {
		return this.sdk || window.musicSDK || null;
	}

	/**
	 * Check if SDK is initialized (checks both local and global)
	 */
	isInitialized(): boolean {
		return this.sdk !== null || window.musicSDK !== undefined;
	}
}
