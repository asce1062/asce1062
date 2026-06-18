/**
 * Shared adornment/creature SVG registry.
 *
 * Used by both MagicalText sparkle adornments and Haunted creature fly-outs.
 *
 * Adding a new adornment/creature:
 * 1. Add its key to `AdornmentKind` below.
 * 2. Define the SVG string constant.
 * 3. Add an entry to `ADORNMENTS`.
 * 4. Set `animationType`:
 *    - 'sparkle': rotate+scale, fits small geometric shapes.
 *    - 'scale':   scale-only, fits detailed/illustrative shapes.
 * 5. Set `colorTracked: true` if MagicalText should sync sparkle fill to the
 *    gradient position. Requires a `<path data-sparkle-path>` in the SVG.
 *    Set `false` for multi-colour SVGs that look best with their own fills.
 *
 * Removing: delete the key from `AdornmentKind` and its entry from `ADORNMENTS`.
 * Updating an SVG: change the string constant — both MagicalText and Haunted pick it up.
 */

export type AdornmentKind = "star" | "heart" | "ghost" | "ghost-alt" | "north-star" | "music-note" | "cassette";
export type AnimationType = "sparkle" | "scale";

export type AdornmentConfig = {
	/** Inline SVG string rendered into each sparkle/creature wrapper. */
	svg: string;
	/** Default animation style for MagicalText sparkles. */
	animationType: AnimationType;
	/** Whether the MagicalText rAF loop updates fill to match gradient position. */
	colorTracked: boolean;
};

