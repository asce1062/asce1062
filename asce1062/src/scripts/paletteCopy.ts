/**
 * Palette Copy Functionality
 *
 * Handles copying CSS variable computed values to clipboard
 * with icon toggle feedback (clipboard → checkmark)
 */

const RESET_DELAY = 2000;

/**
 * Initialize palette interactions
 */
export function initPaletteCopy(): void {
	// Swatch copy buttons
	const copyButtons = document.querySelectorAll<HTMLButtonElement>(".copy-btn");
	copyButtons.forEach((btn) => {
		btn.addEventListener("click", () => handleCopyClick(btn));
	});

	// OKLCH copy buttons (ingredients table)
	const oklchButtons = document.querySelectorAll<HTMLButtonElement>(".oklch-copy");
	oklchButtons.forEach((btn) => {
		btn.addEventListener("click", () => handleOklchCopy(btn));
	});

	// Tab labels - keyboard support for Enter/Space
	const tabLabels = document.querySelectorAll<HTMLLabelElement>(".tab-label");
	tabLabels.forEach((label) => {
		label.addEventListener("keydown", (e) => {
			if (e.key === "Enter" || e.key === " ") {
				e.preventDefault();
				label.click();
			}
		});
	});
}

/**
 * Handle swatch copy button click
 */
async function handleCopyClick(btn: HTMLButtonElement): Promise<void> {
	const cssVar = btn.getAttribute("data-css-var");
	if (!cssVar) return;

	// Get the computed color value from CSS variable
	const computedValue = window.getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim();

	try {
		await navigator.clipboard.writeText(computedValue);
		showSuccessState(btn);
	} catch (err) {
		console.error("Failed to copy:", err);
	}
}

/**
 * Handle OKLCH copy button click (ingredients table)
 */
async function handleOklchCopy(btn: HTMLButtonElement): Promise<void> {
	const oklchValue = btn.getAttribute("data-oklch");
	if (!oklchValue) return;

	const codeElement = btn.querySelector<HTMLElement>("code");
	if (!codeElement) return;

	try {
		await navigator.clipboard.writeText(oklchValue);
		showOklchCopiedState(codeElement, oklchValue);
	} catch (err) {
		console.error("Failed to copy:", err);
	}
}

/**
 * Show copied state for OKLCH values
 */
function showOklchCopiedState(codeElement: HTMLElement, originalValue: string): void {
	codeElement.textContent = "Copied!";
	codeElement.classList.add("text-success");

	setTimeout(() => {
		codeElement.textContent = originalValue;
		codeElement.classList.remove("text-success");
	}, RESET_DELAY);
}

/**
 * Show success state (toggle icons)
 */
function showSuccessState(btn: HTMLButtonElement): void {
	const copyIcon = btn.querySelector<HTMLElement>(".copy-icon");
	const checkIcon = btn.querySelector<HTMLElement>(".check-icon");

	if (!copyIcon || !checkIcon) return;

	copyIcon.classList.add("hidden");
	checkIcon.classList.remove("hidden");

	// Reset after delay
	setTimeout(() => {
		copyIcon.classList.remove("hidden");
		checkIcon.classList.add("hidden");
	}, RESET_DELAY);
}

// Auto-initialize on page load (for Astro view transitions)
document.addEventListener("astro:page-load", initPaletteCopy);
