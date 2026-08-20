# Viceblood audio catalogue

This document is the working checklist for replacing the prototype's procedural WebAudio tones with final sound assets.

The source of truth is [`phaser/src/audio/SoundCatalog.js`](../phaser/src/audio/SoundCatalog.js). Do not invent string IDs at call sites: register the event in the catalogue first and invoke that exact ID.

## Current implementation

Viceblood currently generates prototype sounds in `RawAudioSystem.js`. Existing calls use `RawAudio.play("soundId")`. The catalogue preserves those IDs and records their procedural fallback, so replacing a sound does not require renaming gameplay events.

Examples already invoked by gameplay:

```js
RawAudio.play("dash");
RawAudio.play("whisper");
RawAudio.play("sense");
RawAudio.play("drainStart");
RawAudio.play("drainComplete");
RawAudio.play("breakLight");
RawAudio.play("witnessReport");
RawAudio.play("police");
RawAudio.play("missionComplete");
```

## Filling an asset

1. Find or create a legally usable `.ogg`, `.wav`, or `.mp3` file.
2. Put it under `phaser/assets/audio/<category>/`.
3. Set the catalogue entry's `file` field to the repository-relative path.
4. Keep the event ID unchanged.
5. Record the source and licence in `phaser/assets/audio/ATTRIBUTION.md`.

Example:

```js
vehicleDoorClose: sound("vehicleDoorClose", "vehicle", "Vehicle door closes", {
  file: "phaser/assets/audio/vehicle/vehicle-door-close-01.ogg",
  spatial: true
})
```

`file: null` means the event is deliberately awaiting an asset. It is not a broken reference.

## Asset-production order

### P0 — immediately noticeable gameplay

- `step`, `sprintStep`
- `dash`, `whisper`, `sense`
- `stun`, `kill`, `attackSwing`, `attackHitBody`
- `drainStart`, `drainLoop`, `drainComplete`, `drainCancel`
- `breakLight`
- `routeRoof`, `routeRoofLand`, `routeClimb`, `routeSewer`
- `witnessWtf`, `witnessRun`, `witnessReport`, `civilianScream`
- `police`, `policeSirenLoop`, `policeRadio`, `hunter`
- `vehicleEnter`, `vehicleExit`, `vehicleEngineStart`, `vehicleEngineIdle`, `vehicleEngineDrive`
- `vehicleHandbrake`, `vehicleSkidLoop`, `vehicleCollisionLight`, `vehicleCollisionHeavy`
- `missionComplete`, `missionFailed`, `menu`, `confirm`, `cancel`

### P1 — world cohesion

- Player landings and clothes movement
- Body handling and containers
- Doors, gates and manholes
- Police spotting, losing sight and backup
- Vehicle doors, braking, pedestrian impacts and horns
- Night Ledger and objective-update UI
- Street, rooftop and sewer ambience

### P2 — atmosphere and variation

- Civilian chatter and footsteps
- Traffic ambience
- Location emitters for club, police station and church
- Rain, thunder and city tension stingers
- Multiple variants for footsteps, impacts, screams, radio and horns

## Recommended variant counts

| Family | Minimum variants |
| --- | ---: |
| Player footsteps | 6 normal + 4 sprint |
| Civilian footsteps | 4 |
| Body impacts | 3 |
| Melee body hits | 4 |
| Civilian screams | 4 |
| Police radio | 6 short clips |
| Vehicle horns | 4 |
| Light collisions | 4 |
| Heavy collisions | 3 |
| UI hover/click | 2 each |

## Runtime contract

- One-shot event: `RawAudio.play("eventId")`.
- Loop event: start it when the state begins and stop it when the state ends; never restart it every frame.
- Spatial event: position/attenuation should be supplied by the future sample player.
- UI events are never spatial.
- Critical sounds may duck ambience, but should not bypass the master volume.
- Cooldowns belong to the sound layer, not scattered gameplay timers.

## Catalogue status

At the time this catalogue was introduced, all entries intentionally have `file: null`. Existing events continue to use their procedural `fallback`; newly registered events are silent until their assets and final call sites are added.

The catalogue is broader than the current playable interactions on purpose: it is the acquisition and integration backlog for the next audio pass.
