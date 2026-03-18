import { column, defineDb, defineTable, NOW } from "astro:db";

const Guestbook = defineTable({
	columns: {
		id: column.number({ primaryKey: true }),
		name: column.text(),
		email: column.text({ optional: true }),
		url: column.text({ optional: true }),
		message: column.text(),
		timestamp: column.date({ default: NOW }),
		isSpam: column.boolean({ optional: true }),
		style: column.text({ optional: true }),
		/** Moderation status: "visible" | "pending" | "hidden" */
		status: column.text({ optional: true, default: "visible" }),
		/** JSON array of reason strings, e.g. ["profanity","rate_limited"] */
		moderationReason: column.text({ optional: true }),
		/** Numeric score. Higher means more suspicious */
		moderationScore: column.number({ optional: true }),
		/** SHA-256 hash of IP + salt (never store raw IP) */
		ipHash: column.text({ optional: true }),
		/** SHA-256 hash of User-Agent + salt */
		userAgentHash: column.text({ optional: true }),
		/** SHA-256 hash of trimmed message content. Enables efficient duplicate detection */
		messageHash: column.text({ optional: true }),
		/** When an admin last changed the moderation status */
		moderatedAt: column.date({ optional: true }),
		/** Who performed the moderation action (e.g. "admin") */
		moderatedBy: column.text({ optional: true }),
		/** Incremented when classification rules change. Enables targeted backfills */
		moderationVersion: column.number({ optional: true, default: 1 }),
		/** Set after the admin notification email is successfully sent. Prevents duplicate sends on route retry */
		adminNotifiedAt: column.date({ optional: true }),
		/** Set after the entry-copy email is successfully sent. Prevents duplicate sends on route retry */
		copySentAt: column.date({ optional: true }),
		/** Serialized avatar state: "gender=male&avatar=3-54-12-14-15-21". Null when not opted in. */
		avatarState: column.text({ optional: true }),
		/** True when the submitter opted to attach their avatar to this entry */
		avatarOptIn: column.boolean({ optional: true }),
	},
	indexes: {
		/** Speeds up rate-limit window queries: countRecentPostsByIp */
		ix_guestbook_ip_time: { on: ["ipHash", "timestamp"] },
		/** Speeds up duplicate detection queries: countSameMessageFromIp, retroFlagSameMsgEntries */
		ix_guestbook_ip_msg_time: { on: ["ipHash", "messageHash", "timestamp"] },
		/** Speeds up admin filter queries and countPendingEntries */
		ix_guestbook_status: { on: ["status"] },
	},
});

/**
 * Append-only audit log for every admin moderation action.
 *
 * A row is written on every approve / approve-clear / hide action
 * regardless of whether the Guestbook row retains or clears its flags.
 * This means:
 *  - "approve_clear" entries still preserve what the classifier originally saw.
 *  - You can answer "what % of pending were false positives?" at any time.
 *  - This table owns the history. Guestbook stays clean for UI.
 */
const GuestbookModerationLog = defineTable({
	columns: {
		id: column.number({ primaryKey: true }),
		/** FK → Guestbook.id */
		entryId: column.number({ references: () => Guestbook.columns.id }),
		/** "approve" | "approve_clear" | "hide" */
		action: column.text(),
		/** Status before the action */
		fromStatus: column.text({ optional: true }),
		/** Status after the action */
		toStatus: column.text(),
		/** Serialized JSON reasons array as it existed before the action */
		reasonsBefore: column.text({ optional: true }),
		/** Score as it existed before the action */
		scoreBefore: column.number({ optional: true }),
		/**
		 * Reasons after the action.
		 * Null when action === "approve_clear" (flags wiped from Guestbook row).
		 * Identical to reasonsBefore for "approve" and "hide".
		 */
		reasonsAfter: column.text({ optional: true }),
		/** Score after the action; null when action === "approve_clear". */
		scoreAfter: column.number({ optional: true }),
		/** Who performed the action (e.g. "admin") */
		actor: column.text(),
		/** When the action was performed */
		at: column.date({ default: NOW }),
	},
	indexes: {
		/** Look up the full history for a single entry */
		ix_mod_log_entry: { on: ["entryId"] },
	},
});

export default defineDb({ tables: { Guestbook, GuestbookModerationLog } });
