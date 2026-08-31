# Car radio runtime — first slice

## Goal

Make the locked nine-track ViceBlood radio seed behave as a usable in-car radio: entering a vehicle activates the selected station, the mouse wheel cycles stations while driving, leaving the vehicle stops playback, and track endings advance deterministically inside the station playlist.

## In scope

- System or authority: one `RadioSystem` for station/playlist state, using the existing `RawAudio` AudioContext/master output authority.
- Expected files or area: `phaser/src/audio/`, `phaser/src/systems/`, `phaser/src/scenes/GameScene.js`, `phaser/src/runtime/VehicleRuntimeAdapter.js`, private radio staging/deploy tooling/tests/docs.
- Required behaviour:
  - locked station order `OFF -> Vice FM -> Night Shift -> Pulse 94.6`;
  - exactly 3 stations × 3 tracks;
  - default session station is Vice FM;
  - mouse-wheel input is reinterpreted as `radioStep` only by the vehicle path, while the normal on-foot weapon wheel remains intact;
  - selected station survives vehicle exit/re-entry during the same page session;
  - audio stops when the player is on foot or an occupied vehicle explodes;
  - a finished track advances to the next track in the same three-track station and wraps deterministically;
  - current station is visible in the existing vehicle HUD;
  - missing private masters fail silently without gameplay failure;
  - the nine private MP3 masters can be staged into a gitignored served directory using a deterministic script;
  - a Netlify draft preview can be built from a clean Git snapshot plus the local/ZIP masters without committing those masters to public Git.

## Out of scope

- DJ voice, station IDs, advertisements, stingers or crossfades.
- Radio save/resume across browser sessions or campaign saves.
- Per-car remembered station.
- Runtime download from Pixabay/FMA/CDN URLs.
- Publishing substantially unchanged third-party masters in public Git.
- Changing the locked nine-track seed or searching for replacement music.
- Merging automatically.

NPC civilian-car diegetic radio ambience remains part of the overall PR scope but is a later bounded runtime layer after the player-radio manual gate.

## Acceptance criteria

- [ ] Behaviour can be demonstrated or asserted.
- [ ] Existing `RawAudio` AudioContext/master remains the unique audio output authority.
- [ ] Existing input authority remains unique; there is no second wheel/key listener.
- [ ] Regression coverage exists for station cycling, playlist advancement, exit/re-entry and wheel reinterpretation.
- [ ] Nine runtime tracks match `docs/audio/radio-runtime-seed-set.json` exactly and are grouped 3/3/3.
- [ ] Private runtime masters are gitignored and stageable without public source-control publication.
- [ ] Missing assets produce an unavailable playback state rather than an exception or game failure.
- [ ] Manual Netlify draft deployment may include the nine masters only in the deploy snapshot.

## Validation

```bash
npm run check:fast
npm run check:affected:plan -- --base=origin/main
npm run check:affected -- --base=origin/main
```

Focused tests:

```bash
node --test tests/radio-runtime.test.js tests/radio-runtime-seed-set.test.js
```

Manual player-radio scenario once private masters are staged/deployed:

1. Enter a vehicle: Vice FM starts.
2. Scroll wheel: `OFF -> Vice FM -> Night Shift -> Pulse 94.6` cycles and HUD updates.
3. Leave vehicle: radio becomes inaudible.
4. Re-enter: previously selected station remains selected for the page session.
5. Let a track finish: next same-station track begins and wraps after track three.

Netlify draft with a source directory or ZIP containing the nine official masters:

```bash
npm run radio:deploy-netlify -- /path/to/Archivo.zip
```

The deploy tool creates a clean `git archive` snapshot, injects the masters only into that temporary snapshot, links to Netlify project `vampire-district` when necessary, deploys draft alias `radio-78`, then removes staging. Production is not modified.

## Delivery

- Draft PR #78 targeting `main`.
- Explicit private-master boundary plus one-command Netlify manual-preview path.
- No automatic merge.
