/**
 * Entry Avatar Renderer
 *
 * Renders avatar canvases that appear as pixel art stamps on guestbook
 * entries. Each canvas carries a `data-avatar-state` attribute containing
 * the serialized state string ("gender=male&avatar=3-54-12-14-15-21").
 *
 * Runs on every page load, finds all stamped canvases, and composites them.
 */

import { renderToCanvas, parseAvatarState } from "@/scripts/avatarRenderCore";

function renderAllEntryAvatars(): void {
	const canvases = document.querySelectorAll<HTMLCanvasElement>("canvas[data-avatar-state]");
	canvases.forEach((canvas) => {
		const stored = canvas.dataset.avatarState;
		if (!stored) return;

		const parsed = parseAvatarState(stored);
		if (!parsed) {
			console.warn("[entryAvatarRenderer] Invalid avatar state on entry canvas:", stored);
			return;
		}

		renderToCanvas(canvas, parsed.gender, parsed.state).catch((err) => {
			console.error("[entryAvatarRenderer] Render failed for entry canvas:", err);
		});
	});
}

document.addEventListener("astro:page-load", renderAllEntryAvatars);