// star-fill ( MIT - source: https://primer.style/octicons/icon/star-fill-24/)
const STAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><g data-sparkle-path fill="currentColor"><path d="m12.672.668 3.059 6.197 6.838.993a.75.75 0 0 1 .416 1.28l-4.948 4.823 1.168 6.812a.75.75 0 0 1-1.088.79L12 18.347l-6.116 3.216a.75.75 0 0 1-1.088-.791l1.168-6.811-4.948-4.823a.749.749 0 0 1 .416-1.279l6.838-.994L11.327.668a.75.75 0 0 1 1.345 0Z"></path></g></svg>`;

// Heart (CC0 - source: svgrepo.com/svg/165566/heart)
const HEART_SVG = `<svg viewBox="0 0 230 230" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path data-sparkle-path d="M213.588,120.982L115,213.445l-98.588-92.463C-6.537,96.466-5.26,57.99,19.248,35.047l2.227-2.083c24.51-22.942,62.984-21.674,85.934,2.842L115,43.709l7.592-7.903c22.949-24.516,61.424-25.784,85.936-2.842l2.227,2.083C235.26,57.99,236.537,96.466,213.588,120.982z" fill="currentColor"/></svg>`;

// Ghost (CC0 - source: svgrepo.com/svg/400277/ghost)
const GHOST_SVG = `<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path fill="#E6E6E6" d="M420.607,164.6v303.522c0,20.451-23.636,31.857-39.647,19.119v-0.013c-8.906-7.079-21.53-7.079-30.436,0l-24.435,19.449c-8.906,7.092-21.517,7.092-30.423,0l-24.435-19.449c-8.906-7.079-21.53-7.079-30.436,0l-24.435,19.462c-8.906,7.079-21.517,7.079-30.423,0l-24.448-19.462c-8.906-7.079-21.53-7.079-30.436,0l-0.013,0.013c-15.998,12.738-39.647,1.345-39.647-19.119V164.6C91.393,73.686,165.092,0,256.006,0c45.445,0,86.601,18.421,116.39,48.21C402.185,77.987,420.607,119.143,420.607,164.6z"/><path fill="#666666" d="M327.878,275.928H184.122c0-39.697,32.187-71.884,71.884-71.884S327.878,236.231,327.878,275.928z"/><path fill="#666666" d="M195.084,114.487c17.838,0,32.301,14.45,32.301,32.288s-14.463,32.301-32.301,32.301s-32.288-14.463-32.288-32.301S177.246,114.487,195.084,114.487z"/><path fill="#666666" d="M316.916,114.487c17.838,0,32.288,14.45,32.288,32.288s-14.45,32.301-32.288,32.301c-17.838,0-32.288-14.463-32.288-32.301S299.078,114.487,316.916,114.487z"/><path fill="#CCCCCC" d="M283.918,2.36C274.846,0.812,265.522,0,256.006,0C165.092,0,91.393,73.686,91.393,164.6v303.522c0,20.464,23.648,31.857,39.647,19.119l0.013-0.013c6.014-4.783,13.727-6.331,20.845-4.656c-2.918-3.933-4.681-8.855-4.681-14.45V164.6C147.216,83.201,206.299,15.605,283.918,2.36z"/></svg>`;

// Ghost alt (CC0 - source: svgrepo.com/svg/400277/ghost)
const GHOST_ALT_SVG = `<svg viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path fill="#D1CFC3" d="M22.541 39.677c-8.687 0-16.824-3.548-21.238-9.26a5.384 5.384 0 1 1 8.519-6.584c2.383 3.083 7.375 5.075 12.72 5.075a5.385 5.385 0 0 1-.001 10.769zm48.323-9.26a5.384 5.384 0 1 0-8.519-6.584c-2.383 3.083-7.375 5.075-12.72 5.075a5.383 5.383 0 1 0 0 10.768c8.687.001 16.825-3.546 21.239-9.259z"/><path fill="#E5E4DF" d="M60.38 68.154a4.633 4.633 0 0 1-3.438 1.429c-1.786 0-3.454-.941-4.462-2.513c-.562-.874-1.437-1.383-2.399-1.397c-.925.013-1.797.522-2.359 1.397c-1.026 1.597-2.652 2.513-4.462 2.513h-.117c-1.786 0-3.454-.941-4.462-2.513c-.562-.874-1.437-1.383-2.399-1.397c-.925.013-1.797.522-2.359 1.397c-1.026 1.597-2.655 2.513-4.465 2.513a.735.735 0 0 0-.115 0c-1.786 0-3.454-.941-4.462-2.513c-.562-.874-1.437-1.383-2.399-1.397c-.925.013-1.799.522-2.359 1.394c-1.026 1.599-2.655 2.516-4.465 2.516c-.075 0-.152-.008-.227-.024c-1.303-.056-2.431-.576-3.212-1.405c-.608-.642-1.309-1.783-1.205-3.577c.138-2.402 4.829-40.319 5.078-42.323c.057-11.085 9.087-20.086 20.186-20.086c11.097 0 20.129 8.999 20.188 20.083c.247 1.986 4.98 39.921 5.118 42.326c.105 1.794-.596 2.937-1.204 3.577z"/><path fill="#2B3B47" d="M29.464 22.523v3.656h-.005c0 .005.005.007.005.01a2.602 2.602 0 0 1-5.202 0v-.01h-.011v-3.656h.031a2.595 2.595 0 0 1 2.581-2.38a2.59 2.59 0 0 1 2.575 2.38h.026zm18.708-1.126c-.181-2.103-1.921-3.758-4.066-3.758c-2.151 0-3.892 1.655-4.075 3.758h-.049v5.773H40v.016c0 2.267 1.84 4.107 4.107 4.107s4.107-1.84 4.107-4.107c0-.004-.009-.007-.009-.016h.009v-5.773h-.042zm1.607 12.514c-.052-.101-.129-.181-.239-.193c-1.108-.11-25.417-.106-26.522 0a.299.299 0 0 0-.139.057c-.006.004-.014.003-.02.008a.39.39 0 0 0-.082.51l.241.386a18.612 18.612 0 0 0 1.658 2.262a20.765 20.765 0 0 0 1.659 1.728c1.101 1.022 2.213 1.766 3.315 2.412c.45.264.655.324.906.43c.018-.013.046-.024.065-.036c1.796.874 3.725 1.375 5.746 1.375c1.982 0 3.876-.482 5.643-1.324l.004.002c.298-.138.597-.258.898-.423c1.104-.637 2.209-1.39 3.314-2.414a19.706 19.706 0 0 0 1.655-1.737a18.424 18.424 0 0 0 1.66-2.274l.241-.388a.405.405 0 0 0 .056-.177a.369.369 0 0 0-.059-.204z"/><path fill="#FF473E" d="M42.35 33.637v7.606c0 3.358-2.716 6.081-6.066 6.081a6.078 6.078 0 0 1-6.077-6.081v-7.606H42.35z"/><path fill="#2B3B47" d="M29.619 36.086v-.831c0-2.12-5.67-1.618 6.228-1.618s7.091-.503 7.091 1.618v.831H29.619zm7.601 8.151v-6.396a.941.941 0 0 0-1.882 0v6.396a.942.942 0 0 0 1.882 0z"/></svg>`;

// north-star ( MIT - source: https://primer.style/octicons/icon/north-star-24/)
const NORTH_STAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path data-sparkle-path d="M12.5 1.25a.75.75 0 0 0-1.5 0v8.69L6.447 5.385a.75.75 0 1 0-1.061 1.06L9.94 11H1.25a.75.75 0 0 0 0 1.5h8.69l-4.554 4.553a.75.75 0 0 0 1.06 1.061L11 13.561v8.689a.75.75 0 0 0 1.5 0v-8.69l4.553 4.554a.75.75 0 0 0 1.061-1.06L13.561 12.5h8.689a.75.75 0 0 0 0-1.5h-8.69l4.554-4.553a.75.75 0 1 0-1.06-1.061L12.5 9.939V1.25Z" fill="currentColor"></path></svg>`;

