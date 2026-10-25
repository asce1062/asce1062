/**
 * Storage for the admin session generation (single row, id 1).
 *
 * Kept apart from admin-auth so the auth module stays free of database imports
 * and its unit tests can swap this store out.
 */
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { AdminSession } from "@/lib/db/schema";

const ROW_ID = 1;

/** Current session generation. Throws when the row is missing, so callers fail closed. */
export async function getAdminSessionGeneration(): Promise<number> {
	const [row] = await db
		.select({ generation: AdminSession.generation })
		.from(AdminSession)
		.where(eq(AdminSession.id, ROW_ID))
		.limit(1);
	if (!row) throw new Error("AdminSession row is missing (migration 0003 not applied?)");
	return row.generation;
}

/** Move the generation on, invalidating every session signed with an older one. */
export async function incrementAdminSessionGeneration(): Promise<void> {
	const result = await db
		.update(AdminSession)
		.set({ generation: sql`${AdminSession.generation} + 1` })
		.where(eq(AdminSession.id, ROW_ID));
	if (result.rowsAffected !== 1) throw new Error("AdminSession row is missing (migration 0003 not applied?)");
}
