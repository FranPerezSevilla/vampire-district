const sampleEvent = (files, options = {}) => Object.freeze({
  files: Object.freeze([...files]),
  volume: options.volume ?? 1,
  loop: Boolean(options.loop),
  bus: options.bus || "world"
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
  step: sampleEvent([
    "phaser/assets/audio/player/step-01.mp3",
    "phaser/assets/audio/player/step-02.mp3",
    "phaser/assets/audio/player/step-03.mp3",
    "phaser/assets/audio/player/step-04.mp3",
    "phaser/assets/audio/player/step-05.mp3",
    "phaser/assets/audio/player/step-06.mp3"
  ], { volume: 0.82 }),
  sprintStep: sampleEvent([
    "phaser/assets/audio/player/sprint-step-01.mp3",
    "phaser/assets/audio/player/sprint-step-02.mp3",
    "phaser/assets/audio/player/sprint-step-03.mp3",
    "phaser/assets/audio/player/sprint-step-04.mp3"
  ], { volume: 0.92 }),
  weaponFire: sampleEvent([
    "phaser/assets/audio/combat/weapon-fire-01.mp3",
    "phaser/assets/audio/combat/weapon-fire-02.mp3",
    "phaser/assets/audio/combat/weapon-fire-03.mp3"
  ], { volume: 0.95 }),
  bulletHitBody: sampleEvent([
    "phaser/assets/audio/combat/bullet-hit-body-02.mp3"
  ], { volume: 1.15 }),
  bulletHitWorld: sampleEvent([
    "phaser/assets/audio/combat/bullet-hit-world-01.mp3"
  ], { volume: 0.88 }),
  drainStart: sampleEvent([
    "phaser/assets/audio/feeding/drain-start-01.mp3"
  ], { volume: 1.10, bus: "narrative" }),
  drainLoop: sampleEvent([
    "phaser/assets/audio/feeding/drain-loop-01.wav"
  ], { volume: 0.96, loop: true, bus: "narrative" }),
  drainComplete: sampleEvent([
    "phaser/assets/audio/feeding/drain-complete-01.mp3"
  ], { volume: 1.10, bus: "narrative" }),
  civilianScream: sampleEvent([
    "phaser/assets/audio/civilians/civilian-scream-01.mp3",
    "phaser/assets/audio/civilians/civilian-scream-02.mp3",
    "phaser/assets/audio/civilians/civilian-scream-03.mp3",
    "phaser/assets/audio/civilians/civilian-scream-04.mp3",
    "phaser/assets/audio/civilians/civilian-scream-05.mp3",
    "phaser/assets/audio/civilians/civilian-scream-06.mp3"
  ], { volume: 0.82 }),
  policeSirenLoop: sampleEvent([
    "phaser/assets/audio/police/police-siren-loop-01.wav"
  ], { volume: 0.72, loop: true }),
  vehicleDoorOpen: sampleEvent([
    "phaser/assets/audio/vehicles/vehicle-door-open-01.mp3"
  ], { volume: 0.92 }),
  vehicleDoorClose: sampleEvent([
    "phaser/assets/audio/vehicles/vehicle-door-close-01.mp3"
  ], { volume: 0.95 }),
  vehicleEngineStart: sampleEvent([
    "phaser/assets/audio/vehicles/vehicle-engine-start-01.mp3"
  ], { volume: 0.88 }),
  vehicleEngineLoop: sampleEvent([
    "phaser/assets/audio/vehicles/vehicle-engine-loop-01.wav"
  ], { volume: 1.00, loop: true }),
  vehicleHorn: sampleEvent([
    "phaser/assets/audio/vehicles/vehicle-horn-01.mp3",
    "phaser/assets/audio/vehicles/vehicle-horn-02.mp3",
    "phaser/assets/audio/vehicles/vehicle-horn-03.mp3"
  ], { volume: 0.78 }),
  vehicleCollisionLight: sampleEvent([
    "phaser/assets/audio/vehicles/vehicle-collision-light-01.mp3",
    "phaser/assets/audio/vehicles/vehicle-collision-light-02.mp3",
    "phaser/assets/audio/vehicles/vehicle-collision-light-03.mp3",
    "phaser/assets/audio/vehicles/vehicle-collision-light-04.mp3"
  ], { volume: 0.72 }),
  vehicleCollisionHeavy: sampleEvent([
    "phaser/assets/audio/vehicles/vehicle-collision-heavy-01.mp3",
    "phaser/assets/audio/vehicles/vehicle-collision-heavy-02.mp3",
    "phaser/assets/audio/vehicles/vehicle-collision-heavy-03.mp3"
  ], { volume: 0.82 }),
  vehicleSkidLoop: sampleEvent([
    "phaser/assets/audio/vehicles/vehicle-skid-loop-01.wav"
  ], { volume: 0.60, loop: true })
});

export const SAMPLE_AUDIO_IDS = Object.freeze(Object.keys(SAMPLE_AUDIO_CATALOG));

export function sampleAudioDefinition(id) {
  return SAMPLE_AUDIO_CATALOG[id] || null;
}
