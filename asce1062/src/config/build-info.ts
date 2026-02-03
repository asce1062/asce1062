/**
 * Build-time information
 * These values are evaluated once during the build process
 */

/** Build timestamp - guaranteed to be build-time, not request-time */
export const BUILD_TIMESTAMP = new Date().toISOString();

/** Node.js major version (for display purposes only) */
export const NODE_MAJOR_VERSION =
	typeof process !== "undefined" && process.versions?.node ? process.versions.node.split(".")[0] : null;
