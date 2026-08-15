# Viceblood audio catalogue

This is the working checklist for replacing prototype WebAudio tones with real sound assets. The catalogue uses stable event IDs: gameplay should trigger IDs, never hard-code filenames.

**Durable production procedure:** read [`AUDIO_ASSET_PIPELINE.md`](AUDIO_ASSET_PIPELINE.md) before integrating any sourced audio. That document defines the human/assistant handoff, binary-upload rules, variant policy, attribution requirements and recovery procedure between sessions.

## Current state

`phaser/src/systems/RawAudioSystem.js` already provides procedural prototype feedback for a subset of events such as footsteps, Whisper, feeding, witnesses, police pressure and UI actions. These fallbacks remain useful while real samples are sourced.

The old audio catalogue lived in PR #44 (`agent/expand-audio-catalog`). That PR is stale against `main`; PR #55 supersedes it and narrows the immediate work to the current public playtest.

### Integrated P0 families

- `weaponFire` — **integrated on PR #55**: three processed handgun variants under `phaser/assets/audio/combat/`, sample-backed playback through one stable event ID, WebKit-compatible MP3 runtime mirrors, and the previous procedural pistol sound retained as a loading/decoding fallback.
- `bulletHitBody` — **integrated on PR #55**: the accepted processed impact sample plays only from the confirmed `combat:hit` path for hitscan weapons. Props/world geometry and vehicles do not emit that event, so they never receive the body-impact sound. The current family has one accepted runtime variant; extra variants are polish, not a blocker.
- `drainStart` / `drainLoop` / `drainComplete` — **wired candidate on PR #55, pending listening acceptance**: one coherent KatjaSavia/Pixabay performance is split into a masculine-shifted start breath, an original-pitch bite loop and a masculine-shifted release. Runtime files are committed, the bite uses a stateful PCM WAV loop, and gameplay starts/stops it with the feeding lifecycle rather than retriggering it every frame.
- `civilianScream` — **integrated + listening accepted on PR #55**: six WebKit-compatible MP3 runtime variants share one stable event ID. Variants 01–03 remain masculine; 04–06 are deliberately female-sounding DSP derivatives of the same Universfield male performance, not separate female recordings. Panic audio now reacts to gunfire in three useful places: a civilian who sees their first gunshot screams immediately, nearby civilians who only hear gunfire can also scream without becoming visual witnesses, and an alarmed civilian can still scream as shock ends and flight/reporting begins. The shared event cooldown prevents a crowd from becoming an uncontrolled scream stack.

## Audio Lab

In playtest mode, press **F8** or use the **AUDIO LAB** button to open a sample-backed catalogue soundboard. The lab pauses gameplay and lets a tester:

- play the next variant for an event with **EVENT**;
- play an exact numbered variant directly;
- see the concrete runtime filename being played;
- compare events without combat, witnesses, Heat or gameplay cooldowns; and
- adjust preview volume from 0–300%, where 100% uses the same ×0.20 master gain as `RawAudioSystem`.

Use 100% first when judging game mix. Temporary boosts above 100% are diagnostic only; if a sound needs a permanent gain adjustment, change the catalogue definition rather than relying on the lab control.

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
- `bulletHitBody` — **done for current playtest:** 1 accepted sample, wired only to confirmed human hits; additional variants optional
- `bulletHitWorld` — concrete/brick impact; 3 variants
- `bulletRicochet` — occasional metal ricochet; 2–3 variants
- `kill` — restrained lethal/downed impact accent; avoid arcade reward tone

### Feeding

- `drainStart` — **wired candidate:** masculine-shifted breath/contact cue from the supplied source
- `drainLoop` — **wired candidate:** original-pitch bite section, state-driven PCM WAV loop
- `drainComplete` — **wired candidate:** masculine-shifted release from the same performance
- `drainCancel` — interrupted feeding; procedural fallback remains for now

### Civilians / witnesses

- `witnessWtf` — startled gasp/reaction
- `witnessRun` — old procedural panic accent; superseded by `civilianScream` for real civilian panic
- `witnessReport` — report/call consequence cue
- `civilianScream` — **done for the current playtest:** 6 accepted variants, 01–03 masculine and 04–06 female-sounding derivatives; reacts to first visible gunfire, nearby heard-only gunfire, and panic-to-flee transition with cooldown protection

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

1. Keep a high-quality processed OGG derivative when useful, but use a WebKit-compatible MP3 mirror for current browser one-shots.
2. Short state-driven loops may use PCM WAV when gapless repetition matters and MP3 encoder padding would be audible.
3. Put runtime files under `phaser/assets/audio/<category>/`.
4. Keep filenames lowercase and descriptive, for example `combat/weapon-fire-01.mp3`.
5. Record every third-party source and licence in `phaser/assets/audio/ATTRIBUTION.md` before merge.
6. Prefer CC0 or licences that explicitly allow commercial use and modification. Avoid unclear ownership.
7. Keep stable catalogue/event IDs even when the underlying file changes.
8. Loops must have clean loop points and explicit lifecycle ownership; do not restart them every frame.
9. Variants should be selected by the audio layer, not by scattering different event IDs through gameplay code.

## Suggested first sourcing batch

The original first batch was:

`step`, `weaponFire`, `bulletHitBody`, `drainStart`, `drainLoop`, `drainComplete`, `whisper`, `civilianScream`, `policeSirenLoop`, `vehicleEngineDrive`, `vehicleCollisionHeavy`, `ambienceStreetNight`.

`weaponFire`, `bulletHitBody` and `civilianScream` are integrated and listening accepted. The feeding family is fully materialized and wired but still needs human listening acceptance before it is marked done. Continue sourcing with `policeSirenLoop`, then `ambienceStreetNight`. `bulletHitWorld` remains a separate firearm-material family and must never reuse `bulletHitBody`.
