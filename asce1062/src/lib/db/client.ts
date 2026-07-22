import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

type DatabaseConfigInput = {
	url?: string;
	authToken?: string;
	production: boolean;
};

export function resolveDatabaseConfig({ url, authToken, production }: DatabaseConfigInput) {
	if (production && (!url || !authToken)) {
		throw new Error("ASTRO_DB_REMOTE_URL and ASTRO_DB_APP_TOKEN are required together in production");
	}
	if ((url && !authToken) || (!url && authToken)) {
		throw new Error("ASTRO_DB_REMOTE_URL and ASTRO_DB_APP_TOKEN must be configured together");
	}

	return { url: url || "file:.astro/content.db", authToken };
}

const production = import.meta.env?.PROD || process.env.NODE_ENV === "production" || process.env.NETLIFY === "true";
const config = resolveDatabaseConfig({
	url: process.env.ASTRO_DB_REMOTE_URL || (!production ? import.meta.env?.ASTRO_DB_REMOTE_URL : undefined),
	authToken: process.env.ASTRO_DB_APP_TOKEN || (!production ? import.meta.env?.ASTRO_DB_APP_TOKEN : undefined),
	production,
});

export const databaseTarget = config.url;
export const databaseClient = createClient(config);
export const db = drizzle(databaseClient, { schema });
