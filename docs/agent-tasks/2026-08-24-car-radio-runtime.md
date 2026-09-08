# Car radio runtime — implementation record

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
  - automatic Netlify Deploy Preview hosts (`deploy-preview-*--vampire-district.netlify.app`) and the ViceBlood GitHub Pages project (`franperezsevilla.github.io/vampire-district/`) may fetch the exact official Pixabay CDN copies pinned in the radio catalogue so reviewers can test radio without local staging;
  - every pinned preview URL must be byte-identical to the acquired master (SHA-256) and CORS-readable before it is accepted.

## Out of scope

- DJ voice, station IDs, advertisements, stingers or crossfades.
- Persisting the selected receiver station in campaign saves.
- Per-car remembered station.
- Generic runtime download from Pixabay/FMA/CDN URLs outside the explicit Netlify Deploy Preview and ViceBlood Pages exceptions.
- Build-time scraping or recurring source discovery from Pixabay.
- Publishing substantially unchanged third-party masters in public Git.
- Changing the locked nine-track seed or searching for replacement music.
- Merging automatically.

The broadcast timeline intentionally uses wall-clock time rather than a frozen per-car cursor. Reloading or being away from a receiver therefore does not imply that the station itself stopped broadcasting.

NPC civilian-car ambience is now implemented by `TrafficRadioAmbienceSystem`, sharing the player radio's station clocks and decoded-buffer cache. The initial first-slice staging above is retained as implementation history.

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
- [ ] Local builds, production Netlify and unrelated Pages projects do not switch to the preview CDN path.

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

### GitHub Pages continuation — 2026-09-08, PR 73

The user moved review to GitHub Pages after exhausting Netlify quota. Pages serves the source tree without the private MP3 directory; a direct request confirmed HTTP 404 for the previously selected local master. `RadioCatalog` now recognizes the exact ViceBlood Pages host and project path, selecting the same nine pinned official sources. Root and nested game entry points are covered, as are unrelated-host/project exclusions and actual document-location catalogue initialization. Native radio tests retain entry/re-entry, station switching, shared output, preload/cache and traffic ambience coverage.

Fresh automated requests to the official CDN were rejected with HTTP 403 (Cloudflare code 1010). The original hash/CORS verification above is historical evidence, not a fresh successful download. This source-resolution fix does not establish audible playback or ongoing CDN availability. Browser tests and listening checks remain excluded by the user's instruction. See [the bounded Pages task](2026-09-08-pages-radio.md).

## Current delivery — 2026-09-08

The initial PR #78 workflow above is historical. The radio continuation was included in PR #73, merged with user approval at `7ee3af6`. Review uses the ViceBlood Pages branch because Netlify quota was exhausted. Private staged masters remain required for other local/packaged hosts. User acceptance of the playable result is separate from automated CDN availability or listening verification. [Technical architecture](../TECHNICAL_ARCHITECTURE.md#radio-ownership-and-deployment) records current ownership.
