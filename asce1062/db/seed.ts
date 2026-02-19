import { db, Guestbook } from "astro:db";

export default async function seed() {
	await db.insert(Guestbook).values([
		{
			id: 1,
			name: "Jemapelle Sasuke Uchiwa",
			message: "The Cycle of Life and Death Continues, We Will Live, they will Die - Nasus circa 2009",
			timestamp: new Date("2025-08-13T02:49:57.691Z"),
			isSpam: false,
			style: JSON.stringify({
				bg: "diagonal-lines",
				borderColor: "primary",
				borderWidth: "1.5px",
				borderStyle: "solid",
				borderRadius: "0.5rem",
			}),
		},
		{
			id: 2,
			name: "Lex",
			message: "What if the entire human civilization is a C grade project from a very advanced life form 🤔.",
			timestamp: new Date("2025-06-26T16:42:01.281Z"),
			isSpam: false,
			style: JSON.stringify({
				bg: "circuit-board",
				borderColor: "accent",
				borderWidth: "2px",
				borderStyle: "dashed",
				borderRadius: "1rem",
			}),
		},
		{
			id: 3,
			name: "alex",
			url: "https://alexmbugua.me",
			message: "welcome to my guest book. leave a note. i'd love to hear from you ^^",
			timestamp: new Date("2025-06-26T09:05:22.886Z"),
			isSpam: false,
		},
	]);
}
