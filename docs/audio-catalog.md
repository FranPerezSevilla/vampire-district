# Viceblood audio catalogue

This is the working checklist for replacing prototype WebAudio tones with real sound assets. The catalogue uses stable event IDs: gameplay should trigger IDs, never hard-code filenames.

**Durable production procedure:** read [`AUDIO_ASSET_PIPELINE.md`](AUDIO_ASSET_PIPELINE.md) before integrating any sourced audio. That document defines the human/assistant handoff, binary-upload rules, variant policy, attribution requirements and recovery procedure between sessions.

## Current state

`phaser/src/systems/RawAudioSystem.js` already provides procedural prototype feedback for a subset of events such as footsteps, Whisper, feeding, witnesses, police pressure and UI actions. These fallbacks remain useful while real samples are sourced.

The old audio catalogue lived in PR #44 (`agent/expand-audio-catalog`). That PR is stale against `main`; PR #55 supersedes it and narrows the immediate work to the current public playtest.

### Integrated P0 families

- `weaponFire` — **integrated on PR #55**: three processed handgun variants under `phaser/assets/audio/combat/`, sample-backed playback through one stable event ID, WebKit-compatible MP3 runtime mirrors, and the previous procedural pistol sound retained as a loading/decoding fallback.
- `bulletHitBody` — **integrated on PR #55**: the accepted processed impact sample plays only from the confirmed `combat:hit` path for hitscan weapons. Props/world geometry and vehicles do not emit that event, so they never receive the body-impact sound. The current family has one accepted runtime variant; extra variants are polish, not a blocker.
- `drainStart` / `drainLoop` / `drainComplete` — **sound character listening accepted; narrative mix tuning on PR #55**: the KatjaSavia/Pixabay performance keeps its masculine-shifted start/release and original-pitch bite loop. The family now sits on a dedicated narrative bus with a modest level lift while ordinary world audio ducks to ~54% during feeding and returns smoothly just after the feeding exit cue.
- `civilianScream` — **integrated + listening accepted on PR #55**: six WebKit-compatible MP3 runtime variants share one stable event ID. Variants 01–03 remain masculine; 04–06 are deliberately female-sounding DSP derivatives of the same Universfield male performance, not separate female recordings. Panic audio reacts to gunfire and vehicle-pedestrian impacts: a civilian who sees their first gunshot screams immediately, nearby civilians who only hear gunfire can also scream without becoming visual witnesses, an alarmed civilian can still scream as shock ends and flight/reporting begins, and a pedestrian struck by the player's vehicle screams at the confirmed impact. Visual bystanders to an atropello continue through the existing mundane-violence shock/flight path. The shared event cooldown prevents crowds from becoming an uncontrolled scream stack.
- `policeSirenLoop` — **re-looped candidate on PR #55, pending quick listening re-check**: the supplied szpury/Freesound siren now uses a short source-sized circular equal-power crossfade after the authored boundary produced a subtle audible seam in-game; it remains a PCM WAV runtime loop. Each motorized police cruiser owns an independent instance with distance attenuation and stereo pan. The loop can become audible before the cruiser is rendered locally, grows as the unit approaches, remains attached to the cruiser after officers dismount, and stops when the unit retires, is disabled, leaves audible range, the player leaves street level, or UI pause owns the scene.
- `vehicleDoorOpen` / `vehicleDoorClose` — **integrated paired candidate on PR #55, pending listening acceptance**: authentic Pixabay one-shots now form a physical door sequence for successful vehicle entry and exit. The opening cue fires immediately and the close/slam follows after 0.52 s; both retain dedicated procedural fallbacks for load/decode failure.
- `vehicleSkidLoop` — **integrated + listening accepted on PR #55**: the supplied MagiaZ tyre skid is trimmed into a gap-sensitive PCM WAV loop. Aggressive-driving pulses sustain one stateful loop while the drift continues and let it stop shortly after the skid ends; civilian panic remains a separate non-reporting reaction with no Heat. Its runtime level was reduced slightly after the accepted real-engine mix review.
- `vehicleEngineStart` / `vehicleEngineLoop` — **real sample-backed candidate integrated on PR #55; sound character and systemic mix accepted, level raised slightly after listening feedback**: the supplied freesounds123/Pixabay recording is split into an ignition/starter one-shot and a circular-crossfaded PCM idle loop. Player entry plays the start after the door closes and keeps the continuous engine voice muted until the recorded engine catches. Player, traffic and police still share the existing gear-aware RPM, load, distance and stereo-pan telemetry; runtime playback rate, filtering and gain shape the same real loop per archetype. The former oscillators remain only as a load/decode fallback.
- `vehicleCollisionLight` — **real light-impact family integrated on PR #55, pending listening acceptance**: four authentic cuts from different moments of the supplied Pixabay iron/debris recording provide short bodywork and loose-metal responses without borrowing the heavy crash's low-end weight or glass tail. The procedural sound remains a loading/decoding fallback.
- `vehicleCollisionHeavy` — **real heavy-crash family integrated on PR #55, pending listening acceptance**: the supplied Pixabay crash provides three restrained runtime variants with a broad bodywork hit and glass/metal tail. Impact-speed classification remains authoritative, so this family only plays from the heavy threshold upward; the procedural crash remains a loading/decoding fallback.
- `vehicleHorn` — **real sample-backed family integrated on PR #55, pending listening acceptance**: one clean Universfield/Pixabay horn becomes three natural press lengths without pitch alteration. The player can sound it with the remappable **H** action while driving; it is mundane traffic audio and creates no Heat. A restrained procedural horn remains a loading/decoding fallback.
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

