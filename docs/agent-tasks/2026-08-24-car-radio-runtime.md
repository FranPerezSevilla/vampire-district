# Car radio runtime — first slice

## Goal

Make the locked nine-track ViceBlood radio seed behave as a usable in-car radio: each station has a continuous broadcast timeline, entering a vehicle joins the selected station at its current live song/offset, the mouse wheel cycles stations while driving, and leaving the vehicle stops audible playback without stopping the station clock.

## In scope

- System or authority: one `RadioSystem` for station selection and receiver state, one lightweight `RadioTimeline` for continuous station schedules, using the existing `RawAudio` AudioContext/master output authority.
- Expected files or area: `phaser/src/audio/`, `phaser/src/systems/`, `phaser/src/scenes/GameScene.js`, `phaser/src/runtime/VehicleRuntimeAdapter.js`, private radio staging/deploy tooling/tests/docs.
- Required behaviour:
  - locked station order `OFF -> Vice FM -> Night Shift -> Pulse 94.6`;
  - exactly 3 stations × 3 tracks;
  - default session station is Vice FM;
  - mouse-wheel input is reinterpreted as `radioStep` only by the vehicle path, while the normal on-foot weapon wheel remains intact;
  - selected station survives vehicle exit/re-entry during the same page session;
  - every station advances on a continuous wall-clock broadcast timeline even while inaudible;
  - entering/re-entering a vehicle joins the selected station at the song and seek offset that are live at that instant rather than restarting or resuming a frozen playlist cursor;
  - changing station while driving joins the new station at its own current live song/offset;
  - leaving the car or losing an occupied vehicle stops the receiver output only; it does not pause the station timelines;
  - source-page duration metadata defines deterministic station schedules and playback resynchronizes at schedule boundaries to prevent cumulative drift;
  - current station is visible in the existing vehicle HUD;
  - missing private masters fail silently without gameplay failure;
  - the nine private MP3 masters can be staged into a gitignored served directory using a deterministic script;
  - normal local/packaged/production runtime uses the private staged masters;
  - automatic Netlify Deploy Preview hosts (`deploy-preview-*--vampire-district.netlify.app`) may fetch the exact official Pixabay CDN copies pinned in the radio catalogue so reviewers can test radio without local staging;
  - every pinned preview URL must be byte-identical to the acquired master (SHA-256) and CORS-readable before it is accepted.

## Out of scope

- DJ voice, station IDs, advertisements, stingers or crossfades.
- Persisting the selected receiver station in campaign saves.
- Per-car remembered station.
- Generic runtime download from Pixabay/FMA/CDN URLs outside the explicit automatic Netlify Deploy Preview exception.
- Build-time scraping or recurring source discovery from Pixabay.
- Publishing substantially unchanged third-party masters in public Git.
- Changing the locked nine-track seed or searching for replacement music.
- Merging automatically.

The broadcast timeline intentionally uses wall-clock time rather than a frozen per-car cursor. Reloading or being away from a receiver therefore does not imply that the station itself stopped broadcasting.

NPC civilian-car diegetic radio ambience remains part of the overall PR scope but is a later bounded runtime layer after the player-radio manual gate. It should consume the same station timeline rather than invent a second playlist clock.

## Acceptance criteria

- [ ] Behaviour can be demonstrated or asserted.
- [ ] Existing `RawAudio` AudioContext/master remains the unique audio output authority.
- [ ] Existing input authority remains unique; there is no second wheel/key listener.
- [ ] Regression coverage exists for station cycling, continuous timeline advancement, live-offset entry/re-entry and wheel reinterpretation.
- [ ] Nine runtime tracks match `docs/audio/radio-runtime-seed-set.json` exactly and are grouped 3/3/3.
- [ ] Runtime duration metadata matches the curated source metadata used to define broadcast schedules.
- [ ] Private runtime masters are gitignored and stageable without public source-control publication.
- [ ] Missing assets produce an unavailable playback state rather than an exception or game failure.
- [ ] Automatic Netlify Deploy Preview resolves the nine tracks from verified official CDN copies without requiring the reviewer to stage or deploy audio manually.
- [ ] Production/local hosts do not switch to the preview CDN path.

## Validation

```bash
npm run check:fast
npm run check:affected:plan -- --base=origin/main
npm run check:affected -- --base=origin/main
```

Focused tests:

```bash
node --test tests/radio-runtime.test.js tests/radio-runtime-seed-set.test.js tests/radio-preview-source.test.js
```

Manual player-radio scenario in the automatic PR Deploy Preview:

1. Open `https://deploy-preview-78--vampire-district.netlify.app`.
2. Enter a vehicle: Vice FM joins whatever song/offset is currently live; it must not systematically begin at track zero/second zero.
3. Note the song/position, leave the vehicle for 15–30 seconds, then re-enter: the station must have advanced by the time spent outside the car.
4. Switch to Night Shift or Pulse 94.6: the newly selected station must also already be in progress rather than starting from its first track.
5. Leave vehicle: radio becomes inaudible while the station timeline continues.
6. Cross a song boundary while listening: the next same-station track begins without accumulating playlist drift.
7. Scroll wheel: `OFF -> Vice FM -> Night Shift -> Pulse 94.6` cycles and HUD updates.

The preview-only CDN URLs were recovered from each Pixabay page's published `AudioObject.contentUrl`, then downloaded and checked against the already acquired masters. All nine matched their locked SHA-256 values and returned `audio/mpeg` with `Access-Control-Allow-Origin: *`. No discovery/scraping workflow remains in the branch after verification.

The existing manual `radio:deploy-netlify` tooling may remain as a fallback/debug path, but it is not the normal reviewer workflow.

## Delivery

- Draft PR #78 targeting `main`.
- Private-master boundary preserved for production/local packaged runtime.
- Automatic Git-connected Netlify Deploy Preview is directly testable with the verified nine-track radio seed.
- No automatic merge.
