const sampleEvent = (files, options = {}) => Object.freeze({
  files: Object.freeze([...files]),
  volume: options.volume ?? 1
});

/**
 * Runtime sample-backed audio events.
 *
 * Gameplay uses stable event IDs (for example `weaponFire`) and never chooses
 * concrete filenames. RawAudioSystem owns loading and variant selection, while
 * its procedural sounds remain available as fallbacks until a sample is ready.
 */
export const SAMPLE_AUDIO_CATALOG = Object.freeze({
  weaponFire: sampleEvent([
    "phaser/assets/audio/combat/weapon-fire-01.ogg",
    "phaser/assets/audio/combat/weapon-fire-02.ogg",
    "phaser/assets/audio/combat/weapon-fire-03.ogg"
  ], { volume: 0.95 }),
  bulletHitBody: sampleEvent([
    "phaser/assets/audio/combat/bullet-hit-body-02.ogg"
  ], { volume: 1.15 })
});

export const SAMPLE_AUDIO_IDS = Object.freeze(Object.keys(SAMPLE_AUDIO_CATALOG));

export function sampleAudioDefinition(id) {
  return SAMPLE_AUDIO_CATALOG[id] || null;
}
