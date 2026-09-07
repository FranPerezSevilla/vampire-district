# PR 73 — Pages gameplay validation

## Goal and evidence

The user requested testing the PR branch on GitHub Pages because Netlify has no
remaining quota. Pages deployment `34098911361` serves commit `95e344b` at
https://franperezsevilla.github.io/vampire-district/ . Normal title/audio startup
and New Night load successfully. Civilian cars are visible moving at the first
junction east of spawn, but an oversized authored-car label obscures the road.

## Bounded correction

`phaser/src/main.js` owns the existing readable-text factory. Initialize its
resolution in the construction style: Phaser 3.90 copies that value into the
texture source only in the Text constructor. Its Canvas renderer divides the
texture dimensions by that source resolution, whereas WebGL uses the live style.
The old post-construction setter left Canvas drawing the label three times larger.

Files: `main.js`, the existing `tests/browser/render-quality.spec.js`, this task
and the canonical traffic progress/status records. No new rendering authority,
traffic geometry, input loop, dependency, hosting configuration or merge.

## Acceptance and validation

- Vehicle labels render at their logical width/height in the Canvas fallback.
- Normal New Night restores movement (exercise real held keyboard input).
- Pages shows a readable road and allows visual observation of the junction.
- Run fast checks and the affected plan; record actual CI and Pages results.
- Keep explicit user gameplay approval pending and the PR draft.

Cloud keyboard taps have not yet moved the player; this is not sufficient to
classify a game input bug. The regression uses held input to distinguish the
production handoff from limitations of the interactive browser controls.
