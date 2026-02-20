import { db, Guestbook } from "astro:db";

export default async function seed() {
	await db.insert(Guestbook).values([
		{
			id: 4,
			name: "alex.immer",
			email: "tnkratos@gmail.com",
			url: "https://music.alexmbugua.me",
			message: `PS: you can draw ASCII art too!
               __
              / _)
     _.----._/ /
    /         /
 __/ (  | (  |
/__.-'|_|--|_|

Tmplr
┏┓┏┓┏┓┏┓
┣┫┗┓┃ ┣
┛┗┗┛┗┛┗┛

Calvin S
╔═╗╔═╗╔═╗╔═╗
╠═╣╚═╗║  ║╣
╩ ╩╚═╝╚═╝╚═╝

Future
┏━┓┏━┓┏━╸┏━╸
┣━┫┗━┓┃  ┣╸
╹ ╹┗━┛┗━╸┗━╸

Emboss
┏━┃┏━┛┏━┛┏━┛
┏━┃━━┃┃  ┏━┛
┛ ┛━━┛━━┛━━┛

Pagga
░█▀█░█▀▀░█▀▀░█▀▀
░█▀█░▀▀█░█░░░█▀▀
░▀░▀░▀▀▀░▀▀▀░▀▀▀`,
			timestamp: new Date("2026-02-19T00:33:52.000Z"),
			isSpam: false,
			style: JSON.stringify({
				bg: "morphing-diamonds",
				borderColor: "base-300",
				borderWidth: "4px",
				borderStyle: "double",
				borderRadius: "0rem",
			}),
		},
		{
			id: 3,
			name: "Jemapelle Sasuke Uchiwa",
			message: "The Cycle of Life and Death Continues, We Will Live, they will Die - Nasus circa 2009",
			timestamp: new Date("2025-08-13T02:49:57.691Z"),
			isSpam: false,
			style: JSON.stringify({
				bg: "aztec",
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
				bg: "jigsaw",
				borderColor: "info",
				borderWidth: "1px",
				borderStyle: "dashed",
				borderRadius: "0.25rem",
			}),
		},
		{
			id: 1,
			name: "alex",
			url: "https://alexmbugua.me",
			message:
				"welcome to my guestbook. leave a note. i'd love to hear from you ^^\ni also moonlights as a [chip musician](music.alexmbugua.me).",
			timestamp: new Date("2025-06-26T09:05:22.886Z"),
			isSpam: false,
			style: JSON.stringify({
				bg: "endless-clouds",
				borderColor: "base-300",
				borderWidth: "4px",
				borderStyle: "double",
				borderRadius: "0rem",
			}),
		},
	]);
}
