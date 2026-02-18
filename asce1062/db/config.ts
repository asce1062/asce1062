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
	},
});

export default defineDb({ tables: { Guestbook } });
