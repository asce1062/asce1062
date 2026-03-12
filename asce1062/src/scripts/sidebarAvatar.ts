/**
 * Sidebar Avatar Widget
 *
 * Renders a lightweight composited avatar in the sidebar's nav-status canvas.
 * Loads only the 6 layers needed for the current state (no full preload).
 * Controls: icon-stars (randomize), gender buttons (male / female).
 * Clicking the avatar navigates to /8biticon with the current state as URL params.
 */

import type { Gender, AvatarState } from "@/data/avatarConfig";
import { avatarConfig, getDefaultState, getRandomState, getImagePath } from "@/data/avatarConfig";

function loadImage(src: string): Promise<HTMLImageElement> {
	return new Promise((resolve) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = () => resolve(img); // fail silently. skip missing layers
		img.src = src;
	});
}

async function renderToCanvas(canvas: HTMLCanvasElement, gender: Gender, state: AvatarState): Promise<void> {
	const ctx = canvas.getContext("2d");
	if (!ctx) return;

	ctx.clearRect(0, 0, canvas.width, canvas.height);

	const sortedLayers = [...avatarConfig[gender]].sort((a, b) => a.zIndex - b.zIndex);

	for (const layer of sortedLayers) {
		const path = getImagePath(gender, layer.name, state[layer.name]);
		const img = await loadImage(path);
		if (img.complete && img.naturalWidth > 0) {
			ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
		}
	}
}

function buildURL(gender: Gender, state: AvatarState): string {
	const parts = avatarConfig[gender].map((l) => state[l.name]).join("-");
	return `/8biticon?gender=${gender}&avatar=${parts}`;
}

async function initSidebarAvatar(): Promise<void> {
	const canvas = document.getElementById("nav-avatar-canvas") as HTMLCanvasElement | null;
	const link = document.getElementById("nav-avatar-link") as HTMLAnchorElement | null;
	const randomizeBtn = document.getElementById("nav-avatar-randomize");
	const genderBtns = document.querySelectorAll<HTMLButtonElement>("[data-avatar-gender]");

	if (!canvas || !link) return;

	let gender: Gender = "male";
	let state: AvatarState = getDefaultState(gender);

	function setActiveGender(g: Gender): void {
		genderBtns.forEach((b) => b.classList.toggle("nav-avatar-btn--active", b.dataset.avatarGender === g));
	}

	async function update(): Promise<void> {
		await renderToCanvas(canvas!, gender, state);
		link!.href = buildURL(gender, state);
	}

	setActiveGender(gender);
	await update();

	randomizeBtn?.addEventListener("click", async () => {
		state = getRandomState(gender);
		await update();
	});

	genderBtns.forEach((btn) => {
		btn.addEventListener("click", async () => {
			const next = btn.dataset.avatarGender as Gender;
			if (next === gender) return;
			gender = next;
			state = getDefaultState(gender);
			setActiveGender(gender);
			await update();
		});
	});
}

document.addEventListener("astro:page-load", () => {
	initSidebarAvatar().catch(() => {});
});
