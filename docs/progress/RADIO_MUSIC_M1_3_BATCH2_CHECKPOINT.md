# M1.3 Batch 2 — Grieg / Bach proof checkpoint

## Gate entering Batch 2

Batch 1 is closed by GitHub **Tests #2254** / run `32597308747`, success on head `6e4167cefc11dd0b8275ea51b62af20ada42c30a`.

The Batch 1 failure in Tests #2250 was only a manifest track-list mismatch. The two Batch 1 MIDI byte streams were unchanged.

## Batch 2 implementation

### Night Shift — Grieg

- candidate: `mountain-king-bigbeat-a`
- source: Edvard Grieg, *In the Hall of the Mountain King*
- provenance: Grieg holograph piano manuscript, 21 January 1888, IMSLP #810457, Public Domain
- target tempo: 138 BPM
- proof length: about 47 s
- Type-1 MIDI / 480 PPQ / conductor + 6 named musical tracks
- source-derived track: `01 Source Motif - Grieg`
- ViceBlood arrangement: programmed big-beat pulse, distorted bass, industrial hits, low-string pulse and riser/FX guide
- no borrowed commercial break or third-party audio

### Pulse 94.6 — Bach

- candidate: `bach-prelude-846-acid-a`
- source: J. S. Bach, *Prelude in C major, BWV 846*
- provenance: holograph manuscript 1722–23, Staatsbibliothek zu Berlin Mus. ms. Bach P 415, IMSLP #457551, Public Domain
- target tempo: 128 BPM
- proof length: about 45 s
- Type-1 MIDI / 480 PPQ / conductor + 6 named musical tracks
- source-derived track: `01 Source Pattern - Bach`
- ViceBlood arrangement: four-on-the-floor pulse, original 303-style bass guide, organ/piano stabs, club pad and FX guide
- no third-party audio

## Binary transport correction

GitHub **Tests #2259** exposed `channel event exceeds track boundary` in the first attempt to commit Batch 2 binaries. Inspection showed the local MIDI files were valid, while the binary payloads transmitted through the connected GitHub blob path were not byte-identical.

This is treated as a tooling-transport problem, not a music/provenance failure. The corrupted `.mid` files are removed rather than retained or waived.

The canonical Batch 2 repository authority is now the deterministic development-only recipe:

`tools/radio-composer/proofs/m1-3-batch2.js`

CI materializes each MIDI in a temporary directory, validates Type-1 structure, track names/order, BPM, deterministic SHA-256, provenance and attribution against the committed manifests, then discards the temporary file. The user-facing `.mid` outputs are generated from the same recipe for DAW handoff.

This keeps the PR reproducible and agent-friendly without making runtime radio or final audio part of scope.

## Exact next task

`M1.3-batch-2-recipe-ci-validation-and-user-gate`

If the recipe-backed proof set is green, set `user-validation-pending`, present all four station directions to the user and stop autonomous catalogue expansion until feedback.
