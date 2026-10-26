/**
 * Finds words that render glued together across an inline tag boundary,
 * e.g. `read<em>more</em>` shows as "readmore". Astro and MDX trim the
 * whitespace around tags in some layouts, so the source can look right while
 * the built page is not.
 *
 * A boundary is glued when a letter on one side of an inline element touches a
 * letter on the other side with no whitespace between them. Only letters count,
 * so footnote refs (`word<sup>1</sup>`) and punctuation (`<a>link</a>.`) pass.
 * Layout decides what shares a line, so this reads computed styles: children of
 * flex and grid containers, block-level, hidden and out-of-flow elements never
 * glue.
 *
 * Not checked:
 *   - span: text effects split words into per-letter spans on purpose.
 *   - pre, script, style, svg, template, noscript, [aria-hidden="true"].
 *
 * SELF-CONTAINED: e2e/site/glued-words.site.ts passes this function to
 * page.evaluate(), which serializes its source, so it must not reference
 * anything outside its own body.
 */

/**
 * @typedef {{ tag: string, side: "before" | "after", snippet: string }} GluedWord
 */

/**
 * @param {Document} [doc]
 * @returns {GluedWord[]}
 */
export function findGluedWords(doc = document) {
	const INLINE_TAGS = new Set([
		"A",
		"ABBR",
		"B",
		"CITE",
		"CODE",
		"DEL",
		"DFN",
		"EM",
		"I",
		"INS",
		"KBD",
		"MARK",
		"Q",
		"S",
		"SAMP",
		"SMALL",
		"STRONG",
		"SUB",
		"SUP",
		"TIME",
		"U",
		"VAR",
	]);
	const SKIP_SELECTOR = 'pre, script, style, svg, template, noscript, [aria-hidden="true"]';
	// Code identifiers take English suffixes: `<code>Promise</code>s`, `<code>fetch</code>ing`.
	const CODE_TAGS = new Set(["CODE", "KBD", "SAMP", "VAR"]);
	const CODE_SUFFIX = /^(?:s|es|ed|ing)(?!\p{L})/u;
	// Code spans inside code-like text are code, not glued prose: .default(sql<code>NOW</code>).
	const CODE_PUNCTUATION = /[.()[\]{}=<>$/\\]/;
	const LETTER = /\p{L}/u;
	const CONTEXT_CHARS = 24;
	const view = /** @type {Window} */ (doc.defaultView);

	/** @param {string} char */
	const isLetter = (char) => char !== "" && LETTER.test(char);

	/** @param {Element} el */
	const isHidden = (el) => {
		const style = view.getComputedStyle(el);
		return style.display === "none" || style.visibility === "hidden";
	};

	/** An element that flows in a line of text, next to its siblings. @param {Element} el */
	const flowsInline = (el) => {
		const style = view.getComputedStyle(el);
		return style.display.startsWith("inline") && style.position !== "absolute" && style.position !== "fixed";
	};

	/** Children of flex and grid containers are laid out as separate boxes. @param {Element} el */
	const laysOutChildrenAsBoxes = (el) => /(?:flex|grid)$/.test(view.getComputedStyle(el).display);

	/**
	 * Text that shares a line with `el` on one side, or "" when nothing does.
	 * @param {Element} el
	 * @param {"previousSibling" | "nextSibling"} side
	 */
	const neighbourText = (el, side) => {
		let node = el[side];
		// Comments and hidden elements take no space: look past them.
		while (node && (node.nodeType === 8 || (node.nodeType === 1 && isHidden(/** @type {Element} */ (node))))) {
			node = node[side];
		}
		if (!node) return "";
		if (node.nodeType === 3) return node.textContent ?? "";
		return flowsInline(/** @type {Element} */ (node)) ? (node.textContent ?? "") : "";
	};

	/** @param {string} before @param {Element} el @param {string} after */
	const snippet = (before, el, after) => {
		const left = before.slice(-CONTEXT_CHARS).replace(/\s+/g, " ").trimStart();
		const right = after.slice(0, CONTEXT_CHARS).replace(/\s+/g, " ").trimEnd();
		const tag = el.tagName.toLowerCase();
		return `${left}<${tag}>${el.textContent}</${tag}>${right}`;
	};

	/** A code element whose touching token (the non-space run beside it) is code. @param {Element} el @param {string} token */
	const isCodeContext = (el, token) => CODE_TAGS.has(el.tagName) && CODE_PUNCTUATION.test(token);

	/** @type {GluedWord[]} */
	const found = [];

	for (const el of doc.body.querySelectorAll("*")) {
		if (!INLINE_TAGS.has(el.tagName) || el.closest(SKIP_SELECTOR)) continue;
		const text = el.textContent ?? "";
		if (text === "" || isHidden(el) || !flowsInline(el)) continue;
		if (el.parentElement && laysOutChildrenAsBoxes(el.parentElement)) continue;

		const before = neighbourText(el, "previousSibling");
		const after = neighbourText(el, "nextSibling");
		const tag = el.tagName.toLowerCase();

		if (isLetter(before.slice(-1)) && isLetter(text.charAt(0))) {
			if (!isCodeContext(el, before.split(/\s/).pop() ?? "")) {
				found.push({ tag, side: "before", snippet: snippet(before, el, after) });
			}
		}
		if (isLetter(text.slice(-1)) && isLetter(after.charAt(0))) {
			if (CODE_TAGS.has(el.tagName) && CODE_SUFFIX.test(after)) continue;
			if (isCodeContext(el, after.split(/\s/)[0])) continue;
			found.push({ tag, side: "after", snippet: snippet(before, el, after) });
		}
	}

	return found;
}
