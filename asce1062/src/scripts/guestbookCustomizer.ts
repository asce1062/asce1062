interface EntryStyle {
	bg: string;
	borderColor: string;
	borderWidth: string;
	borderStyle: string;
	borderRadius: string;
}

const defaults: EntryStyle = {
	bg: "none",
	borderColor: "base-300",
	borderWidth: "1px",
	borderStyle: "solid",
	borderRadius: "0.25rem",
};

export function initGuestbookCustomizer() {
	const hiddenInput = document.getElementById("style-input") as HTMLInputElement | null;
	const panel = document.getElementById("customizer-panel") as HTMLElement | null;
	const doneBtn = document.getElementById("customizer-done") as HTMLButtonElement | null;
	const randomBtn = document.getElementById("customizer-random") as HTMLButtonElement | null;
	const patternSelect = document.getElementById("pattern-select") as HTMLSelectElement | null;
	const patternSwatch = document.getElementById("pattern-swatch") as HTMLElement | null;
	const textareaWrapper = document.getElementById("textarea-wrapper") as HTMLElement | null;
	const widthSlider = document.getElementById("border-width-slider") as HTMLInputElement | null;
	const widthLabel = document.getElementById("border-width-label") as HTMLElement | null;

	const widthSteps = ["0.5px", "1px", "1.5px", "2px", "2.5px", "3px", "3.5px", "4px"];

	if (!hiddenInput || !panel) return;

	const body = panel.querySelector<HTMLElement>(".expand-body");
	if (!body) return;

	function closePanel() {
		body!.hidden = true;
	}

	doneBtn?.addEventListener("click", () => closePanel());

	document.addEventListener("click", (e) => {
		const el = e.target as HTMLElement;
		if (!body!.hidden && !panel!.contains(el) && !randomBtn?.contains(el)) {
			closePanel();
		}
	});

	function pick<T>(arr: T[]): T {
		return arr[Math.floor(Math.random() * arr.length)];
	}

	const state: EntryStyle = { ...defaults };

	function serialize() {
		if (!hiddenInput) return;
		hiddenInput.value = JSON.stringify(state);
	}

	function setPatternUrl(el: HTMLElement, bg: string) {
		if (bg === "none") {
			el.style.setProperty("--pattern-url", "none");
		} else {
			el.style.setProperty("--pattern-url", `url(/notecards/${bg}.svg)`);
		}
	}

	function updatePatternSwatch() {
		if (!patternSwatch) return;
		setPatternUrl(patternSwatch, state.bg);
	}

	function updateTextarea() {
		if (!textareaWrapper) return;
		setPatternUrl(textareaWrapper, state.bg);
		textareaWrapper.style.borderColor = `var(--color-${state.borderColor})`;
		textareaWrapper.style.borderWidth = state.borderWidth;
		textareaWrapper.style.borderStyle = state.borderStyle;
		textareaWrapper.style.borderRadius = state.borderRadius;
	}

	function updateWidthUI() {
		const idx = widthSteps.indexOf(state.borderWidth);
		if (idx === -1) return;
		if (widthSlider) widthSlider.value = String(idx);
		if (widthLabel) {
			widthLabel.textContent = state.borderWidth;
			const pct = idx / 7;
			// Compensate for thumb width (1.25rem) so label stays centered over thumb
			widthLabel.style.left = `calc(${pct * 100}% + ${(0.5 - pct) * 1.25}rem)`;
		}
	}

	function updateAll() {
		updatePatternSwatch();
		updateWidthUI();
		updateTextarea();
		serialize();
	}

	// Pattern dropdown
	patternSelect?.addEventListener("change", () => {
		state.bg = patternSelect.value;
		updateAll();
	});

	// Hover preview helpers
	function previewStyle(prop: string, value: string) {
		if (!textareaWrapper) return;
		textareaWrapper.style.setProperty(prop, value);
	}

	function restorePreview() {
		updateTextarea();
	}

	// Border radius options
	document.querySelectorAll<HTMLElement>("[data-radius]").forEach((el) => {
		el.addEventListener("click", () => {
			state.borderRadius = el.dataset.radius!;
			document.querySelectorAll("[data-radius]").forEach((e) => e.classList.remove("selected"));
			el.classList.add("selected");
			updateAll();
		});
		el.addEventListener("mouseenter", () => previewStyle("border-radius", el.dataset.radius!));
		el.addEventListener("mouseleave", restorePreview);
	});

	// Border width slider
	widthSlider?.addEventListener("input", () => {
		const idx = parseInt(widthSlider.value, 10);
		state.borderWidth = widthSteps[idx];
		updateAll();
	});

	// Border color swatches
	document.querySelectorAll<HTMLElement>("[data-border-color]").forEach((el) => {
		el.addEventListener("click", () => {
			state.borderColor = el.dataset.borderColor!;
			document.querySelectorAll("[data-border-color]").forEach((e) => e.classList.remove("selected"));
			el.classList.add("selected");
			updateAll();
		});
		el.addEventListener("mouseenter", () => previewStyle("border-color", `var(--color-${el.dataset.borderColor})`));
		el.addEventListener("mouseleave", restorePreview);
	});

	// Border style options
	document.querySelectorAll<HTMLElement>("[data-border-style]").forEach((el) => {
		el.addEventListener("click", () => {
			state.borderStyle = el.dataset.borderStyle!;
			document.querySelectorAll("[data-border-style]").forEach((e) => e.classList.remove("selected"));
			el.classList.add("selected");
			// double needs >= 3px to show the gap between lines
			if (state.borderStyle === "double") {
				const w = parseFloat(state.borderWidth);
				if (w < 3) {
					state.borderWidth = "3px";
				}
			}
			updateAll();
		});
		el.addEventListener("mouseenter", () => previewStyle("border-style", el.dataset.borderStyle!));
		el.addEventListener("mouseleave", restorePreview);
	});

	// Sync all UI controls to match current state
	function syncUI() {
		if (patternSelect) patternSelect.value = state.bg;

		document.querySelectorAll("[data-radius]").forEach((e) => e.classList.remove("selected"));
		document.querySelector(`[data-radius="${state.borderRadius}"]`)?.classList.add("selected");

		document.querySelectorAll("[data-border-color]").forEach((e) => e.classList.remove("selected"));
		document.querySelector(`[data-border-color="${state.borderColor}"]`)?.classList.add("selected");

		document.querySelectorAll("[data-border-style]").forEach((e) => e.classList.remove("selected"));
		document.querySelector(`[data-border-style="${state.borderStyle}"]`)?.classList.add("selected");
	}

	// Randomize
	const patterns = Array.from(patternSelect?.options ?? []).map((o) => o.value);
	const colors = Array.from(document.querySelectorAll<HTMLElement>("[data-border-color]")).map(
		(e) => e.dataset.borderColor!
	);
	const radii = Array.from(document.querySelectorAll<HTMLElement>("[data-radius]")).map((e) => e.dataset.radius!);
	const styles = Array.from(document.querySelectorAll<HTMLElement>("[data-border-style]")).map(
		(e) => e.dataset.borderStyle!
	);

	randomBtn?.addEventListener("click", () => {
		state.bg = pick(patterns);
		state.borderColor = pick(colors);
		state.borderRadius = pick(radii);
		state.borderStyle = pick(styles);
		state.borderWidth = pick(widthSteps);
		// double needs >= 3px
		if (state.borderStyle === "double" && parseFloat(state.borderWidth) < 3) {
			state.borderWidth = "3px";
		}
		syncUI();
		updateAll();
	});

	// Initialize
	syncUI();
	updateAll();
}
