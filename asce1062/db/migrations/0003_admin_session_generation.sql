-- One row holding the admin session generation. Every admin session cookie is
-- signed with the generation current at login; logout increments it, which
-- revokes every outstanding session (including a copied cookie) at once.
CREATE TABLE "AdminSession" (
	"id" integer PRIMARY KEY CHECK ("id" = 1),
	"generation" integer NOT NULL DEFAULT 0
);

INSERT INTO "AdminSession" ("id", "generation") VALUES (1, 0);
