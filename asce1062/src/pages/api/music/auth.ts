/**
 * Music Service Authentication API Route
 * Provides client credentials for Music Service API authentication
 *
 * ARCHITECTURE (for Personal Project):
 * The Music Service API uses Client Credentials (x-client-id, x-client-secret headers)
 * and returns CloudFront signed cookies for CDN access. This endpoint provides the
 * credentials needed by the SDK to authenticate with the Music Service API.
 *
 * SECURITY MODEL (Pragmatic):
 *
 * Model: We're preventing abuse and unplanned costs, we're NOT preventing access to content
 * - Primary concern: automated bots, hotlinking, bandwidth theft → CloudFront costs
 * - Content is intentionally public (personal music to share)
 * - Credentials are read-only and time-limited
 *
 * Current Protections:
 * Origin validation (Music API): credentials only work from allowed domains
 * CloudFront signed cookies (2hr expiry, auto refreshed): time-limited CDN access
 * Rate limiting (Music API): prevents request spam
 * Read-only scope: cannot modify/delete content
 * AWS cost monitoring: alerts if usage spikes
 *
 * Acceptable Risk:
 * - Actor could extract credentials to listen to music directly
 * - worst case = the catalog is accessed, it's already meant to be public
 *
 */

import type { APIRoute } from "astro";

export const GET: APIRoute = async () => {
	try {
		const clientId = process.env.MUSIC_CLIENT_ID;
		const clientSecret = process.env.MUSIC_CLIENT_SECRET;

		if (!clientId || !clientSecret) {
			throw new Error("Missing music service credentials");
		}

		return new Response(
			JSON.stringify({
				success: true,
				token: clientSecret,
				expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now
			}),
			{
				status: 200,
				headers: {
					"Content-Type": "application/json",
					// Prevent caching of credentials
					"Cache-Control": "no-store, no-cache, must-revalidate, private",
					Pragma: "no-cache",
					Expires: "0",
				},
			}
		);
	} catch (error) {
		console.error("Authentication failed:", error);
		return new Response(
			JSON.stringify({
				error: error instanceof Error ? error.message : "Authentication failed",
			}),
			{
				status: 500,
				headers: {
					"Content-Type": "application/json",
				},
			}
		);
	}
};
