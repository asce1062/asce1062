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
	const candidates = (await readdir(directory)).filter((name) => MIGRATION_FILE.test(name)).sort();
	const applied: string[] = [];

	for (const name of candidates) {
		const sql = await readFile(new URL(name, directory), "utf8");
		const tx = await client.transaction("write");
		try {
			// Checked under the write lock, so a concurrent run that got here first
			// is seen and its migration is skipped rather than applied twice.
			const done = await tx.execute({ sql: `SELECT 1 FROM "_migrations" WHERE "name" = ?`, args: [name] });
			if (done.rows.length > 0) {
				await tx.commit();
				continue;
			}
			await tx.executeMultiple(sql);
			await tx.execute({
				sql: `INSERT INTO "_migrations" ("name", "appliedAt") VALUES (?, ?)`,
				args: [name, new Date().toISOString()],
			});
			await tx.commit();
			applied.push(name);
		} catch (err) {
			// A rollback error would mask the migration error, which is the one to report.
			await tx.rollback().catch(() => undefined);
			throw new Error(`Migration ${name} failed`, { cause: err });
		} finally {
			tx.close();
		}
	}
	return applied;
}
