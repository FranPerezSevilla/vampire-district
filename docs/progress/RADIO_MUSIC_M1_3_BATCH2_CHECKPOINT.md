# M1.3 Batch 2 — Grieg / Bach proof checkpoint

## Gate entering Batch 2

Batch 1 is closed by GitHub **Tests #2254** / run `32597308747`, success on head `6e4167cefc11dd0b8275ea51b62af20ada42c30a`.

The Batch 1 failure in Tests #2250 was only a manifest track-list mismatch. The two Batch 1 MIDI byte streams were unchanged.

## Batch 2 implementation

### Night Shift — Grieg

- candidate: `mountain-king-bigbeat-a`
- source: Edvard Grieg, *In the Hall of the Mountain King*
- provenance: Grieg holograph piano manuscript, 21 January 1888, IMSLP #810457, Public Domain
- tempo: 138 BPM
- duration: 45.174 s
- SHA-256: `54a9f18de1f4c717071414c9b079ea93cd06db2573ccc5c6b9f6a07056840d2f`
- Type-1 MIDI / 480 PPQ / 7 named tracks
- source-derived track: `01 Source Motif - Grieg`
- ViceBlood arrangement: programmed big-beat break, distorted bass, industrial hits, low-string pulse and riser/FX guide
- no borrowed commercial break or third-party audio

### Pulse 94.6 — Bach

- candidate: `bach-prelude-846-acid-a`
- source: J. S. Bach, *Prelude in C major, BWV 846*
- provenance: holograph manuscript 1722–23, Staatsbibliothek zu Berlin Mus. ms. Bach P 415, IMSLP #457551, Public Domain
- tempo: 128 BPM
- duration: 44.953 s
- SHA-256: `a88b33c10506cda73c83a4f96ac26809aefc0cbb849a7f08c9980565ccdb9ee0`
- Type-1 MIDI / 480 PPQ / 7 named tracks
- source-derived track: `01 Source Pattern - Bach`
- ViceBlood arrangement: four-on-the-floor placeholder drums, original 303-style bass guide, organ/piano stabs, club pad and FX guide
- no third-party audio

## Exact next task

`M1.3-batch-2-ci-validation-and-user-gate`

Once the committed Batch 2 pairs are green, set `user-validation-pending`, present all four station proofs to the user, and stop autonomous catalogue expansion until feedback.
