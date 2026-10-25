/**
 * Admin sessions against a real libsql database built from the migrations.
 *
 * Logout must revoke every outstanding session server-side, not just delete the
 * cookie in the browser that clicked it: a copied cookie stops working too.
 */
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { AstroCookies } from "astro";

const { databasePath } = vi.hoisted(() => ({
	databasePath: `${process.env.TMPDIR ?? "/tmp"}/admin-session-${Date.now()}-${Math.random().toString(36).slice(2)}.db`,
}));

vi.mock("@/lib/db/client", async () => {
	const { createClient } = await import("@libsql/client");
	const { drizzle } = await import("drizzle-orm/libsql");
	const { applyMigrations } = await import("@/lib/db/migrate");
	const schema = await import("@/lib/db/schema");
	const client = createClient({ url: `file:${databasePath}` });
	await applyMigrations(client, new URL("../../../../db/migrations/", import.meta.url));
	return { databaseClient: client, databaseTarget: databasePath, db: drizzle(client, { schema }) };
});

import { rm } from "node:fs/promises";
import { databaseClient } from "@/lib/db/client";
import { checkAdminAuth, createAdminSessionCookie, revokeAdminSessions } from "../admin-auth";

function makeCookies(sessionValue?: string): AstroCookies {
	return {
		get: vi.fn((name: string) => (name === "admin_session" && sessionValue ? { value: sessionValue } : undefined)),
		set: vi.fn(),
		delete: vi.fn(),
	} as unknown as AstroCookies;
}

async function login(): Promise<string> {
	const cookies = makeCookies();
	await expect(createAdminSessionCookie(cookies)).resolves.toBe(true);
	return vi.mocked(cookies.set).mock.calls[0][1] as string;
}

beforeEach(() => {
	vi.stubEnv("ADMIN_TOKEN_HASH", "$argon2id$valid-hash");
});

afterAll(async () => {
	databaseClient.close();
	await rm(databasePath, { force: true });
});

describe("admin session revocation", () => {
	it("accepts a session issued at the current generation", async () => {
		const session = await login();
		await expect(checkAdminAuth(makeCookies(session))).resolves.toEqual({ ok: true });
	});

	it("revokes every outstanding session, not just the one that logged out", async () => {
		const laptop = await login();
		const phone = await login();

		await revokeAdminSessions();

		await expect(checkAdminAuth(makeCookies(laptop))).resolves.toEqual({ ok: false });
		await expect(checkAdminAuth(makeCookies(phone))).resolves.toEqual({ ok: false });
	});

	it("accepts a new login after a logout", async () => {
		await revokeAdminSessions();
		const session = await login();
		await expect(checkAdminAuth(makeCookies(session))).resolves.toEqual({ ok: true });
	});

	it("increments the stored generation once per logout", async () => {
		const before = await databaseClient.execute(`SELECT "generation" FROM "AdminSession" WHERE "id" = 1`);
		await revokeAdminSessions();
		const after = await databaseClient.execute(`SELECT "generation" FROM "AdminSession" WHERE "id" = 1`);
		expect(Number(after.rows[0].generation)).toBe(Number(before.rows[0].generation) + 1);
	});

	it("fails closed when the generation row is missing", async () => {
		const session = await login();
		await databaseClient.execute(`DELETE FROM "AdminSession"`);

		await expect(checkAdminAuth(makeCookies(session))).resolves.toEqual({ ok: false, unavailable: true });
		const cookies = makeCookies();
		await expect(createAdminSessionCookie(cookies)).resolves.toBe(false);
		expect(cookies.set).not.toHaveBeenCalled();
		await expect(revokeAdminSessions()).rejects.toThrow();
	});
});
