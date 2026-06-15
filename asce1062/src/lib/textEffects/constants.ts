import type { TextEffectKind, TextEffectTrigger } from "./types";

/**
 * Default trigger set for generic decorative text.
 *
 * Consumers can stack extra triggers such as `random-effect` / `random-time`
 * without losing the base load/hover/tap/click behavior.
 */
export const DEFAULT_TEXT_EFFECT_TRIGGERS: TextEffectTrigger[] = ["load", "hover", "tap", "click"];
export const DEFAULT_RANDOM_INTERVAL_MS = 20_000;
export const DEFAULT_IDLE_RETURN_DELAY_MS = 45_000;

export const DECRYPT_CHARS = "░▒▓█▐▌▄▀■□▪▫◆◇○●◌◍◎◉▶▷◀◁▸▹◂◃⬛⬜▬▭▮▯◥◤◣◢◿█▄▌▐▀▘▝▀▖▍▞▛▗▚▐▜▃▙▟▉";
export const DEFAULT_TYPING_STEP_MS = 26;
export const DEFAULT_TYPING_STEP_VARIANCE_MS = 42;
export const DEFAULT_TYPING_MIN_DURATION_MS = 780;
export const DEFAULT_TYPING_MAX_DURATION_MS = 2_400;
export const DEFAULT_TYPING_BASE_MULTIPLIER = 2.4;
export const DEFAULT_TYPING_SHORT_TEXT_THRESHOLD = 8;
export const DEFAULT_TYPING_SHORT_TEXT_BONUS_MULTIPLIER = 1.4;
export const DEFAULT_TYPING_LEAD_IN_MS = 120;
export const DEFAULT_TYPING_END_BLINK_INTERVAL_MS = 500;
export const DEFAULT_TYPING_END_BLINK_COUNT = 3;
export const DEFAULT_HUMAN_PAUSE_CHANCE = 0.12;
export const DEFAULT_HUMAN_PAUSE_MIN_MS = 140;
export const DEFAULT_HUMAN_PAUSE_MAX_MS = 420;
export const DEFAULT_DECRYPT_TOTAL_FRAMES = 40;
export const DEFAULT_BACKSPACE_STEP_MS = 42;
export const DEFAULT_BACKSPACE_HOLD_MS = 140;
export const DEFAULT_ENTROPY_TOTAL_FRAMES = 22;
export const DEFAULT_GLITCH_LOCK_TOTAL_FRAMES = 6;
export const DEFAULT_SIGNAL_LOSS_TOTAL_FRAMES = 7;
export const DEFAULT_SIGNAL_LOSS_BLACKOUT_HOLD_MS = 760;
export const DEFAULT_TRANSITION_HOLD_MS = 80;
export const DEFAULT_ROUTE_ENTER_SETTLE_DELAY_MS = 1062;
export const TERMINAL_BLOCK_CURSOR = "█";
export const SIGNAL_ARTIFACTS = [" ", "_", "-", "|", "/", "\\"] as const;
export const GLITCH_CHARSET_LETTERS = "abcdefghijklmnopqrstuvwxyz";
export const GLITCH_CHARSET_BINARY = "01";
export const DEFAULT_SIGNAL_DROPOUT_CHAR = "_";
export const DEFAULT_CENSOR_CHAR = "█";
export const DEFAULT_CORRUPTION_COUNT = 10;
export const DEFAULT_CORRUPTION_INTENSITY = 0.5;
export const DEFAULT_CORRUPTION_ITEMS = [
	"̴",
	"̵",
	"̶",
	"̷",
	"̸",
	"▓",
	"░",
	"▒",
	"⌗",
	"⌖",
	"⌘",
	"⌛",
	"⍨",
	"⌂",
	"#",
	"!",
	"@",
	"$",
	"%",
	"^",
	"&",
	"*",
	"~",
	"|",
	"/",
	"\\",
	"<",
	">",
] as const;
export const DEFAULT_SCRAMBLE_COUNT = 20;
export const DEFAULT_SCRAMBLE_ITEMS = ["#", "!", "@", "$", "%", "^", "&", "*", "(", ")", "-", "_", "+", "="] as const;
export const DEFAULT_SLOW_REVEAL_CYCLES_PER_CHAR = 3;
export const DEFAULT_SHUFFLE_COUNT = 20;

export const EFFECT_DURATION_PROFILES: Record<
	TextEffectKind,
	{
		minMs: number;
		maxMs: number;
		perCharMs: number;
		baseMs: number;
	}
> = {
	typing: {
		minMs: DEFAULT_TYPING_MIN_DURATION_MS,
		maxMs: DEFAULT_TYPING_MAX_DURATION_MS,
		perCharMs: DEFAULT_TYPING_STEP_MS * DEFAULT_TYPING_BASE_MULTIPLIER,
		baseMs: DEFAULT_TYPING_LEAD_IN_MS,
	},
	backspace: {
		minMs: 620,
		maxMs: 1_600,
		perCharMs: 46,
		baseMs: DEFAULT_BACKSPACE_HOLD_MS,
	},
	decrypt: {
		minMs: 760,
		maxMs: 1_400,
		perCharMs: 18,
		baseMs: 620,
	},
	entropy: {
		minMs: 620,
		maxMs: 1_200,
		perCharMs: 16,
		baseMs: 500,
	},
	"glitch-lock-on": {
		minMs: 420,
		maxMs: 760,
		perCharMs: 8,
		baseMs: 360,
	},
	"signal-loss": {
		minMs: 420,
		maxMs: 820,
		perCharMs: 10,
		baseMs: 360,
	},
	corruption: {
		minMs: 280,
		maxMs: 560,
		perCharMs: 2,
		baseMs: 280,
	},
	censor: {
		minMs: 360,
		maxMs: 740,
		perCharMs: 12,
		baseMs: 280,
	},
	uncensor: {
		minMs: 360,
		maxMs: 740,
		perCharMs: 12,
		baseMs: 280,
	},
	scramble: {
		minMs: 380,
		maxMs: 860,
		perCharMs: 8,
		baseMs: 300,
	},
	"slow-reveal": {
		minMs: 620,
		maxMs: 1_600,
		perCharMs: 20,
		baseMs: 440,
	},
	shuffle: {
		minMs: 380,
		maxMs: 860,
		perCharMs: 8,
		baseMs: 300,
	},
};
