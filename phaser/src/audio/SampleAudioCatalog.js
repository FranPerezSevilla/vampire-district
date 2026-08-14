const sampleEvent = (files, options = {}) => Object.freeze({
  files: Object.freeze([...files]),
  volume: options.volume ?? 1,
  loop: Boolean(options.loop)
});

/**
 * Runtime sample-backed audio events.
 *
 * Gameplay uses stable event IDs (for example `weaponFire`) and never chooses
 * concrete filenames. RawAudioSystem owns loading and variant selection, while
 * its procedural sounds remain available as fallbacks until a sample is ready.
 *
 * The current playtest runtime uses MP3 mirrors for broadly compatible
 * one-shots, including older WebKit/Safari builds that cannot decode
 * Ogg/Vorbis through `decodeAudioData()`. Very short state-driven loops may use
 * PCM WAV to keep that compatibility without compressed-frame loop padding.
 * OGG derivatives remain in the repository for audio work.
 */
export const SAMPLE_AUDIO_CATALOG = Object.freeze({
  weaponFire: sampleEvent([
    "phaser/assets/audio/combat/weapon-fire-01.mp3",
    "phaser/assets/audio/combat/weapon-fire-02.mp3",
    "phaser/assets/audio/combat/weapon-fire-03.mp3"
  ], { volume: 0.95 }),
  bulletHitBody: sampleEvent([
    "phaser/assets/audio/combat/bullet-hit-body-02.mp3"
  ], { volume: 1.15 }),
  drainStart: sampleEvent([
    "phaser/assets/audio/feeding/drain-start-01.mp3"
  ], { volume: 1.0 }),
  drainLoop: sampleEvent([
    "phaser/assets/audio/feeding/drain-loop-01.wav"
  ], { volume: 0.9, loop: true }),
  drainComplete: sampleEvent([
    "phaser/assets/audio/feeding/drain-complete-01.mp3"
  ], { volume: 1.0 })
});

export const SAMPLE_AUDIO_IDS = Object.freeze(Object.keys(SAMPLE_AUDIO_CATALOG));

export function sampleAudioDefinition(id) {
  return SAMPLE_AUDIO_CATALOG[id] || null;
}
