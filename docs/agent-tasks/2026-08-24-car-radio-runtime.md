# Car radio runtime — first slice

## Goal

Make the locked nine-track ViceBlood radio seed behave as a usable in-car radio: entering a vehicle activates the selected station, the mouse wheel cycles stations while driving, leaving the vehicle stops playback, and track endings advance deterministically inside the station playlist.

## In scope

- System or authority: one `RadioSystem` for station/playlist state, using the existing `RawAudio` AudioContext/master output authority.
- Expected files or area: `phaser/src/audio/`, `phaser/src/systems/`, `phaser/src/scenes/GameScene.js`, `phaser/src/runtime/VehicleRuntimeAdapter.js`, private radio staging tooling/tests/docs.
- Required behaviour:
  - locked station order `OFF -> Vice FM -> Blood City Beats -> Night Shift -> Pulse 94.6`;
  - default session station is Vice FM;
  - mouse-wheel input is reinterpreted as `radioStep` only by the vehicle path, while the normal on-foot weapon wheel remains intact;
  - selected station survives vehicle exit/re-entry during the same page session;
  - audio stops when the player is on foot or an occupied vehicle explodes;
  - a finished track advances to the next track in the same station and wraps deterministically;
  - the one-track Blood City Beats playlist repeats its only track;
  - current station is visible in the existing vehicle HUD;
  - missing private masters fail silently without gameplay failure;
  - the nine private MP3 masters can be staged into a gitignored served directory using a deterministic script.

## Out of scope

- DJ voice, station IDs, advertisements, stingers or crossfades.
- Radio save/resume across browser sessions or campaign saves.
- Per-car remembered station.
- Advanced spatialization, occlusion or custom combat mixing.
- Runtime download from Pixabay/FMA/CDN URLs.
- Publishing substantially unchanged third-party masters in public Git.
- Changing the locked nine-track seed or searching for replacement music.
- Merging PR #76.

## Acceptance criteria

- [ ] Behaviour can be demonstrated or asserted.
- [ ] Existing `RawAudio` AudioContext/master remains the unique audio output authority.
- [ ] Existing input authority remains unique; there is no second wheel/key listener.
- [ ] Regression coverage exists for station cycling, playlist advancement, exit/re-entry and wheel reinterpretation.
- [ ] Nine runtime tracks match `docs/audio/radio-runtime-seed-set.json` exactly.
- [ ] Private runtime masters are gitignored and stageable without public source-control publication.
- [ ] Missing assets produce an unavailable playback state rather than an exception or game failure.

## Validation

```bash
npm run check:fast
npm run check:affected:plan -- --base=origin/codex/90s-radio-music-production
npm run check:affected -- --base=origin/codex/90s-radio-music-production
```

Focused tests:

```bash
node --test tests/radio-runtime.test.js tests/radio-runtime-seed-set.test.js
```

Manual scenario once private masters are staged:

1. Enter a vehicle: Vice FM starts.
2. Scroll wheel: station changes and HUD updates.
3. Leave vehicle: radio becomes inaudible.
4. Re-enter: previously selected station resumes from its current playlist position.
5. Let a track finish: next same-station track begins; single-track Blood City Beats repeats.

## Delivery

- Draft stacked PR targeting `codex/90s-radio-music-production`.
- Summary of changed behaviour and explicit private-master boundary.
- No automatic merge.
