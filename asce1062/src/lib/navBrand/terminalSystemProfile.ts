import asciiData from "@/data/ascii-art.json";
import { NAVBRAND_COMMANDS } from "@/lib/navBrand/commands";

export type TerminalSystemColorRole = "primary" | "secondary" | "accent" | "info" | "success" | "error";

export type TerminalSystemSnapshot = {
	platform: string;
	theme: string;
	flavor: string;
	language: string;
	network: string;
	timezone: string;
	viewport: string;
	route: string;
	cpuThreads: number | null;
	deviceMemoryGiB: number | null;
	touchPoints: number | null;
	reducedMotion: boolean;
};

export type TerminalSystemRow = {
	label: string;
	value: string;
};

export type TerminalSystemAsciiLine = {
	text: string;
	colorRole: TerminalSystemColorRole;
};

export type TerminalSystemProfile = {
	font: string;
	asciiLines: TerminalSystemAsciiLine[];
	rows: TerminalSystemRow[];
};

type AsciiVariant = {
	readonly text: string;
	readonly font: string;
	readonly art: string;
};

type RandomSource = () => number;

const asciiVariants = (asciiData as AsciiVariant[]).filter((variant) => variant.text !== "404");
const SITE_GO_LIVE_AT = Date.parse("2025-06-13T00:00:00Z");
const COLOR_ROLES: readonly TerminalSystemColorRole[] = ["primary", "secondary", "accent", "info", "success", "error"];

function shuffleColorRoles(random: RandomSource): TerminalSystemColorRole[] {
	const roles = [...COLOR_ROLES];
	for (let i = roles.length - 1; i > 0; i -= 1) {
		const sample = Math.min(Math.max(random(), 0), 0.9999999999999999);
		const j = Math.floor(sample * (i + 1));
		[roles[i], roles[j]] = [roles[j], roles[i]];
	}
	return roles;
}

export function pickTerminalSystemAsciiVariant(random: RandomSource = Math.random): AsciiVariant {
	const index = Math.min(asciiVariants.length - 1, Math.floor(random() * asciiVariants.length));
	return asciiVariants[index] ?? asciiVariants[0];
}

function formatMemory(deviceMemoryGiB: number | null): string {
	if (!deviceMemoryGiB || deviceMemoryGiB <= 0) return "browser hint unavailable";
	return `${deviceMemoryGiB} GiB hint`;
}

function formatCpu(cpuThreads: number | null): string {
	if (!cpuThreads || cpuThreads <= 0) return "logical threads unavailable";
	return `${cpuThreads} logical threads`;
}

function formatTouch(touchPoints: number | null): string {
	if (!touchPoints || touchPoints <= 0) return "mouse / trackpad";
	return `${touchPoints} touch point${touchPoints > 1 ? "s" : ""}`;
}

function formatSiteUptime(now: number): string {
	const elapsed = Math.max(0, now - SITE_GO_LIVE_AT);
	const totalMinutes = Math.floor(elapsed / 60_000);
	const days = Math.floor(totalMinutes / (60 * 24));
	const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
	const mins = totalMinutes % 60;
	return `${days} day${days === 1 ? "" : "s"}, ${hours} hour${hours === 1 ? "" : "s"}, ${mins} min${
		mins === 1 ? "" : "s"
	}`;
}

export function buildTerminalSystemProfile(
	snapshot: TerminalSystemSnapshot,
	options: { random?: RandomSource } = {}
): TerminalSystemProfile {
	const { random = Math.random } = options;
	const now = Date.now();
	const variant = pickTerminalSystemAsciiVariant(random);
	const colorRoles = shuffleColorRoles(random);
	const asciiLines = variant.art
		.replace(/\n+$/g, "")
		.split("\n")
		.filter((line) => line.length > 0)
		.map((text, index) => ({
			text,
			colorRole: colorRoles[index % colorRoles.length],
		}));

	return {
		font: variant.font,
		asciiLines,
		rows: [
			{ label: "Host", value: "alexmbugua.me" },
			{ label: "Terminal", value: "stellar console" },
			{ label: "Platform", value: snapshot.platform },
			{ label: "Route", value: snapshot.route },
			{ label: "Uptime", value: formatSiteUptime(now) },
			{ label: "Commands", value: `${NAVBRAND_COMMANDS.length} (help)` },
			{ label: "Theme", value: snapshot.theme },
			{ label: "Theme Flavor", value: snapshot.flavor },
			{ label: "Language", value: snapshot.language },
			{ label: "Timezone", value: snapshot.timezone },
			{ label: "Network", value: snapshot.network },
			{ label: "Viewport", value: snapshot.viewport },
			{ label: "CPU", value: formatCpu(snapshot.cpuThreads) },
			{ label: "Memory", value: formatMemory(snapshot.deviceMemoryGiB) },
			{ label: "Input", value: formatTouch(snapshot.touchPoints) },
			{ label: "Motion", value: snapshot.reducedMotion ? "reduced" : "full" },
		],
	};
}
