import { describe, expect, it } from "vitest";
import { vi } from "vitest";
import { buildTerminalSystemProfile } from "@/lib/navBrand/terminalSystemProfile";

describe("buildTerminalSystemProfile", () => {
	it("builds browser-real rows plus static host/terminal identity", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-04-19T00:00:00Z"));

		const profile = buildTerminalSystemProfile(
			{
				platform: "macOS",
				theme: "night",
				flavor: "crt-green",
				language: "en-US",
				network: "online",
				timezone: "Africa/Nairobi",
				viewport: "1680×1050",
				route: "/hello",
				cpuThreads: 8,
				deviceMemoryGiB: 16,
				touchPoints: 0,
				reducedMotion: false,
			},
			{ random: () => 0 }
		);

		expect(profile.font).toBeTruthy();
		expect(profile.asciiLines.length).toBeGreaterThan(0);
		const allowedRoles = ["primary", "secondary", "accent", "info", "success", "error"];
		expect(profile.asciiLines.every((line) => allowedRoles.includes(line.colorRole))).toBe(true);
		expect(profile.rows).toEqual(
			expect.arrayContaining([
				{ label: "Host", value: "alexmbugua.me" },
				{ label: "Terminal", value: "stellar console" },
				{ label: "Platform", value: "macOS" },
				{ label: "Route", value: "/hello" },
				{ label: "Uptime", value: "310 days, 0 hours, 0 mins" },
				{ label: "CPU", value: "8 logical threads" },
				{ label: "Theme Flavor", value: "crt-green" },
				{ label: "Commands", value: "15 (help)" },
				{ label: "Memory", value: "16 GiB hint" },
				{ label: "Input", value: "mouse / trackpad" },
				{ label: "Motion", value: "full" },
			])
		);

		vi.useRealTimers();
	});

	it("falls back cleanly when hardware hints are unavailable", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-04-19T00:00:00Z"));

		const profile = buildTerminalSystemProfile(
			{
				platform: "Unknown",
				theme: "unknown",
				flavor: "default warm void",
				language: "en-US",
				network: "offline",
				timezone: "UTC",
				viewport: "320×568",
				route: "/",
				cpuThreads: null,
				deviceMemoryGiB: null,
				touchPoints: 2,
				reducedMotion: true,
			},
			{ random: () => 0.5 }
		);

		expect(profile.rows).toEqual(
			expect.arrayContaining([
				{ label: "CPU", value: "logical threads unavailable" },
				{ label: "Memory", value: "browser hint unavailable" },
				{ label: "Input", value: "2 touch points" },
				{ label: "Motion", value: "reduced" },
			])
		);

		vi.useRealTimers();
	});
});
