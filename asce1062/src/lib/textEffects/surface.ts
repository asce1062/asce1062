/**
 * Screen-reader surface for text effects.
 *
 * Effects animate by rewriting an element's text many times a second:
 * scrambled glyphs, cursors, half-typed words. Read directly, a screen reader
 * speaks those frames, and an aria-live host announces them. So the engine
 * never animates the host's own text. On first playback it splits the host:
 *
 *   <host>
 *     <span data-text-effect-frame aria-hidden="true">animated frames</span>
 *     <span data-text-effect-label class="sr-only">settled text</span>
 *   </host>
 *
 * Effects render into the frame. The label holds the stable text and changes
 * once per transition, so assistive tech reads (and live regions announce)
 * only real text. Hosts that never animate (reduced motion, no DOM) keep their
 * plain text.
 */

const FRAME_ATTR = "data-text-effect-frame";
const LABEL_ATTR = "data-text-effect-label";

function isDomElement(el: HTMLElement): boolean {
	return typeof document !== "undefined" && typeof el.querySelector === "function";
}

function childWith(host: HTMLElement, attr: string): HTMLElement | null {
	if (!isDomElement(host)) return null;
	return host.querySelector<HTMLElement>(`:scope > [${attr}]`);
}

/** The element effects render into, or null when the host has no surface. */
export function getTextEffectFrame(host: HTMLElement): HTMLElement | null {
	return childWith(host, FRAME_ATTR);
}

/**
 * Split the host into frame + label (once) and return the frame to render
 * into. Existing child nodes move into the frame, so markup survives until an
 * effect rewrites it. Without a DOM, the host itself is returned.
 */
export function ensureTextEffectSurface(host: HTMLElement): HTMLElement {
	if (!isDomElement(host)) return host;
	const existing = getTextEffectFrame(host);
	if (existing && childWith(host, LABEL_ATTR)) return existing;

	const stableText = host.dataset.textEffectStableText ?? (existing ?? host).textContent?.trim() ?? "";
	const label = document.createElement("span");
	label.setAttribute(LABEL_ATTR, "");
	label.className = "sr-only";
	label.textContent = stableText;

	// A frame that lost its label keeps its place; only the label is restored.
	if (existing) {
		existing.after(label);
		return existing;
	}

	const frame = document.createElement("span");
	frame.setAttribute(FRAME_ATTR, "");
	frame.setAttribute("aria-hidden", "true");
	frame.append(...Array.from(host.childNodes));
	host.replaceChildren(frame, label);
	return frame;
}

/** Set the text assistive tech reads, leaving the visible frame alone. */
export function setTextEffectLabel(host: HTMLElement, text: string): void {
	const label = childWith(host, LABEL_ATTR);
	// Unchanged text is not rewritten, so a live region does not re-announce it.
	if (label && label.textContent !== text) label.textContent = text;
}

/** Show settled text: in frame and label when the host has a surface, else as its text. */
export function writeTextEffectText(host: HTMLElement, text: string): void {
	const frame = getTextEffectFrame(host);
	if (!frame) {
		host.textContent = text;
		return;
	}
	frame.textContent = text;
	setTextEffectLabel(host, text);
}

/** The host's visible text, without the screen-reader label. */
export function readTextEffectText(host: HTMLElement): string {
	return getTextEffectFrame(host)?.textContent ?? host.textContent ?? "";
}
