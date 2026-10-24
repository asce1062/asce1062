import type { Client } from "@libsql/client";
import { readdir, readFile } from "node:fs/promises";

const MIGRATION_FILE = /^\d{4}_[\w-]+\.sql$/;

/**
 * Apply every migration in `directory` not yet recorded in `_migrations`, in
 * filename order. Each runs in its own write transaction together with its
 * record, so a failed migration leaves neither half behind and a re-run picks
 * up where the last one stopped. Statements like ALTER TABLE ADD COLUMN cannot
 * be repeated, which is why applied files are tracked instead of re-run.
 *
 * Returns the names of the migrations applied by this call.
 */
export async function applyMigrations(client: Client, directory: URL): Promise<string[]> {
	await client.execute(`CREATE TABLE IF NOT EXISTS "_migrations" ("name" text PRIMARY KEY, "appliedAt" text NOT NULL)`);
	const applied = new Set(
		(await client.execute(`SELECT "name" FROM "_migrations"`)).rows.map((row) => String(row.name))
	);
	const pending = (await readdir(directory)).filter((name) => MIGRATION_FILE.test(name) && !applied.has(name)).sort();

	for (const name of pending) {
		const sql = await readFile(new URL(name, directory), "utf8");
		const tx = await client.transaction("write");
		try {
			await tx.executeMultiple(sql);
			await tx.execute({
				sql: `INSERT INTO "_migrations" ("name", "appliedAt") VALUES (?, ?)`,
				args: [name, new Date().toISOString()],
			});
			await tx.commit();
		} catch (err) {
			// A rollback error would mask the migration error, which is the one to report.
			await tx.rollback().catch(() => undefined);
			throw new Error(`Migration ${name} failed`, { cause: err });
		} finally {
			tx.close();
		}
	}
	return pending;
}
