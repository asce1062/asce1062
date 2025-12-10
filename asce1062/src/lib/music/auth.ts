/**
 * Server-side Music Service Authentication Helper
 * Handles SDK initialization and authentication for Astro pages
 */

import { MusicServiceClient } from "@asce1062/music-service-sdk";
import type { Album, Track, TrackerModule, Manifest } from "@/types/music";

/**
 * Cached SDK client instance (server-side only)
 * Prevents multiple authentications during build
 */
let cachedClient: MusicServiceClient | null = null;

/**
 * Initialize and authenticate the Music Service SDK
 * Used server-side in Astro pages for data fetching
 *
 * @returns Authenticated MusicServiceClient instance
 * @throws Error if authentication fails
 *
 * @example
 * ```astro
 * ---
 * import { initMusicClient } from '@/lib/music/auth';
 *
 * const client = await initMusicClient();
 * const albums = await client.getAlbums();
 * ---
 * ```
 */
export async function initMusicClient(): Promise<MusicServiceClient> {
	// Return cached client if already authenticated
	if (cachedClient) {
		return cachedClient;
	}

	// Validate environment variables
	const clientId = import.meta.env.MUSIC_CLIENT_ID;
	const clientSecret = import.meta.env.MUSIC_CLIENT_SECRET;

	if (!clientId || !clientSecret) {
		throw new Error("Missing required environment variables: MUSIC_CLIENT_ID and/or MUSIC_CLIENT_SECRET");
	}

	try {
		// Initialize SDK client
		const client = new MusicServiceClient({
			clientId,
			clientSecret,
			debug: import.meta.env.DEV, // Enable debug mode in development
		});

		// Authenticate with the service
		await client.authenticate();

		// Cache the client for reuse
		cachedClient = client;

		return client;
	} catch (error) {
		console.error("❌ Music Service authentication failed:", error);
		throw new Error(
			`Failed to authenticate Music Service: ${error instanceof Error ? error.message : "Unknown error"}`
		);
	}
}

/**
 * Fetch all albums from the music service
 * Cached during build time
 *
 * @returns Array of albums
 */
export async function fetchAlbums(): Promise<Album[]> {
	try {
		const client = await initMusicClient();
		const albums = await client.getAllAlbums();
		return albums;
	} catch (error) {
		console.error("Failed to fetch albums:", error);
		return [];
	}
}

/**
 * Fetch all tracks from the music service
 * Optionally filter by album
 *
 * @param albumId - Optional album ID to filter tracks
 * @returns Array of tracks
 */
export async function fetchTracks(albumId?: string): Promise<Track[]> {
	try {
		const client = await initMusicClient();
		const tracks = albumId ? await client.getAlbumTracks(albumId) : await client.getAllTracks();
		return tracks;
	} catch (error) {
		console.error("Failed to fetch tracks:", error);
		return [];
	}
}

/**
 * Fetch all tracker modules from the music service
 *
 * @returns Array of tracker modules
 */
export async function fetchTrackerModules(): Promise<TrackerModule[]> {
	try {
		const client = await initMusicClient();
		const trackers = await client.getAllTrackers();
		return trackers;
	} catch (error) {
		console.error("Failed to fetch tracker modules:", error);
		return [];
	}
}

/**
 * Fetch catalog manifest (stats)
 *
 * @returns Catalog manifest
 */
export async function fetchManifest(): Promise<Manifest | null> {
	try {
		const client = await initMusicClient();
		const manifest = await client.getManifest();
		return manifest;
	} catch (error) {
		console.error("Failed to fetch manifest:", error);
		return null;
	}
}

/**
 * Utility: Get full CDN URL from relative path
 *
 * @param relativePath - Relative path from CDN (e.g., "albums/cover.jpg")
 * @returns Full CDN URL
 */
export function getCDNUrl(relativePath: string): string {
	const cdnUrl = import.meta.env.PUBLIC_MUSIC_CDN_URL;
	if (!cdnUrl) {
		throw new Error("PUBLIC_MUSIC_CDN_URL environment variable is not set");
	}

	// Remove leading slash from relative path if present
	const cleanPath = relativePath.startsWith("/") ? relativePath.slice(1) : relativePath;

	return `${cdnUrl}/${cleanPath}`;
}

/**
 * Utility: Format duration from seconds to human-readable format
 *
 * @param seconds - Duration in seconds
 * @returns Formatted string (MM:SS or HH:MM:SS)
 *
 * @example
 * formatDuration(65) // "1:05"
 * formatDuration(3665) // "1:01:05"
 */
export function formatDuration(seconds: number): string {
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const secs = Math.floor(seconds % 60);

	if (hours > 0) {
		return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
	}

	return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Utility: Format file size to human-readable format
 *
 * @param bytes - File size in bytes
 * @returns Formatted string (e.g., "3.5 MB")
 */
export function formatFileSize(bytes: number): string {
	const units = ["B", "KB", "MB", "GB"];
	let size = bytes;
	let unitIndex = 0;

	while (size >= 1024 && unitIndex < units.length - 1) {
		size /= 1024;
		unitIndex++;
	}

	return `${size.toFixed(1)} ${units[unitIndex]}`;
}
