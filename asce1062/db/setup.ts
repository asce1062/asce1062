import { databaseClient, databaseTarget } from "../src/lib/db/client";
import { applyMigrations } from "../src/lib/db/migrate";

console.warn(`Applying pending guestbook migrations to ${databaseTarget}`);
const applied = await applyMigrations(databaseClient, new URL("./migrations/", import.meta.url));
console.warn(applied.length > 0 ? `Applied: ${applied.join(", ")}` : "Already up to date");
databaseClient.close();
