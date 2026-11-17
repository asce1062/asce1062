/**
 * Rate limit for the admin area.
 *
 * Netlify enforces `config.rateLimit` at the edge, before the request reaches
 * the SSR function, so a client guessing the admin token is cut off without
 * costing function time. The handler itself does nothing: returning undefined
 * passes the request on unchanged.
 *
 * 300 requests a minute per IP stays above one person moderating, even with
 * the live search sending up to three requests a second while typing, and
 * far below what guessing a token needs. Over the limit, Netlify answers 429.
 *
 * Code-based rules match by path only, so GET and POST share the budget.
 * Check the deploy log's post-processing stage after changing this: an
 * invalid rule is skipped without failing the deploy.
 */
export default (): undefined => undefined;

export const config = {
	path: ["/admin", "/admin/*"],
	rateLimit: {
		windowLimit: 300,
		windowSize: 60,
		aggregateBy: ["ip", "domain"],
	},
};
