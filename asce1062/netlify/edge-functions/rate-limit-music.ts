/**
 * Rate limit for the music API.
 *
 * Every /api/music request is proxied to the Navidrome server with the
 * site's credentials, so an unthrottled client could use the site to hammer
 * it. Netlify enforces `config.rateLimit` at the edge; the handler does
 * nothing and returning undefined passes the request on unchanged.
 *
 * 600 requests a minute per IP leaves room for a listener: opening a long
 * playlist loads one cover per track, and seeking sends several ranged
 * stream requests. Over the limit, Netlify answers 429.
 *
 * Check the deploy log's post-processing stage after changing this: an
 * invalid rule is skipped without failing the deploy.
 */
export default (): undefined => undefined;

export const config = {
	path: "/api/music/*",
	rateLimit: {
		windowLimit: 600,
		windowSize: 60,
		aggregateBy: ["ip", "domain"],
	},
};
