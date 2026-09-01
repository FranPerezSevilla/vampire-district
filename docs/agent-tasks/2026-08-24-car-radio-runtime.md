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
  - normal local/packaged/production runtime uses the private staged masters;
  - automatic Netlify Deploy Preview hosts (`deploy-preview-*--vampire-district.netlify.app`) may fetch the exact official Pixabay CDN copies pinned in the radio catalogue so reviewers can test radio without local staging;
  - every pinned preview URL must be byte-identical to the acquired master (SHA-256) and CORS-readable before it is accepted.

## Out of scope

- DJ voice, station IDs, advertisements, stingers or crossfades.
- Radio save/resume across browser sessions or campaign saves.
- Per-car remembered station.
- Generic runtime download from Pixabay/FMA/CDN URLs outside the explicit automatic Netlify Deploy Preview exception.
- Build-time scraping or recurring source discovery from Pixabay.
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
2. Enter a vehicle: Vice FM starts.
3. Scroll wheel: `OFF -> Vice FM -> Night Shift -> Pulse 94.6` cycles and HUD updates.
4. Leave vehicle: radio becomes inaudible.
5. Re-enter: previously selected station remains selected for the page session.
6. Let a track finish: next same-station track begins and wraps after track three.

The preview-only CDN URLs were recovered from each Pixabay page's published `AudioObject.contentUrl`, then downloaded and checked against the already acquired masters. All nine matched their locked SHA-256 values and returned `audio/mpeg` with `Access-Control-Allow-Origin: *`. No discovery/scraping workflow remains in the branch after verification.

The existing manual `radio:deploy-netlify` tooling may remain as a fallback/debug path, but it is not the normal reviewer workflow.

## Delivery

- Draft PR #78 targeting `main`.
- Private-master boundary preserved for production/local packaged runtime.
- Automatic Git-connected Netlify Deploy Preview is directly testable with the verified nine-track radio seed.
- No automatic merge.