// Music note (MIT - source: https://icons.getbootstrap.com/icons/music-note/)
const MUSIC_NOTE = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><g data-sparkle-path fill="currentColor"><path d="M9 13c0 1.105-1.12 2-2.5 2S4 14.105 4 13s1.12-2 2.5-2 2.5.895 2.5 2"/><path fill-rule="evenodd" d="M9 3v10H8V3z"/><path d="M8 2.82a1 1 0 0 1 .804-.98l3-.6A1 1 0 0 1 13 2.22V4L8 5z"/></g></svg>`;

// Cassette tape (MIT - source: https://icons.getbootstrap.com/icons/cassette-fill/)
const CASSETTE = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-cassette-fill" viewBox="0 0 16 16"><g data-sparkle-path fill="currentColor">
  <path d="M1.5 2A1.5 1.5 0 0 0 0 3.5v9A1.5 1.5 0 0 0 1.5 14h.191l1.862-3.724A.5.5 0 0 1 4 10h8a.5.5 0 0 1 .447.276L14.31 14h.191a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 14.5 2zM4 7a1 1 0 1 1 0-2 1 1 0 0 1 0 2m8 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2M6 6a1 1 0 0 1 1-1h2a1 1 0 0 1 0 2H7a1 1 0 0 1-1-1"/>
  <path d="m13.191 14-1.5-3H4.309l-1.5 3z"/></g>
</svg>`;

export const ADORNMENTS: Record<AdornmentKind, AdornmentConfig> = {
	star: {
		svg: STAR_SVG,
		animationType: "sparkle",
		colorTracked: true,
	},
	heart: {
		svg: HEART_SVG,
		animationType: "sparkle",
		colorTracked: true,
	},
	ghost: {
		svg: GHOST_SVG,
		animationType: "scale",
		colorTracked: false,
	},
	"ghost-alt": {
		svg: GHOST_ALT_SVG,
		animationType: "scale",
		colorTracked: false,
	},
	"north-star": {
		svg: NORTH_STAR_SVG,
		animationType: "scale",
		colorTracked: true,
	},
	"music-note": {
		svg: MUSIC_NOTE,
		animationType: "scale",
		colorTracked: true,
	},
	cassette: {
		svg: CASSETTE,
		animationType: "scale",
		colorTracked: true,
	},
};
