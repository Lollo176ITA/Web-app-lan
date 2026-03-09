import type { PlaybackState } from "./types.js";

export function resolvePlaybackPosition(playback: PlaybackState, now = new Date()) {
  if (playback.status !== "playing" || !playback.startedAt) {
    return playback.positionSeconds;
  }

  const startedAt = Date.parse(playback.startedAt);

  if (Number.isNaN(startedAt)) {
    return playback.positionSeconds;
  }

  const elapsedSeconds = Math.max(0, now.getTime() - startedAt) / 1000;
  return Math.max(0, playback.positionSeconds + elapsedSeconds);
}
