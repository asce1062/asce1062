import { readFile } from "node:fs/promises";
import { databaseClient, databaseTarget } from "../src/lib/db/client";

const migrationUrl = new URL("./migrations/0000_guestbook_baseline.sql", import.meta.url);
const migration = await readFile(migrationUrl, "utf8");

console.warn(`Applying non-destructive guestbook baseline to ${databaseTarget}`);
await databaseClient.executeMultiple(migration);
databaseClient.close();
