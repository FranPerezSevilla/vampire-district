# PR 73 — radio on GitHub Pages

## Goal and scope

The user now reviews ViceBlood on GitHub Pages because Netlify quota is exhausted, and requests audible radio. Pages omits the gitignored private masters, but `RadioCatalog` currently enables its pinned official CDN sources only on automatic Netlify preview hosts. Thus Pages selects absent local MP3s.

The source-selection authority is `phaser/src/audio/RadioCatalog.js`. Scope: its location resolver, `tests/radio-preview-source.test.js`, and the radio runtime contract. `RadioSystem`, `RadioTimeline`, `RadioPlayback` and the shared `RawAudio` output remain the playback authorities.

Enable the existing nine pinned sources specifically at `franperezsevilla.github.io/vampire-district` and its child paths, including the normal root entry. The existing Netlify preview rule remains supported. Local builds and other projects retain staged sources. No new tracks, music acquisition, public Git audio binaries, gameplay loops, traffic changes, browser tests or automatic merge.

## Acceptance

- All nine tracks select their existing official CDN URL on the actual Pages document location.
- Other projects/hosts continue resolving private staged files; path lookalikes do not match.
- The existing three stations, live timeline, vehicle entry/exit, wheel controls and shared audio output continue passing their native tests.
- Publish through the existing PR 73 branch and observe Pages deployment with bounded CI checks.

## Validation

Run focused radio source/runtime/preload/ambience tests and `npm run check:fast`. Review the cumulative affected plan, executing its native/static portions only under the user's explicit no-browser instruction. The original nine URLs were hash/CORS verified during the radio runtime handoff; a fresh network check is attempted separately from deterministic native tests. Native checks do not establish audible browser playback.

Network finding: Pages serves the catalogue (HTTP 200) but the old local master path returns HTTP 404. Fresh automated official-CDN downloads receive HTTP 403 / Cloudflare code 1010. Do not describe the pinned sources as freshly downloaded, decoded or audibly verified; CDN availability for a player remains a limitation.

Local result: **19/19 focused radio tests** and **906/906 native tests** pass; static suite ownership passes for 41 browser specifications in eight suites, without executing them. The cumulative affected plan selects release-candidate validation because of earlier changes in PR 73; this turn executes the native/static portions under the explicit browser exclusion. No generated-city files changed. Current publication/deployment evidence belongs in the live PR description.
