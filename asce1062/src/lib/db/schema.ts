import { sql } from "drizzle-orm";
import { customType, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

const dateText = customType<{ data: Date; driverData: string }>({
	dataType() {
		return "text";
	},
	toDriver(value) {
		return value.toISOString();
	},
	fromDriver(value) {
		return new Date(/(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}Z`);
	},
});

export const Guestbook = sqliteTable(
	"Guestbook",
	{
		id: integer("id").primaryKey(),
		name: text("name").notNull(),
		email: text("email"),
		url: text("url"),
		message: text("message").notNull(),
		timestamp: dateText("timestamp")
			.notNull()
			.default(sql`CURRENT_TIMESTAMP`),
		isSpam: integer("isSpam", { mode: "boolean" }),
		style: text("style"),
		status: text("status", { enum: ["visible", "pending", "hidden"] }).default("visible"),
		moderationReason: text("moderationReason"),
		moderationScore: integer("moderationScore"),
		ipHash: text("ipHash"),
		userAgentHash: text("userAgentHash"),
		messageHash: text("messageHash"),
		moderatedAt: dateText("moderatedAt"),
		moderatedBy: text("moderatedBy"),
		moderationVersion: integer("moderationVersion").default(1),
		adminNotifiedAt: dateText("adminNotifiedAt"),
		copySentAt: dateText("copySentAt"),
		avatarState: text("avatarState"),
		avatarOptIn: integer("avatarOptIn", { mode: "boolean" }),
	},
	(table) => [
		index("ix_guestbook_ip_time").on(table.ipHash, table.timestamp),
		index("ix_guestbook_ip_msg_time").on(table.ipHash, table.messageHash, table.timestamp),
		index("ix_guestbook_status").on(table.status),
	]
);

export const GuestbookModerationLog = sqliteTable(
	"GuestbookModerationLog",
	{
		id: integer("id").primaryKey(),
		entryId: integer("entryId")
			.notNull()
			.references(() => Guestbook.id),
		action: text("action").notNull(),
		fromStatus: text("fromStatus"),
		toStatus: text("toStatus").notNull(),
		reasonsBefore: text("reasonsBefore"),
		scoreBefore: integer("scoreBefore"),
		reasonsAfter: text("reasonsAfter"),
		scoreAfter: integer("scoreAfter"),
		actor: text("actor").notNull(),
		at: dateText("at")
			.notNull()
			.default(sql`CURRENT_TIMESTAMP`),
	},
	(table) => [index("ix_mod_log_entry").on(table.entryId)]
);
