import { describe, expect, it } from "vitest";

import {
	advanceMusicQueue,
	createMusicPlaybackState,
	formatMusicDuration,
	getMusicPlayerFlavorFromSiteFlavor,
	getNextMusicPlayerFlavor,
	getSiteFlavorFromMusicPlayerFlavor,
	MUSIC_PLAYER_FLAVORS,
	moveMusicQueueNext,
	moveMusicQueuePrevious,
	selectMusicTrack,
	setMusicShuffleEnabled,
	type MusicPlaybackTrack,
} from "@/lib/musicPlayer";

// These tests lock the pure queue/state contract used by the floating player.
// Browser audio events decide when to call helpers; helpers decide what the
// next queue action should be.
describe("music player helpers", () => {
	const tracks = [
		{ id: "a", title: "Alpha" },
		{ id: "b", title: "Beta" },
		{ id: "c", title: "Gamma" },
	] satisfies Array<MusicPlaybackTrack & { title: string }>;

	it("formats durations as mm:ss", () => {
		expect(formatMusicDuration(0)).toBe("00:00");
		expect(formatMusicDuration(3)).toBe("00:03");
		expect(formatMusicDuration(236)).toBe("03:56");
		expect(formatMusicDuration(Number.NaN)).toBe("00:00");
	});

	it("cycles through local player flavors without mutating the site theme", () => {
		expect(MUSIC_PLAYER_FLAVORS).toEqual(["DEFAULT", "CRT", "AMBER", "SYNTHWAVE", "DOS", "VOID", "ICE", "REDLINE"]);
		expect(getNextMusicPlayerFlavor("DEFAULT")).toBe("CRT");
		expect(getNextMusicPlayerFlavor("VOID")).toBe("ICE");
		expect(getNextMusicPlayerFlavor("ICE")).toBe("REDLINE");
		expect(getNextMusicPlayerFlavor("REDLINE")).toBe("DEFAULT");
		expect(getNextMusicPlayerFlavor("UNKNOWN")).toBe("DEFAULT");
	});

	it("maps the active site flavor to the local player flavor", () => {
		expect(getMusicPlayerFlavorFromSiteFlavor(null)).toBe("DEFAULT");
		expect(getMusicPlayerFlavorFromSiteFlavor("")).toBe("DEFAULT");
		expect(getMusicPlayerFlavorFromSiteFlavor("crt-green")).toBe("CRT");
		expect(getMusicPlayerFlavorFromSiteFlavor("amber")).toBe("AMBER");
		expect(getMusicPlayerFlavorFromSiteFlavor("synthwave")).toBe("SYNTHWAVE");
		expect(getMusicPlayerFlavorFromSiteFlavor("dos")).toBe("DOS");
		expect(getMusicPlayerFlavorFromSiteFlavor("void")).toBe("VOID");
		expect(getMusicPlayerFlavorFromSiteFlavor("ice")).toBe("ICE");
		expect(getMusicPlayerFlavorFromSiteFlavor("redline")).toBe("REDLINE");
	});

	it("maps local player flavors back to site flavor ids for scoped theme tokens", () => {
		expect(getSiteFlavorFromMusicPlayerFlavor("DEFAULT")).toBe("");
		expect(getSiteFlavorFromMusicPlayerFlavor("CRT")).toBe("crt-green");
		expect(getSiteFlavorFromMusicPlayerFlavor("AMBER")).toBe("amber");
		expect(getSiteFlavorFromMusicPlayerFlavor("SYNTHWAVE")).toBe("synthwave");
		expect(getSiteFlavorFromMusicPlayerFlavor("DOS")).toBe("dos");
		expect(getSiteFlavorFromMusicPlayerFlavor("VOID")).toBe("void");
		expect(getSiteFlavorFromMusicPlayerFlavor("ICE")).toBe("ice");
		expect(getSiteFlavorFromMusicPlayerFlavor("REDLINE")).toBe("redline");
	});

	it("creates playlist-order queue by default", () => {
		const state = createMusicPlaybackState(tracks);

		expect(state.playlistTracks).toEqual(tracks);
		expect(state.queue.map((track) => track.id)).toEqual(["a", "b", "c"]);
		expect(state.currentQueueIndex).toBe(-1);
		expect(state.currentTrackId).toBeNull();
		expect(state.shuffleEnabled).toBe(false);
		expect(state.repeatMode).toBe("none");
	});

	it("selects a track through the central queue state", () => {
		const state = selectMusicTrack(createMusicPlaybackState(tracks), "b", { isPlaying: true });

		expect(state.currentTrackId).toBe("b");
		expect(state.currentQueueIndex).toBe(1);
		expect(state.isPlaying).toBe(true);
	});

	it("enables stable shuffle with current track preserved at the current queue item", () => {
		const selected = selectMusicTrack(createMusicPlaybackState(tracks), "b", { isPlaying: true });
		const state = setMusicShuffleEnabled(selected, true, () => 0.9);

		expect(state.shuffleEnabled).toBe(true);
		expect(state.currentTrackId).toBe("b");
		expect(state.currentQueueIndex).toBe(0);
		expect(state.queue[0]?.id).toBe("b");
		expect(state.queue.map((track) => track.id).sort()).toEqual(["a", "b", "c"]);
		expect(state.shuffleHistory.map((track) => track.id)).toEqual(state.queue.map((track) => track.id));
	});

	it("disables shuffle by restoring playlist order around the selected track", () => {
		const selected = selectMusicTrack(createMusicPlaybackState(tracks), "b");
		const shuffled = setMusicShuffleEnabled(selected, true, () => 0.9);
		const state = setMusicShuffleEnabled(shuffled, false);

		expect(state.shuffleEnabled).toBe(false);
		expect(state.queue.map((track) => track.id)).toEqual(["a", "b", "c"]);
		expect(state.currentTrackId).toBe("b");
		expect(state.currentQueueIndex).toBe(1);
	});

	it("moves next through current queue and stops at the final item without repeat all", () => {
		const selected = selectMusicTrack(createMusicPlaybackState(tracks), "c", { isPlaying: true });
		const result = moveMusicQueueNext(selected);

		expect(result.action).toBe("stop");
		expect(result.state.currentTrackId).toBe("c");
		expect(result.state.currentQueueIndex).toBe(2);
		expect(result.state.isPlaying).toBe(false);
	});

	it("wraps manual next at the final item when repeat all is active", () => {
		const selected = selectMusicTrack({ ...createMusicPlaybackState(tracks), repeatMode: "all" }, "c");
		const result = moveMusicQueueNext(selected);

		expect(result.action).toBe("play");
		expect(result.track?.id).toBe("a");
		expect(result.state.currentTrackId).toBe("a");
		expect(result.state.currentQueueIndex).toBe(0);
	});

	it("restarts current track on previous when playback is past three seconds", () => {
		const selected = selectMusicTrack(createMusicPlaybackState(tracks), "b", { isPlaying: true });
		const result = moveMusicQueuePrevious(selected, 4);

		expect(result.action).toBe("restart");
		expect(result.track?.id).toBe("b");
		expect(result.state.currentTrackId).toBe("b");
		expect(result.state.currentQueueIndex).toBe(1);
	});

	it("moves previous through current queue before the three second threshold", () => {
		const selected = selectMusicTrack(createMusicPlaybackState(tracks), "b", { isPlaying: true });
		const result = moveMusicQueuePrevious(selected, 2);

		expect(result.action).toBe("play");
		expect(result.track?.id).toBe("a");
		expect(result.state.currentTrackId).toBe("a");
		expect(result.state.currentQueueIndex).toBe(0);
	});

	it("applies repeat one only to automatic end-of-track behavior", () => {
		const selected = selectMusicTrack({ ...createMusicPlaybackState(tracks), repeatMode: "one" }, "b");
		const autoAdvance = advanceMusicQueue(selected);
		const manualNext = moveMusicQueueNext(selected);

		expect(autoAdvance.action).toBe("replay");
		expect(autoAdvance.track?.id).toBe("b");
		expect(manualNext.action).toBe("play");
		expect(manualNext.track?.id).toBe("c");
		expect(manualNext.state.repeatMode).toBe("one");
	});

	it("handles single-track next consistently across repeat modes", () => {
		const singleTrack = [{ id: "solo" }] satisfies MusicPlaybackTrack[];
		const selected = selectMusicTrack(createMusicPlaybackState(singleTrack), "solo", { isPlaying: true });
		const repeatAll = selectMusicTrack({ ...createMusicPlaybackState(singleTrack), repeatMode: "all" }, "solo");

		expect(moveMusicQueueNext(selected).action).toBe("stop");
		expect(moveMusicQueueNext(repeatAll).action).toBe("restart");
	});
});
