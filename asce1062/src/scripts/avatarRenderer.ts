/**
 * Avatar Renderer
 * Handles canvas rendering and image operations for the avatar generator
 */

import type { Gender, AvatarState } from "@/data/avatarConfig";
import { avatarConfig, getImagePath } from "@/data/avatarConfig";

export class AvatarRenderer {
	private canvas: HTMLCanvasElement;
	private ctx: CanvasRenderingContext2D;
	private imageCache: Map<string, HTMLImageElement> = new Map();
	private loadingIndicator: HTMLElement | null;
	private isLoading: boolean = false;

	constructor(canvasId: string, loadingIndicatorId?: string) {
		const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
		if (!canvas) {
			throw new Error(`Canvas with id "${canvasId}" not found`);
		}

		this.canvas = canvas;
		const ctx = this.canvas.getContext("2d");
		if (!ctx) {
			throw new Error("Could not get 2D context from canvas");
		}
		this.ctx = ctx;

		this.loadingIndicator = loadingIndicatorId ? document.getElementById(loadingIndicatorId) : null;
	}

	/**
	 * Preload all images for a given gender
	 */
	async preloadImages(gender: Gender): Promise<void> {
		this.setLoading(true);
		const layers = avatarConfig[gender];
		const promises: Promise<void>[] = [];

		for (const layer of layers) {
			for (let i = 1; i <= layer.count; i++) {
				const path = getImagePath(gender, layer.name, i);
				if (!this.imageCache.has(path)) {
					promises.push(this.loadImage(path));
				}
			}
		}

		await Promise.all(promises);
		this.setLoading(false);
	}

	/**
	 * Load a single image into the cache
	 */
	private loadImage(path: string): Promise<void> {
		return new Promise((resolve) => {
			const img = new Image();
			img.onload = () => {
				this.imageCache.set(path, img);
				resolve();
			};
			img.onerror = () => {
				console.error(`Failed to load image: ${path}`);
				resolve(); // Don't reject, just continue
			};
			img.src = path;
		});
	}

	/**
	 * Get a cached image
	 */
	getCachedImage(path: string): HTMLImageElement | undefined {
		return this.imageCache.get(path);
	}

	/**
	 * Render the complete avatar on the canvas
	 */
	async renderAvatar(gender: Gender, state: AvatarState): Promise<void> {
		// Clear the canvas to transparent
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

		const layers = avatarConfig[gender];

		// Sort layers by zIndex (background = 0 renders first, face = 1, etc.)
		const sortedLayers = [...layers].sort((a, b) => a.zIndex - b.zIndex);

		// Render layers in zIndex order
		for (const layer of sortedLayers) {
			const index = state[layer.name];
			const path = getImagePath(gender, layer.name, index);
			const img = this.imageCache.get(path);

			if (img && img.complete) {
				this.ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height);
			}
		}
	}

	/**
	 * Render a preview thumbnail with background
	 * Used for layer selection previews
	 */
	renderThumbnail(
		gender: Gender,
		layerName: string,
		layerIndex: number,
		backgroundIndex: number,
		width: number = 80,
		height: number = 80
	): HTMLCanvasElement {
		const thumbnailCanvas = document.createElement("canvas");
		thumbnailCanvas.width = width;
		thumbnailCanvas.height = height;
		const ctx = thumbnailCanvas.getContext("2d")!;

		// Draw background first
		if (layerName !== "background") {
			const bgPath = getImagePath(gender, "background", backgroundIndex);
			const bgImg = this.imageCache.get(bgPath);
			if (bgImg && bgImg.complete) {
				ctx.drawImage(bgImg, 0, 0, width, height);
			}
		}

		// Draw the layer item on top
		const itemPath = getImagePath(gender, layerName, layerIndex);
		const itemImg = this.imageCache.get(itemPath);
		if (itemImg && itemImg.complete) {
			ctx.drawImage(itemImg, 0, 0, width, height);
		}

		return thumbnailCanvas;
	}

	/**
	 * Download the current avatar as PNG
	 */
	downloadAvatar(filename: string = "8biticon.png"): void {
		this.canvas.toBlob((blob) => {
			if (!blob) return;

			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = filename;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		}, "image/png");
	}

	/**
	 * Set loading state
	 */
	private setLoading(loading: boolean): void {
		this.isLoading = loading;
		if (this.loadingIndicator) {
			this.loadingIndicator.classList.toggle("hidden", !loading);
		}
	}

	/**
	 * Get loading state
	 */
	getIsLoading(): boolean {
		return this.isLoading;
	}
}
