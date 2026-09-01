const DEFAULT_EPOCH_MS = 0;

function positiveDuration(track) {
  const duration = Number(track?.durationSeconds);
  return Number.isFinite(duration) && duration > 0 ? duration : 0;
}

function positiveModulo(value, modulo) {
  if (!(modulo > 0)) return 0;
  return ((value % modulo) + modulo) % modulo;
}

export class RadioTimeline {
  constructor(stations = [], {
    nowMs = () => Date.now(),
    epochMs = DEFAULT_EPOCH_MS
  } = {}) {
    this.nowMs = typeof nowMs === "function" ? nowMs : () => Date.now();
    this.epochMs = Number.isFinite(Number(epochMs)) ? Number(epochMs) : DEFAULT_EPOCH_MS;
    this.stationSchedules = new Map();

    for (const station of stations || []) {
      const tracks = (station?.tracks || []).map((track, trackIndex) => ({
        track,
        trackIndex,
        durationSeconds: positiveDuration(track)
      }));
      if (!station?.id || !tracks.length || tracks.some(item => !(item.durationSeconds > 0))) continue;
      const cycleSeconds = tracks.reduce((total, item) => total + item.durationSeconds, 0);
      this.stationSchedules.set(station.id, {
        station,
        tracks,
        cycleSeconds
      });
    }
  }

  position(stationId, atMs = this.nowMs()) {
    const schedule = this.stationSchedules.get(String(stationId || ""));
    if (!schedule?.tracks?.length || !(schedule.cycleSeconds > 0)) return null;

    const observedAtMs = Number.isFinite(Number(atMs)) ? Number(atMs) : this.nowMs();
    const elapsedSeconds = (observedAtMs - this.epochMs) / 1000;
    const cycleOffsetSeconds = positiveModulo(elapsedSeconds, schedule.cycleSeconds);
    let cursor = cycleOffsetSeconds;

    for (let index = 0; index < schedule.tracks.length; index += 1) {
      const item = schedule.tracks[index];
      const isLast = index === schedule.tracks.length - 1;
      if (cursor < item.durationSeconds || isLast) {
        const offsetSeconds = Math.max(0, Math.min(cursor, item.durationSeconds));
        return {
          stationId: schedule.station.id,
          stationLabel: schedule.station.label,
          track: item.track,
          trackIndex: item.trackIndex,
          trackCount: schedule.tracks.length,
          offsetSeconds,
          durationSeconds: item.durationSeconds,
          remainingSeconds: Math.max(0, item.durationSeconds - offsetSeconds),
          cycleOffsetSeconds,
          cycleSeconds: schedule.cycleSeconds,
          observedAtMs
        };
      }
      cursor -= item.durationSeconds;
    }

    return null;
  }

  nextTrack(stationId, atMs = this.nowMs()) {
    const schedule = this.stationSchedules.get(String(stationId || ""));
    const position = this.position(stationId, atMs);
    if (!schedule?.tracks?.length || !position) return null;
    const nextIndex = (position.trackIndex + 1) % schedule.tracks.length;
    return schedule.tracks[nextIndex]?.track || null;
  }

  stationCycleSeconds(stationId) {
    return this.stationSchedules.get(String(stationId || ""))?.cycleSeconds || 0;
  }
}
