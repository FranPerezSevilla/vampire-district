# 2026-08-22 — 90s radio music production

Canonical task boundary for branch `codex/90s-radio-music-production`.

## Continuation protocol

Before changing anything, read in order:

1. `docs/progress/radio-music-production-status.json` — authoritative state and exact `nextTask`.
2. `docs/roadmaps/RADIO_MUSIC_PRODUCTION_ROADMAP.md`.
3. `docs/audio/RADIO_MUSIC_BIBLE.md`.
4. `docs/audio/RADIO_MUSIC_ATTRIBUTION.md` — mandatory credit/provenance contract.
5. `docs/agents/RADIO_COMPOSER_AGENT.md`.
6. This task boundary.
7. `docs/progress/RADIO_MUSIC_PRODUCTION_PROGRESS.md`.
8. repository `AGENTS.md` and `docs/AGENT_DEVELOPMENT.md`.

Execute only the machine-readable `nextTask` unless the user explicitly broadens scope.

## Goal

Create an agent-friendly production pipeline that can incrementally generate editable ViceBlood car-radio MIDIs from verified public-domain compositions, arranged into distinct 1990s station identities.

The user will finish accepted MIDI files in a DAW. This initiative therefore optimizes for **arrangement quality, editability, provenance, attribution and reproducibility**, not final synth/sample quality.

## In scope

- System/authority: radio-music composition workbench and source/provenance/attribution documentation.
- Expected areas:
  - `docs/audio/`;
  - `docs/roadmaps/`;
  - `docs/agents/`;
  - `docs/agent-tasks/`;
  - `docs/progress/`;
  - `tools/radio-composer/` once M1 starts;
  - `phaser/assets/audio/radio-midi/<station-id>/` for generated MIDI/manifest candidates.
- Required behavior:
  - four core 1990s station lanes remain distinguishable;
  - public-domain source is verified before transcription/arrangement;
  - generated MIDI is multitrack, portable and DAW-friendly;
  - each candidate carries a sidecar provenance/production/attribution manifest;
  - every accepted public-domain-derived track has a ready-to-use player credit for composer + work;
  - any extra source/sample licence attribution is classified as required, courtesy or internal-only;
  - progress can be resumed by a fresh agent from `nextTask` without conversation context.

## Explicit non-goals

Do not implement or modify:

- runtime radio playback;
- vehicle audio state;
- station-selection controls/UI;
- save/load radio persistence;
- final `.ogg` / `.mp3` masters;
- voice announcers/DJs;
- general SFX catalogue behavior;
- unrelated city, traffic, gameplay, Heat, police or mission systems.

Do not merge PR #44 or PR #58 as part of this work. Treat them as neighboring contracts and rebase/resolve only if their landed changes later affect this branch.

## Current exact task — M1.1

`M1.1-midi-workbench-and-manifest-contract`

### Purpose

Create the smallest reusable MIDI-generation/validation substrate before producing the four proof tracks.

### Required decisions

1. Inspect the repo's existing Node/Python toolchain and choose the smallest practical MIDI writer path.
2. Do not introduce a runtime dependency for composition tooling.
3. Prefer a reusable helper over four independent one-off scripts.
4. Define a machine-readable manifest schema/validator matching the Radio Composer agent and `RADIO_MUSIC_ATTRIBUTION.md` contracts.
5. Provide one tiny synthetic fixture or smoke-generated MIDI solely to prove the writer/validator works; this fixture is **not** counted as a radio song.

### Expected files

Exact paths may adapt to existing repository conventions after inspection, but the intended boundary is:

- `tools/radio-composer/README.md`;
- reusable writer/helper module(s);
- validation command/script;
- manifest schema/contract;
- focused tooling test/fixture if useful.

Do not generate the four musical proof tracks until the workbench passes its own validation.

### M1.1 acceptance criteria

- [ ] A fresh agent can generate a multitrack Type-1 MIDI without copying ad-hoc code from chat history.
- [ ] Generated MIDI contains an explicit conductor/meta track and named musical tracks.
- [ ] Validator detects at least malformed/unparseable output and missing required metadata/track names.
- [ ] Manifest contract includes station, source/provenance, arrangement, BPM/duration, review status and hash fields.
- [ ] Manifest contract includes the mandatory `attribution` object: ready-to-use player credit, composer-credit flag, source licence/reuse status, source-credit requirement, arrangement credit and third-party material list.
- [ ] Validator rejects promotion to `daw-candidate` when required attribution/provenance fields are unknown.
- [ ] Tooling remains development-only and does not affect game runtime.
- [ ] Synthetic smoke fixture validates successfully.
- [ ] Relevant repo checks/tests for tooling/documentation are green or their absence is explicitly recorded.
- [ ] Status advances to M1.2 rather than jumping directly to catalogue expansion.

## M1.2 next boundary preview

After M1.1 is green, choose one provenance-cleared work for each core station and create the seed provenance/attribution manifests before arranging them.

Do not assume the candidate matrix in the music bible is legally cleared merely because it is listed there. Prefer public-domain/CC0 sources with clean commercial reuse. `NC`, `ND` and `SA` dependencies are non-canonical unless the user explicitly approves them.

## M1.3 user gate preview

After M1.2, generate exactly four proof-of-style MIDI sketches:

- one Blood City Beats;
- one Vice FM;
- one Night Shift;
- one Pulse 94.6.

When all four validate, set `user-validation-pending` and stop. The user must hear the four station directions before the agent scales to a larger catalogue.

## Validation

Follow repository rules:

```bash
npm run check:fast
npm run check:affected:plan -- --base=origin/main
npm run check:affected -- --base=origin/main
```

Composition tooling may require an additional focused command; document it in `tools/radio-composer/README.md` and record exact results in progress.

Documentation-only M0 intentionally changes no runtime behavior.

## Delivery

- Keep the dedicated PR in draft while autonomous production continues.
- Update PR body when milestone/gate state materially changes.
- Append progress; never replace prior evidence.
- Keep `radio-music-production-status.json` authoritative for the exact continuation task.
- Keep the radio attribution ledger/manifest data complete enough to generate final game credits without consulting chat history.
- At listening gates, provide direct MIDI links and a short station-specific audition checklist.
- No automatic merge; explicit user approval is required.