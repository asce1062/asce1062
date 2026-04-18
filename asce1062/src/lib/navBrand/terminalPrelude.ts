type PreludeRandom = () => number;

const PRELUDE_POOL = [
	"[ waking signal ]",
	"[ restoring context ]",
	"[ aligning stars ]",
	"[ incoming transmission... ]",
	"[ tuning local horizon ]",
];

function shufflePreludeLines(random: PreludeRandom): string[] {
	const lines = [...PRELUDE_POOL];
	for (let i = lines.length - 1; i > 0; i -= 1) {
		const sample = Math.min(Math.max(random(), 0), 0.9999999999999999);
		const j = Math.floor(sample * (i + 1));
		[lines[i], lines[j]] = [lines[j], lines[i]];
	}
	return lines;
}

export function buildTerminalPrelude(options: { random?: PreludeRandom } = {}): { lines: string[] } {
	const { random = Math.random } = options;
	const lines = shufflePreludeLines(random).slice(0, 4);

	if (!lines.includes("[ waking signal ]")) {
		lines[lines.length - 1] = "[ waking signal ]";
	}

	return { lines };
}
