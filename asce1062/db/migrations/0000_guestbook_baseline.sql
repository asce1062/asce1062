CREATE TABLE IF NOT EXISTS "Guestbook" (
	"id" integer PRIMARY KEY,
	"name" text NOT NULL,
	"email" text,
	"url" text,
	"message" text NOT NULL,
	"timestamp" text NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"isSpam" integer,
	"style" text,
	"status" text DEFAULT 'visible',
	"moderationReason" text,
	"moderationScore" integer,
	"ipHash" text,
	"userAgentHash" text,
	"messageHash" text,
	"moderatedAt" text,
	"moderatedBy" text,
	"moderationVersion" integer DEFAULT 1,
	"adminNotifiedAt" text,
	"copySentAt" text,
	"avatarState" text,
	"avatarOptIn" integer
);

CREATE INDEX IF NOT EXISTS "ix_guestbook_ip_time" ON "Guestbook" ("ipHash", "timestamp");
CREATE INDEX IF NOT EXISTS "ix_guestbook_ip_msg_time" ON "Guestbook" ("ipHash", "messageHash", "timestamp");
CREATE INDEX IF NOT EXISTS "ix_guestbook_status" ON "Guestbook" ("status");

CREATE TABLE IF NOT EXISTS "GuestbookModerationLog" (
	"id" integer PRIMARY KEY,
	"entryId" integer NOT NULL REFERENCES "Guestbook" ("id"),
	"action" text NOT NULL,
	"fromStatus" text,
	"toStatus" text NOT NULL,
	"reasonsBefore" text,
	"scoreBefore" integer,
	"reasonsAfter" text,
	"scoreAfter" integer,
	"actor" text NOT NULL,
	"at" text NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "ix_mod_log_entry" ON "GuestbookModerationLog" ("entryId");
