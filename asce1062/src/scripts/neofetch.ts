/**
 * Neofetch Widget
 *
 * Reads ASCII art variants from the #neofetch-data element,
 * picks a random variant on each page load,
 * and wires the dice button to re-roll without repeating the previous variant.
 */

function initNeofetch(): void {
	const dataEl = document.getElementById("neofetch-data");
	const artEl = document.getElementById("neofetch-art");
	const fontEl = document.getElementById("neofetch-font-label");
	const btn = document.getElementById("neofetch-randomize");
	if (!dataEl || !artEl || !fontEl) return;

	type Variant = { font: string; art: string };
	const variants: Variant[] = JSON.parse((dataEl as HTMLElement).dataset.variants ?? "[]");
	if (!variants.length) return;

	let current = -1;

	function pick(): Variant {
		// avoid repeating the same variant twice in a row
		let idx: number;
		do {
			idx = Math.floor(Math.random() * variants.length);
		} while (idx === current && variants.length > 1);
		current = idx;
		return variants[idx]!;
	}

	function render(v: Variant): void {
		artEl!.textContent = v.art.trimEnd();
		fontEl!.textContent = `[${v.font}]`;
	}

	render(pick());
	btn?.addEventListener("click", () => render(pick()));
}

document.addEventListener("astro:page-load", initNeofetch);