- `drainStart` — **listening accepted:** masculine-shifted breath/contact cue; slightly lifted in the narrative mix
- `drainLoop` — **listening accepted:** original-pitch bite section, state-driven PCM WAV loop on the narrative bus
- `drainComplete` — **listening accepted:** masculine-shifted release; slightly lifted in the narrative mix
- `drainCancel` — interrupted feeding; procedural fallback remains for now

### Civilians / witnesses

- `witnessWtf` — startled gasp/reaction
- `witnessRun` — old procedural panic accent; superseded by `civilianScream` for real civilian panic
- `witnessReport` — report/call consequence cue
- `civilianScream` — **done for the current playtest:** 6 accepted variants, 01–03 masculine and 04–06 female-sounding derivatives; reacts to first visible gunfire, nearby heard-only gunfire, panic-to-flee transition and confirmed vehicle-pedestrian impacts, with cooldown protection

### Police

- `police` — wanted/response escalation cue
- `policeSirenLoop` — **integrated candidate:** one spatial PCM loop per active response cruiser; pending in-game listening acceptance
- `policeRadio` — short radio bursts; 4–6 variants
- `policeSpotPlayer` — officer acquisition/recognition cue

### Vehicles

- `vehicleDoorOpen` — **integrated candidate:** authentic opening one-shot starts the entry/exit door sequence
- `vehicleDoorClose` — **integrated candidate:** authentic short slam follows the opening action after 0.52 s; pending paired listening acceptance
- `vehicleEngineStart` — **integrated candidate:** real ignition/starter cue plays after the player closes the door
- `vehicleEngineLoop` — **integrated candidate:** 2.72 s circular-crossfaded PCM idle loop driven by RPM/load/spatial telemetry
- `vehicleEngineDrive` — represented by runtime pitch/filter/load treatment of `vehicleEngineLoop`; a separate drive layer remains optional polish
- `vehicleEngineBrake`
- `vehicleHandbrake`
- `vehicleSkidLoop` — **done for the current playtest:** real gap-sensitive PCM loop sustained while aggressive drifting continues; listening accepted
- `vehicleEngine` — **real sample-backed systemic candidate:** automatic gears still drive RPM for the player, local civilian traffic and police cruisers; a shared authentic idle recording now supplies the timbre, with per-archetype playback-rate/filter/gain treatment and procedural fallback only when the sample is unavailable.
- `vehicleCollisionLight` — **integrated candidate:** four real short metal/bodywork variants selected from the light threshold up to, but not including, the heavy threshold; pending listening acceptance
- `vehicleCollisionHeavy` — **integrated candidate:** three real heavy-crash variants selected only at the heavy impact-speed threshold; pending listening acceptance
- `vehicleHitPedestrian` — 2–3 variants; future material-impact layer, separate from the existing human scream reaction
- `vehicleHorn` — **integrated candidate:** 3 original-pitch press-length variants; remappable H while driving; pending listening acceptance

### UI / systemic city soundscape

- `confirm`, `cancel`, `menu`
- `objectiveUpdated`

Viceblood intentionally has **no continuous `ambienceStreetNight` or `trafficAmbience` bed** in the current direction. Urban ambience must emerge from spatial systemic sources: player/NPC engines, gear changes, tyres, sirens, civilians, combat, police and future world props. Silence between events is part of the mix rather than a missing layer. Ordinary car-to-car contact is treated as mundane traffic and does not create Heat; colliding with a police vehicle remains an explicit exception.

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

`step`, `weaponFire`, `bulletHitBody`, `drainStart`, `drainLoop`, `drainComplete`, `whisper`, `civilianScream`, `policeSirenLoop`, `vehicleEngineDrive`, `vehicleCollisionHeavy`.

`weaponFire`, `bulletHitBody`, `civilianScream`, `vehicleSkidLoop` and the feeding sound character are listening accepted. `policeSirenLoop` is integrated and awaits in-game listening acceptance. Feeding now needs only a quick confirmation of the new narrative ducking/level balance. The systemic vehicle-engine mix is accepted; after feedback, each archetype now separates the short torque/RPM shift cut from a longer per-gear dwell, including a first-gear hold. A high-speed acceleration taper and lower upper-gear torque preserve the lively launch while making 3rd–5th gear breathe and stretching the run to maximum speed over several seconds. The procedural engine timbre has now been replaced by a real sample-backed start/loop candidate while preserving the accepted systemic RPM, gear and spatial ownership. There is deliberately no fixed city/traffic ambience sourcing task. `bulletHitWorld` remains a separate firearm-material family and must never reuse `bulletHitBody`.