export type Gender = "male" | "female";

interface AvatarLayer {
	name: string;
	title: string;
	count: number;
	zIndex: number;
}

interface AvatarConfig {
	male: AvatarLayer[];
	female: AvatarLayer[];
}

export const avatarConfig: AvatarConfig = {
	male: [
		{ name: "face", title: "Face", count: 4, zIndex: 1 },
		{ name: "clothes", title: "Clothes", count: 65, zIndex: 2 },
		{ name: "hair", title: "Hair", count: 36, zIndex: 3 },
		{ name: "eye", title: "Eyes", count: 32, zIndex: 4 },
		{ name: "mouth", title: "Mouth", count: 26, zIndex: 5 },
		{ name: "background", title: "Background", count: 21, zIndex: 0 },
	],
	female: [
		{ name: "face", title: "Face", count: 4, zIndex: 1 },
		{ name: "clothes", title: "Clothes", count: 59, zIndex: 2 },
		{ name: "hair", title: "Hair", count: 33, zIndex: 3 },
		{ name: "eye", title: "Eyes", count: 53, zIndex: 4 },
		{ name: "mouth", title: "Mouth", count: 17, zIndex: 5 },
		{ name: "background", title: "Background", count: 21, zIndex: 0 },
	],
};

export interface AvatarState {
	[layerName: string]: number;
}

export const getImagePath = (gender: Gender, layer: string, index: number): string => {
	// Backgrounds are shared between genders, stored in common directory
	if (layer === "background") {
		return `/8bit/img/common/${layer}${index}.png`;
	}
	return `/8bit/img/${gender}/${layer}${index}.png`;
};

export const getRandomState = (gender: Gender): AvatarState => {
	const layers = avatarConfig[gender];
	const state: AvatarState = {};

	layers.forEach((layer) => {
		state[layer.name] = Math.floor(Math.random() * layer.count) + 1;
	});

	return state;
};

export const getDefaultState = (gender: Gender): AvatarState => {
	const layers = avatarConfig[gender];
	const state: AvatarState = {};

	// Default avatars: male = 3-54-12-14-15-21, female = 4-26-32-22-3-3
	// Order: face-clothes-hair-eyes-mouth-background
	const defaults = {
		male: [3, 54, 12, 14, 15, 21],
		female: [4, 26, 32, 22, 3, 3],
	};

	const defaultValues = defaults[gender];

	layers.forEach((layer, index) => {
		state[layer.name] = defaultValues[index];
	});

	return state;
};
