/**
 * Migration script: import a Netlify Forms CSV export into the guestbook database.
 *
 * Usage:
 *   1. Export guestbook entries from Netlify Forms dashboard as CSV
 *   2. Place the CSV at db/guestbook.csv
 *   3. Set ASTRO_DB_REMOTE_URL and ASTRO_DB_APP_TOKEN for the target database
 *   4. Run: npx tsx db/import-csv.ts
 *
 * Fresh databases only: this script assigns IDs beginning at 1 and will fail
 * rather than overwrite existing rows.
 */
import { db } from "../src/lib/db/client";
import { Guestbook } from "../src/lib/db/schema";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Papa from "papaparse";
import { count } from "drizzle-orm";

interface NetlifyFormRow {
	name: string;
	email: string;
	url: string;
	message: string;
	created_at: string;
}

async function importCsv() {
	const [{ existingRows }] = await db.select({ existingRows: count() }).from(Guestbook);
	if (existingRows > 0) throw new Error("CSV import requires an empty Guestbook table");

	const csvPath = resolve("db/guestbook.csv");
	const raw = readFileSync(csvPath, "utf-8");

	const { data, errors } = Papa.parse<NetlifyFormRow>(raw, {
		header: true,
		skipEmptyLines: true,
	});

	if (errors.length > 0) {
		console.warn("CSV parse warnings:");
		for (const err of errors) {
			console.warn(`  Row ${err.row}: ${err.message}`);
		}
	}

	const entries = data
		.filter((row) => row.name && row.message)
		.map((row, i) => ({
			id: i + 1,
			name: row.name,
			email: row.email || null,
			url: row.url || null,
			message: row.message,
			timestamp: new Date(row.created_at),
			isSpam: false,
		}));

	console.warn(`Importing ${entries.length} guestbook entries...`);

	for (const entry of entries) {
		console.warn(`  → ${entry.name} (${entry.timestamp.toISOString()})`);
	}

	await db.insert(Guestbook).values(entries);

	console.warn(`Done! ${entries.length} entries imported.`);
}

await importCsv();
