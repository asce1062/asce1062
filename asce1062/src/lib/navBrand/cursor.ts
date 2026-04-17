import type { NavBrandState } from "@/lib/navBrand/state";

export type CursorMode = "active" | "idle" | "return" | "system" | "paused";
export type NavBrandTone = "normal" | "rare";

export function getCursorModeForState(state: NavBrandState, reducedMotion: boolean): CursorMode {
	if (reducedMotion) return "paused";
	if (state === "idle") return "idle";
	if (state === "return") return "return";
	if (state === "system") return "system";
	return "active";
}

export function applyCursorMode(cursorEl: HTMLElement | null, mode: CursorMode): void {
	if (!cursorEl) return;

	cursorEl.dataset.cursorMode = mode;
	if (mode === "paused") {
		cursorEl.classList.remove("blink");
	} else {
		cursorEl.classList.add("blink");
	}
}

export function applyNavBrandPresentation(
	rootEl: HTMLElement | null,
	options: {
		state: NavBrandState;
		effect?: string;
		tone?: NavBrandTone;
	}
): void {
	if (!rootEl) return;

	rootEl.dataset.navbrandState = options.state;
	rootEl.dataset.navbrandEffect = options.effect ?? "none";
	rootEl.dataset.navbrandTone = options.tone ?? "normal";
}
