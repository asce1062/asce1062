/**
 * Migration script: import Netlify Forms CSV export into Astro DB.
 *
 * Usage:
 *   1. Export guestbook entries from Netlify Forms dashboard as CSV
 *   2. Place the CSV at db/guestbook.csv
 *   3. Run: npx astro db execute db/import-csv.ts --remote
 */
import { db, Guestbook } from "astro:db";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Papa from "papaparse";

interface NetlifyFormRow {
	name: string;
	email: string;
	url: string;
	message: string;
	created_at: string;
}

export default async function () {
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
