# Viceblood audio catalogue

This is the working checklist for replacing prototype WebAudio tones with real sound assets. The catalogue uses stable event IDs: gameplay should trigger IDs, never hard-code filenames.

**Durable production procedure:** read [`AUDIO_ASSET_PIPELINE.md`](AUDIO_ASSET_PIPELINE.md) before integrating any sourced audio. That document defines the human/assistant handoff, binary-upload rules, variant policy, attribution requirements and recovery procedure between sessions.

## Current state

`phaser/src/systems/RawAudioSystem.js` already provides procedural prototype feedback for a subset of events such as footsteps, Whisper, feeding, witnesses, police pressure and UI actions. These fallbacks remain useful while real samples are sourced.

The old audio catalogue lived in PR #44 (`agent/expand-audio-catalog`). That PR is stale against `main`; PR #55 supersedes it and narrows the immediate work to the current public playtest.

### Integrated P0 families

- `weaponFire` — **integrated on PR #55**: three processed handgun variants under `phaser/assets/audio/combat/`, sample-backed playback through one stable event ID, and the previous procedural pistol sound retained as a loading/decoding fallback.

## Playtest P0 — source these first

Do not try to fill the full production catalogue before testing. For the current Hunt → Feed → Escape loop, the first pass is:

### Player / vampire

- `step` — normal asphalt/concrete footstep; 4–6 variants preferred
- `sprintStep` — harder/faster footstep; 3–4 variants
- `whisper` — subtle supernatural command, intimate rather than explosive
- `hungerWarning` — short low-priority warning accent

### Combat / firearms

- `attackSwing` — melee swing
- `attackHitBody` — melee body impact; 3–4 variants
- `weaponFire` — **done for the current handgun:** 3 sample-backed variants
- `weaponDryFire` — empty trigger / failed shot
- `bulletHitBody` — projectile body impact; 3 variants
- `bulletHitWorld` — concrete/brick impact; 3 variants
- `bulletRicochet` — occasional metal ricochet; 2–3 variants
- `kill` — restrained lethal/downed impact accent; avoid arcade reward tone

### Feeding

- `drainStart` — bite/contact moment
- `drainLoop` — low wet/pulse layer while feeding; loop cleanly
- `drainComplete` — release/end of feeding
- `drainCancel` — interrupted feeding

### Civilians / witnesses

- `witnessWtf` — startled gasp/reaction
- `witnessRun` — panic onset accent; not a literal UI beep in final audio
- `witnessReport` — report/call consequence cue
- `civilianScream` — 3–4 variants

### Police

- `police` — wanted/response escalation cue
- `policeSirenLoop` — spatial police-car siren loop
- `policeRadio` — short radio bursts; 4–6 variants
- `policeSpotPlayer` — officer acquisition/recognition cue

### Vehicles

- `vehicleEnter`, `vehicleExit`
- `vehicleEngineStart`
- `vehicleEngineIdle` — seamless loop
- `vehicleEngineDrive` — seamless loop or layered acceleration bed
- `vehicleEngineBrake`
- `vehicleHandbrake`
- `vehicleSkidLoop`
- `vehicleCollisionLight` — 3–4 variants
- `vehicleCollisionHeavy` — 3 variants
- `vehicleHitPedestrian` — 2–3 variants
- `vehicleHorn` — 3–4 variants

### UI / city bed

- `confirm`, `cancel`, `menu`
- `objectiveUpdated`
- `ambienceStreetNight` — seamless night-city bed
- `trafficAmbience` — distant moving-traffic layer

## Explicitly deferred from the playtest P0

The current playtest disables Shadow Dash and Blood Sense, and rooftop/sewer traversal is also outside the active slice. Their catalogue IDs remain valid production backlog items, but do **not** spend time sourcing `dash`, `sense`, rooftop, climb or sewer assets yet. Hunters are also outside the present test.

## Asset rules

1. Prefer `.ogg` for shipped compressed samples; keep high-quality source masters outside the runtime package if needed.
2. Put runtime files under `phaser/assets/audio/<category>/`.
3. Keep filenames lowercase and descriptive, for example `combat/weapon-fire-01.ogg`.
4. Record every third-party source and licence in `phaser/assets/audio/ATTRIBUTION.md` before merge.
5. Prefer CC0 or licences that explicitly allow commercial use and modification. Avoid unclear ownership.
6. Keep stable catalogue/event IDs even when the underlying file changes.
7. Loops must have clean loop points; do not restart them every frame.
8. Variants should be selected by the audio layer, not by scattering different event IDs through gameplay code.

## Suggested first sourcing batch

The original first batch was:

`step`, `weaponFire`, `bulletHitBody`, `drainStart`, `drainLoop`, `drainComplete`, `whisper`, `civilianScream`, `policeSirenLoop`, `vehicleEngineDrive`, `vehicleCollisionHeavy`, `ambienceStreetNight`.

`weaponFire` is now integrated. Continue one sound family at a time using `AUDIO_ASSET_PIPELINE.md`; the next high-impact candidate is `bulletHitBody` or `drainStart`.
