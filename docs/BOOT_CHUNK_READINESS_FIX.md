# Boot chunk readiness regression — 2026-09-12

## Authority and bounded scope

`ChunkStreamSystem` owns requests, residency and the activation budget;
`MainMenuScene` owns the loading/gesture/menu handoff. Change those two files,
focused native streaming/title tests and publication verification only.
No camera, typography, generated geometry, save format, traffic rules or PR merge.

## Reproduction

Using the committed manifest and chunk files with the real ChunkFileStore and
ChunkStreamSystem, but no scene/render frames: all 25 initial requests complete,
all 25 payloads are queued, zero are resident. The passive waitUntilReady then
fails with exactly the nine IDs reported in the screenshot (1:1 through 3:3).
The previous readiness test used a promise stub and could not detect this.
This demonstrates a boot dependency on activation frames, not proof that the
user's network failed or that any particular browser condition stopped frames.

## Acceptance

- A bounded one-shot initial resource preparation activates the current active
  chunks via the existing index/activation method even with zero game frames.
- Do not mark a queued/downloaded chunk resident without hydrating its collections.
- Preserve the per-batch activation budget and yield between batches. The regular
  frame path does not compete with initial preparation or redraw partial batches.
- Do not wait for optional prefetch requests before completing the required view.
- Await initial preparation before the gesture gate, refresh entities at dt=0 and
  redraw the complete view once. Gameplay, hunger, traffic and radio stay stopped.
- Load/parse/activation errors are rejected; timeouts report only missing IDs and
  their load states. Shutdown cancels the waiter and cannot activate late data.
- Regress with real file/index/stream services and authored JSON, including cold
  load, queued warm load, stalled prefetch, focus change, failure and shutdown.
- Verify delivered manifest/chunks as well as HTML/CSS/JS on Pages. Native and
  HTTP checks are not visual, WebGL or FPS acceptance. Browser execution remains
  excluded by the existing user instruction.
