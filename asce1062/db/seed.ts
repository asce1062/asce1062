import { db, Guestbook } from "astro:db";

export default async function seed() {
	await db.insert(Guestbook).values([
		{
			id: 4,
			name: "alex.immer",
			email: "alex@alexmbugua.me",
			url: "https://music.alexmbugua.me",
			message:
				'You can draw ASCII art too!\n               __\n              / _)\n     _.----._/ /\n    /         /\n __/ (  | (  |\n/__.-\'|_|--|_|\n               __\n       (o_    ( o>\n(o_    //\\    ///\\\n(/)_   V_/_   \\V_/_     \n\n           (\\/)\n            \\/\n  (\\/)   .-.  .-.\n   \\/   ((`-)(-`))\n         \\\\    //   (\\/)\n          \\\\  //     \\/\n   .="""=._))((_.="""=.\n  /  .,   .\'  \'.   ,.  \\\n /__(,_.-\'      \'-._,)__\\\n`    /|             |\\   `\n    /_|__         __|_\\\n      | `))     ((` |\n      |             |\n     -"==         =="-\n\nTmplr\n┏┓┏┓┏┓┏┓\n┣┫┗┓┃ ┣ \n┛┗┗┛┗┛┗┛\n\nCalvin S\n╔═╗╔═╗╔═╗╔═╗\n╠═╣╚═╗║  ║╣ \n╩ ╩╚═╝╚═╝╚═╝\n\nFuture\n┏━┓┏━┓┏━╸┏━╸\n┣━┫┗━┓┃  ┣╸ \n╹ ╹┗━┛┗━╸┗━╸\n\nEmboss\n┏━┃┏━┛┏━┛┏━┛\n┏━┃━━┃┃  ┏━┛\n┛ ┛━━┛━━┛━━┛\n\nPagga\n░█▀█░█▀▀░█▀▀░█▀▀\n░█▀█░▀▀█░█░░░█▀▀\n░▀░▀░▀▀▀░▀▀▀░▀▀▀\n\n- Alex',
			timestamp: new Date("2026-02-19T00:33:52.000Z"),
			isSpam: false,
			status: "visible",
			moderationVersion: 1,
			style: JSON.stringify({
				bg: "morphing-diamonds",
				borderColor: "base-300",
				borderWidth: "4px",
				borderStyle: "double",
				borderRadius: "0rem",
			}),
			avatarState: "gender=male&avatar=3-54-12-14-15-1",
			avatarOptIn: true,
		},
		{
			id: 3,
			name: "Jemapelle Sasuke Uchiwa",
			email: null,
			url: null,
			message: "The Cycle of Life and Death Continues, We Will Live, they will Die - Nasus circa 2009",
			timestamp: new Date("2025-08-13T02:49:57.691Z"),
			isSpam: false,
			status: "visible",
			moderationVersion: 1,
			style: JSON.stringify({
				bg: "aztec",
				borderColor: "primary",
				borderWidth: "1.5px",
				borderStyle: "solid",
				borderRadius: "0.5rem",
			}),
			avatarState: "gender=male&avatar=2-41-18-7-9-5",
			avatarOptIn: true,
		},
		{
			id: 2,
			name: "Lex",
			email: null,
			url: null,
			message: "What if the entire human civilization is a C grade project from a very advanced life form 🤔.",
			timestamp: new Date("2025-06-26T16:42:01.281Z"),
			isSpam: false,
			status: "visible",
			moderationVersion: 1,
			style: JSON.stringify({
				bg: "jigsaw",
				borderColor: "info",
				borderWidth: "1px",
				borderStyle: "dashed",
				borderRadius: "0.25rem",
			}),
			avatarState: "gender=female&avatar=3-14-22-41-7-11",
			avatarOptIn: true,
		},
		{
			id: 1,
			name: "alex",
			email: null,
			url: "https://alexmbugua.me",
			message: `Welcome to my guestbook
I'm happy you're here ^^
Feel free to leave a note:
>_ say hi
>_ write a poem
>_ share a thought
>_ sketch some ASCII art
There's no right way to do this
I'd genuinely love to hear from you
I don't bite (promise)
PS: I also moonlight as a [chip musician](music.alexmbugua.me)

- Alex`,
			timestamp: new Date("2025-06-26T09:05:22.886Z"),
			isSpam: false,
			status: "visible",
			moderationVersion: 1,
			style: JSON.stringify({
				bg: "endless-clouds",
				borderColor: "base-300",
				borderWidth: "4px",
				borderStyle: "double",
				borderRadius: "0rem",
			}),
			avatarState: "gender=male&avatar=3-54-12-14-15-21",
			avatarOptIn: true,
		},

		// -------------------------------------------------------------------------
		// PENDING
		// 	- soft flags
		// 	- awaiting review
		// -------------------------------------------------------------------------

		// name_is_url: name contains a domain extension, score 5
		{
			id: 5,
			name: "con-d-ori-ano.marines.invalid",
			email: null,
			url: null,
			message: "Con D. Oriano (Shepherd) has entered the base.",
			timestamp: new Date("2026-03-01T10:15:00.000Z"),
			isSpam: false,
			status: "pending",
			moderationReason: JSON.stringify(["name_is_url"]),
			moderationScore: 5,
			ipHash: "abc123def456abc123def456abc123def456abc123def456abc123def456ab01",
			moderationVersion: 1,
			style: JSON.stringify({
				bg: "anchors-away",
				borderColor: "accent",
				borderWidth: "1.5px",
				borderStyle: "solid",
				borderRadius: "0.25rem",
			}),
		},

		// rate_limited: same IP as entry 5, posted twice within 10 min window, score 4
		{
			id: 6,
			name: "Spandam",
			email: null,
			url: null,
			message: "CP9 paperwork enjoyer here. If you see me twice, that's… administrative efficiency.",
			timestamp: new Date("2026-03-01T10:42:00.000Z"),
			isSpam: false,
			status: "pending",
			moderationReason: JSON.stringify(["rate_limited"]),
			moderationScore: 4,
			ipHash: "abc123def456abc123def456abc123def456abc123def456abc123def456ab01",
			moderationVersion: 1,
			style: JSON.stringify({
				bg: "graph-paper",
				borderColor: "warning",
				borderWidth: "1px",
				borderStyle: "solid",
				borderRadius: "0.25rem",
			}),
		},

		// suspicious_name: >50% non-alphanumeric chars in name, score 3
		{
			id: 7,
			name: "M!s†er-3:::G@ld!n0",
			email: null,
			url: null,
			message: "Wax. Traps. Tea time. Mr. 3 (Galdino). Little Garden troublemaker",
			timestamp: new Date("2026-02-28T14:20:00.000Z"),
			isSpam: false,
			status: "pending",
			moderationReason: JSON.stringify(["suspicious_name"]),
			moderationScore: 3,
			ipHash: "beef0011cafe2233beef0011cafe2233beef0011cafe2233beef0011cafe2233",
			moderationVersion: 1,
			style: JSON.stringify({
				bg: "polka-dots",
				borderColor: "secondary",
				borderWidth: "1px",
				borderStyle: "solid",
				borderRadius: "0.5rem",
			}),
		},

		// duplicate: needs a prior matching message+ipHash within 1h
		{
			id: 20,
			name: "Wapol",
			email: null,
			url: null,
			message: "I'll eat anything! Wapol reporting from Drum Island. This message is DEFINITELY original.",
			timestamp: new Date("2026-02-27T09:05:00.000Z"),
			isSpam: false,
			status: "visible",
			moderationReason: null,
			moderationScore: null,
			ipHash: "deadbeef1234deadbeef1234deadbeef1234deadbeef1234deadbeef1234dead",
			moderationVersion: 1,
			style: JSON.stringify({
				bg: "overcast",
				borderColor: "error",
				borderWidth: "4px",
				borderStyle: "solid",
				borderRadius: "2rem",
			}),
			avatarState: "gender=female&avatar=3-17-29-50-12-18",
			avatarOptIn: true,
		},
		{
			id: 8,
			name: "Wapol",
			email: null,
			url: null,
			message: "I'll eat anything! Wapol reporting from Drum Island. This message is DEFINITELY original.",
			timestamp: new Date("2026-02-27T09:30:00.000Z"),
			isSpam: false,
			status: "pending",
			moderationReason: JSON.stringify(["duplicate"]),
			moderationScore: 5,
			ipHash: "deadbeef1234deadbeef1234deadbeef1234deadbeef1234deadbeef1234dead",
			moderationVersion: 1,
			style: JSON.stringify({
				bg: "heavy-rain",
				borderColor: "warning",
				borderWidth: "1px",
				borderStyle: "dashed",
				borderRadius: "0.25rem",
			}),
		},

		// -------------------------------------------------------------------------
		// HIDDEN
		//  - hard spam signals
		// 	- auto-hidden (score >= 10)
		// -------------------------------------------------------------------------

		// html_tag: raw HTML in message, score 10
		{
			id: 9,
			name: "Caesar Clown",
			email: null,
			url: null,
			message:
				"<b>SHURORORO</b> limited-time 'research' offer! <a href='https://punkhazard-lab.invalid'>Claim reward</a>",
			timestamp: new Date("2026-03-03T06:00:00.000Z"),
			isSpam: true,
			status: "hidden",
			moderationReason: JSON.stringify(["html_tag"]),
			moderationScore: 10,
			ipHash: "1111aaaa2222bbbb1111aaaa2222bbbb1111aaaa2222bbbb1111aaaa2222bbbb",
			moderationVersion: 1,
			style: JSON.stringify({
				bg: "melt",
				borderColor: "error",
				borderWidth: "2px",
				borderStyle: "solid",
				borderRadius: "0rem",
			}),
		},

		// url_shortener: bit.ly link detected, score 10
		{
			id: 10,
			name: "Saint Charlos",
			email: null,
			url: null,
			message: "Peasant, behold: https://bit.ly/CharlosNobility. Click immediately.",
			timestamp: new Date("2026-03-02T11:15:00.000Z"),
			isSpam: true,
			status: "hidden",
			moderationReason: JSON.stringify(["url_shortener"]),
			moderationScore: 10,
			ipHash: "2222cccc3333dddd2222cccc3333dddd2222cccc3333dddd2222cccc3333dddd",
			moderationVersion: 1,
			style: JSON.stringify({
				bg: "fancy-rectangles",
				borderColor: "error",
				borderWidth: "1.5px",
				borderStyle: "solid",
				borderRadius: "0.25rem",
			}),
		},

		// link_only: classifier sets score 8 => PENDING (not hidden)
		{
			id: 11,
			name: "Gecko Moria",
			email: null,
			url: null,
			message: "https://thrillerbark.invalid",
			timestamp: new Date("2026-03-01T20:00:00.000Z"),
			isSpam: false,
			status: "pending",
			moderationReason: JSON.stringify(["link_only"]),
			moderationScore: 8,
			ipHash: "3333eeee4444ffff3333eeee4444ffff3333eeee4444ffff3333eeee4444ffff",
			moderationVersion: 1,
			style: JSON.stringify({
				bg: "skulls",
				borderColor: "warning",
				borderWidth: "1px",
				borderStyle: "solid",
				borderRadius: "0.5rem",
			}),
		},

		// duplicate + rate_limited: needs 3 copies in-window (same ipHash + same message within 1h)
		{
			id: 21,
			name: "Don Krieg",
			email: null,
			url: null,
			message: "BARATIE SUPER WEAPON DEALS!!! Visit my fleet now!!!",
			timestamp: new Date("2026-02-28T18:10:00.000Z"),
			isSpam: false,
			status: "visible",
			moderationReason: null,
			moderationScore: null,
			ipHash: "4444aaaa5555bbbb4444aaaa5555bbbb4444aaaa5555bbbb4444aaaa5555bbbb",
			moderationVersion: 1,
			style: JSON.stringify({
				bg: "steel-beams",
				borderColor: "base-300",
				borderWidth: "1px",
				borderStyle: "solid",
				borderRadius: "0rem",
			}),
			avatarState: "gender=male&avatar=1-58-9-15-25-17",
			avatarOptIn: true,
		},
		{
			id: 22,
			name: "Don Krieg",
			email: null,
			url: null,
			message: "BARATIE SUPER WEAPON DEALS!!! Visit my fleet now!!!",
			timestamp: new Date("2026-02-28T18:25:00.000Z"),
			isSpam: false,
			status: "pending",
			moderationReason: JSON.stringify(["duplicate"]),
			moderationScore: 5,
			ipHash: "4444aaaa5555bbbb4444aaaa5555bbbb4444aaaa5555bbbb4444aaaa5555bbbb",
			moderationVersion: 1,
			style: JSON.stringify({
				bg: "diagonal-stripes",
				borderColor: "warning",
				borderWidth: "1px",
				borderStyle: "dashed",
				borderRadius: "0rem",
			}),
		},
		{
			id: 12,
			name: "Don Krieg",
			email: null,
			url: null,
			message: "BARATIE SUPER WEAPON DEALS!!! Visit my fleet now!!!",
			timestamp: new Date("2026-02-28T18:45:00.000Z"),
			isSpam: true,
			status: "hidden",
			moderationReason: JSON.stringify(["duplicate", "rate_limited"]),
			moderationScore: 10,
			ipHash: "4444aaaa5555bbbb4444aaaa5555bbbb4444aaaa5555bbbb4444aaaa5555bbbb",
			moderationVersion: 1,
			style: JSON.stringify({
				bg: "diagonal-lines",
				borderColor: "error",
				borderWidth: "2px",
				borderStyle: "solid",
				borderRadius: "0rem",
			}),
		},

		// obfuscated_link: hxxps:// evasion attempt, score 10
		{
			id: 13,
			name: "Kuro of a Hundred Plans",
			email: null,
			url: null,
			message: "My flawless plan begins here: hxxps://black-cat-crew.invalid/quietly-click",
			timestamp: new Date("2026-02-27T22:10:00.000Z"),
			isSpam: true,
			status: "hidden",
			moderationReason: JSON.stringify(["obfuscated_link"]),
			moderationScore: 10,
			ipHash: "5555cccc6666dddd5555cccc6666dddd5555cccc6666dddd5555cccc6666dddd",
			moderationVersion: 1,
			style: JSON.stringify({
				bg: "circuit-board",
				borderColor: "error",
				borderWidth: "1px",
				borderStyle: "solid",
				borderRadius: "0rem",
			}),
		},

		// bbcode: [url=] syntax, score 10
		{
			id: 14,
			name: "Arlong",
			email: null,
			url: null,
			message: "Pay the tribute. [url=https://arlong-park.invalid]Join Arlong Park[/url].",
			timestamp: new Date("2026-02-26T07:30:00.000Z"),
			isSpam: true,
			status: "hidden",
			moderationReason: JSON.stringify(["bbcode"]),
			moderationScore: 10,
			ipHash: "6666eeee7777ffff6666eeee7777ffff6666eeee7777ffff6666eeee7777ffff",
			moderationVersion: 1,
			style: JSON.stringify({
				bg: "current",
				borderColor: "error",
				borderWidth: "2px",
				borderStyle: "solid",
				borderRadius: "0rem",
			}),
		},

		// Admin manually hidden. No auto-detection reason, admin judgment call
		{
			id: 15,
			name: "Foxy the Silver Fox",
			email: null,
			url: null,
			message: "This guestbook is embarrassing. I'm challenging it to a Davy Back Fight just to delete it.",
			timestamp: new Date("2026-02-25T17:20:00.000Z"),
			isSpam: true,
			status: "hidden",
			moderationReason: null,
			moderationScore: null,
			moderatedAt: new Date("2026-02-25T17:35:00.000Z"),
			moderatedBy: "admin",
			moderationVersion: 1,
			style: JSON.stringify({
				bg: "glamorous",
				borderColor: "error",
				borderWidth: "1px",
				borderStyle: "solid",
				borderRadius: "0.25rem",
			}),
		},

		// -------------------------------------------------------------------------
		// VISIBLE + moderationReason. Previously flagged, approved by admin
		// -------------------------------------------------------------------------

		// Was pending (suspicious_name), admin approved. Flags kept for audit trail
		{
			id: 16,
			name: "K@t@kuri-シャルロット",
			email: null,
			url: null,
			message: "…You're seeing the future. That's why you can't see my face.",
			timestamp: new Date("2026-02-22T15:30:00.000Z"),
			isSpam: false,
			status: "visible",
			moderationReason: JSON.stringify(["suspicious_name"]),
			moderationScore: 3,
			ipHash: "7777aaaa8888bbbb7777aaaa8888bbbb7777aaaa8888bbbb7777aaaa8888bbbb",
			moderatedAt: new Date("2026-02-22T16:05:00.000Z"),
			moderatedBy: "admin",
			moderationVersion: 1,
			style: JSON.stringify({
				bg: "hideout",
				borderColor: "success",
				borderWidth: "1px",
				borderStyle: "solid",
				borderRadius: "0.5rem",
			}),
			avatarState: "gender=female&avatar=4-26-32-22-3-3",
			avatarOptIn: true,
		},

		// Was pending (rate_limited), admin reviewed and approved as a real person
		{
			id: 17,
			name: "Magellan",
			email: null,
			url: null,
			message: "Sorry. Impel Down night shift. I posted twice because I thought the first one got eaten by the void.",
			timestamp: new Date("2026-02-20T08:00:00.000Z"),
			isSpam: false,
			status: "visible",
			moderationReason: JSON.stringify(["rate_limited"]),
			moderationScore: 4,
			ipHash: "8888cccc9999dddd8888cccc9999dddd8888cccc9999dddd8888cccc9999dddd",
			moderatedAt: new Date("2026-02-20T09:15:00.000Z"),
			moderatedBy: "admin",
			moderationVersion: 1,
			style: JSON.stringify({
				bg: "skulls",
				borderColor: "accent",
				borderWidth: "1px",
				borderStyle: "dashed",
				borderRadius: "0.25rem",
			}),
			avatarState: "gender=male&avatar=2-30-29-20-16-19",
			avatarOptIn: true,
		},

		// -------------------------------------------------------------------------
		// LEGACY
		// 	- entries before the moderation system (null status)
		// Keep these as truly legacy:
		// 	- status null (so you can verify null-handling paths)
		// -------------------------------------------------------------------------

		// Legacy visible: isSpam false, status null. Appears on public page
		{
			id: 18,
			name: "Buggy the Clown",
			email: null,
			url: null,
			message: "All jokes aside, this site's got character. Also, I demand a bigger font for my name.",
			timestamp: new Date("2025-11-15T12:00:00.000Z"),
			isSpam: false,
			status: null,
			style: JSON.stringify({
				bg: "lips",
				borderColor: "base-300",
				borderWidth: "1px",
				borderStyle: "solid",
				borderRadius: "0.5rem",
			}),
		},

		// Legacy spam: isSpam true, status null. Caught by old boolean flag, shows in admin
		{
			id: 19,
			name: "Doflamingo",
			email: null,
			url: null,
			message: "[url=https://birdcage.invalid]Fufufufu… click and become 'free'[/url]",
			timestamp: new Date("2025-11-10T09:45:00.000Z"),
			isSpam: true,
			status: null,
			style: JSON.stringify({
				bg: "zig-zag",
				borderColor: "error",
				borderWidth: "2px",
				borderStyle: "dashed",
				borderRadius: "0rem",
			}),
		},
	]);
}
