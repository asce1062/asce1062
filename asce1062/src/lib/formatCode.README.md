# Code Formatting Utility

Reusable code formatting using [rehype-pretty-code](https://rehype-pretty.pages.dev/).

## Features

- ✨ **Syntax highlighting** powered by Shiki
- 🎨 **Automatic dark/light mode** support with CSS variables
- 📋 **Copy button** with visual feedback
- 🔢 **Line numbers** and **line highlighting**
- 🎯 **Word/character highlighting** with IDs
- 📝 **Inline code** highlighting
- 🎬 **Custom titles and captions**
- 🔧 **Highly customizable** with all rehype-pretty-code options

## Basic Usage

### Format Code Blocks

```typescript
import { formatCode } from "@/lib/formatCode";

// Simple code formatting
const html = await formatCode("const x = 1;", { lang: "typescript" });

// With line numbers
const html = await formatCode(code, {
	lang: "javascript",
	showLineNumbers: true,
});

// With highlighted lines
const html = await formatCode(code, {
	lang: "tsx",
	showLineNumbers: true,
	highlightLines: [1, 2, 5], // Highlight lines 1, 2, and 5
});

// With title and caption
const html = await formatCode(code, {
	lang: "typescript",
	title: "MyComponent.tsx",
	caption: "Example React component",
	showLineNumbers: true,
});
```

### Format JSON

```typescript
import { formatJSON } from "@/lib/formatCode";

const data = { name: "John", age: 30 };

const html = await formatJSON(data, {
	showLineNumbers: true,
	showCopyButton: true,
});
```

### Format Inline Code

```typescript
import { formatInlineCode } from "@/lib/formatCode";

// With language highlighting
const html = await formatInlineCode("useState(0)", { lang: "js" });

// With token highlighting
const html = await formatInlineCode("getStringLength", {
	token: "entity.name.function",
});

// With custom token map
const html = await formatInlineCode("getStringLength", {
	token: "fn",
	tokensMap: { fn: "entity.name.function" },
});
```

## Presets

Use predefined configurations for common use cases:

```typescript
import { formatCode, presets } from "@/lib/formatCode";

// Default preset (auto theme, copy button)
const html = await formatCode(code, { ...presets.default, lang: "js" });

// Minimal preset (no background, no copy button)
const html = await formatCode(code, { ...presets.minimal, lang: "js" });

// Documentation preset (with line numbers)
const html = await formatCode(code, { ...presets.docs, lang: "js" });
```

## Advanced Features

### Multiple Highlighted Line Groups

```typescript
const html = await formatCode(code, {
	lang: "javascript",
	highlightLineIds: {
		added: [1, 2, 3], // Lines 1-3 marked as 'added'
		removed: [5, 6], // Lines 5-6 marked as 'removed'
	},
});
```

Style with CSS:

```css
[data-highlighted-line-id="added"] {
	background-color: rgba(0, 255, 0, 0.1);
}

[data-highlighted-line-id="removed"] {
	background-color: rgba(255, 0, 0, 0.1);
}
```

### Character Highlighting

```typescript
const html = await formatCode(code, {
	lang: "javascript",
	highlightChars: ["/carrot/", "/apple/"], // Highlight these words
});

// Or with IDs for different styling
const html = await formatCode(code, {
	lang: "typescript",
	highlightChars: {
		v: "/age/", // Variable
		s: "/setAge/", // Setter
		i: "/50/", // Initial value
	},
});
```

### Theme Options

```typescript
// Auto (default): Uses both light and dark themes with CSS variables
const html = await formatCode(code, { theme: "auto" });

// Light theme only
const html = await formatCode(code, { theme: "light" });

// Dark theme only
const html = await formatCode(code, { theme: "dark" });

// Custom theme
import customTheme from "./my-theme.json";
const html = await formatCode(code, { theme: customTheme });
```

### Custom Transformers

```typescript
import { transformerNotationDiff } from "@shikijs/transformers";

const html = await formatCode(code, {
	lang: "javascript",
	transformers: [transformerNotationDiff()],
});
```

### Visitor Hooks

```typescript
const html = await formatCode(code, {
	lang: "typescript",
	onVisitLine(element) {
		// Customize each line element
		console.log("Processing line:", element);
	},
	onVisitHighlightedLine(element) {
		// Customize highlighted lines
		element.properties.className.push("my-highlight");
	},
	onVisitHighlightedChars(element, id) {
		// Customize highlighted characters
		console.log("Highlighted chars with id:", id);
	},
});
```

## Component Examples

### Astro Component

```astro
---
import { formatCode } from "@/lib/formatCode";

const code = `function hello() {
  console.log("Hello, world!");
}`;

const html = await formatCode(code, {
	lang: "javascript",
	showLineNumbers: true,
	title: "hello.js",
});
---

<div set:html={html} />
```

### Client-Side JavaScript

```astro
<script>
	import { formatJSON } from "@/lib/formatCode";
	import type { Track } from "@/types/music";

	async function displayTrackDetails(track: Track) {
		const html = await formatJSON(track, {
			theme: "auto",
			showCopyButton: true,
		});

		document.getElementById("output").innerHTML = html;
	}
</script>
```

## CSS Styling

The utility doesn't include styles by default. Add your own:

```css
/* Basic code block styling */
pre {
	overflow-x: auto;
	padding: 1rem 0;
	border-radius: 0.5rem;
}

pre [data-line] {
	padding: 0 1rem;
}

/* Line numbers */
code[data-line-numbers] {
	counter-reset: line;
}

code[data-line-numbers] > [data-line]::before {
	counter-increment: line;
	content: counter(line);
	display: inline-block;
	width: 2rem;
	margin-right: 1rem;
	text-align: right;
	color: #6b7280;
}

/* Highlighted lines */
[data-highlighted-line] {
	background-color: rgba(100, 100, 255, 0.1);
	border-left: 2px solid #6366f1;
}

/* Highlighted chars */
[data-highlighted-chars] {
	background-color: rgba(255, 255, 0, 0.2);
	padding: 0.125rem 0.25rem;
	border-radius: 0.25rem;
}

/* Auto dark/light theme */
code[data-theme*=" "],
code[data-theme*=" "] span {
	color: var(--shiki-light);
	background-color: var(--shiki-light-bg);
}

@media (prefers-color-scheme: dark) {
	code[data-theme*=" "],
	code[data-theme*=" "] span {
		color: var(--shiki-dark);
		background-color: var(--shiki-dark-bg);
	}
}
```

## API Reference

### `formatCode(code, options)`

Format a code block with syntax highlighting.

**Parameters:**

- `code: string` - The code to format
- `options: CodeFormatOptions` - Formatting options (see below)

**Returns:** `Promise<string>` - HTML string

### `formatJSON(data, options)`

Format JSON data with syntax highlighting.

**Parameters:**

- `data: unknown` - Data to format as JSON
- `options: Omit<CodeFormatOptions, 'lang'>` - Formatting options

**Returns:** `Promise<string>` - HTML string

### `formatInlineCode(code, options)`

Format inline code with syntax highlighting.

**Parameters:**

- `code: string` - The inline code to format
- `options: { lang?, token?, theme?, tokensMap? }` - Formatting options

**Returns:** `Promise<string>` - HTML string

### `CodeFormatOptions`

All available options:

```typescript
interface CodeFormatOptions {
	lang?: string; // Language for syntax highlighting
	theme?: "auto" | "light" | "dark" | Theme | Record<string, Theme>;
	keepBackground?: boolean; // Keep theme background (default: true)
	showLineNumbers?: boolean; // Show line numbers (default: false)
	highlightLines?: number[] | [number, number][]; // Lines to highlight
	highlightLineIds?: Record<string, number[]>; // Highlighted line groups
	highlightChars?: string[] | Record<string, string>; // Chars to highlight
	title?: string; // Code block title
	caption?: string; // Code block caption
	showCopyButton?: boolean; // Show copy button (default: true)
	copyButtonDuration?: number; // Copy feedback duration (default: 2500)
	transformers?: ShikiTransformer[]; // Additional transformers
	tokensMap?: Record<string, string>; // Custom token mappings
	disableGrid?: boolean; // Disable grid layout (default: false)
	defaultLang?: string | { block?; inline? }; // Default language
	onVisitLine?: (element: any) => void;
	onVisitHighlightedLine?: (element: any) => void;
	onVisitHighlightedChars?: (element: any, id?: string) => void;
	onVisitTitle?: (element: any) => void;
	onVisitCaption?: (element: any) => void;
}
```

## References

- [rehype-pretty-code Documentation](https://rehype-pretty.pages.dev/)
- [Shiki Documentation](https://shiki.style/)
- [VS Code Themes](https://vscodethemes.com/)
