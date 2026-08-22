# 2026-08-22 — 90s radio music production

Canonical task boundary for branch `codex/90s-radio-music-production`.

## Continuation protocol

Before changing anything, read in order:

1. `docs/progress/radio-music-production-status.json` — authoritative state and exact `nextTask`.
2. `docs/roadmaps/RADIO_MUSIC_PRODUCTION_ROADMAP.md`.
3. `docs/audio/RADIO_MUSIC_BIBLE.md`.
4. `docs/audio/RADIO_MUSIC_ATTRIBUTION.md` — mandatory credit/provenance contract.
5. `docs/audio/RADIO_MUSIC_SOURCE_SEEDS.md` — M1.2 source evidence and proof pairings.
6. `docs/agents/RADIO_COMPOSER_AGENT.md`.
7. This task boundary.
8. `docs/progress/RADIO_MUSIC_PRODUCTION_PROGRESS.md`.
9. repository `AGENTS.md` and `docs/AGENT_DEVELOPMENT.md`.

Execute only the machine-readable `nextTask` unless the user explicitly broadens scope.

## Goal

Create an agent-friendly production pipeline that incrementally generates editable ViceBlood car-radio MIDIs from verified public-domain compositions, arranged into distinct 1990s station identities.

The user finishes accepted MIDI files in a DAW. This initiative therefore optimizes for **arrangement quality, editability, provenance, attribution and reproducibility**, not final synth/sample quality.

## Authority / non-goals

This PR owns radio composition workbench, provenance/attribution records, MIDI candidates, station composition grammar and production progress.

It does **not** own runtime radio playback, vehicle audio state, station UI, save/load radio persistence, final rendered audio, voice DJs, general SFX runtime or unrelated gameplay systems.

PR #44 and PR #58 remain neighboring contracts; do not merge them as part of this task.

## Completed boundary — M1.1

M1.1 is complete and validated by GitHub Tests #2223 / run `32578300486`.

The dependency-free `tools/radio-composer/` workbench provides Type-1 MIDI generation, inspection, manifest/provenance/attribution validation, SHA-256 pairing, smoke fixture and focused tests.

## Current exact task — M1.2 closeout

`M1.2-ci-validation-and-closeout`

M1.2 implementation has selected exactly one clean Public Domain source for each core station and added machine-readable prototype manifests:

- `blood-city-beats/chopin-prelude-04-boombap-a.json` — Chopin, *Prelude in E minor, Op.28 No.4*, Wessel & Co. ca.1839, IMSLP #66277;
- `vice-fm/maple-leaf-gfunk-a.json` — Joplin, *Maple Leaf Rag*, first edition 1899, IMSLP #270188;
- `night-shift/mountain-king-bigbeat-a.json` — Grieg, *In the Hall of the Mountain King*, composer holograph piano manuscript 1888, IMSLP #810457;
- `pulse-94-6/bach-prelude-846-acid-a.json` — Bach, *Prelude in C major, BWV 846*, holograph 1722–23, IMSLP #457551.

`docs/audio/RADIO_MUSIC_SOURCE_SEEDS.md` records the human-readable evidence/rationale.

`tests/radio-composer-workbench.test.js` now loads all four source seeds and requires zero manifest validation errors, exactly one unique core station per seed, Public Domain status, required player credit and no third-party assets.

### M1.2 closeout gate

Do not begin M1.3 until the latest GitHub Tests workflow covering the seed manifests/test is green.

When green:

1. append exact CI evidence to `RADIO_MUSIC_PRODUCTION_PROGRESS.md`;
2. set M1.2 `complete` in status;
3. set `nextTask` to `M1.3-proof-batch-1-chopin-joplin`;
4. begin proof composition in bounded batches of at most two tracks before updating progress/status.

## M1.3 composition plan after M1.2 closes

M1.3 must generate exactly four 45–90 second Type-1 proof MIDIs and update the existing manifests with actual duration, track names and SHA-256:

### Batch 1

1. `chopin-prelude-04-boombap-a` — Blood City Beats, ~88 BPM dark boom bap / trip-hop.
2. `maple-leaf-gfunk-a` — Vice FM, ~96 BPM G-funk / West Coast instrumental.

Update progress/state after this pair before starting Batch 2.

### Batch 2

3. `mountain-king-bigbeat-a` — Night Shift, ~138 BPM big beat / breakbeat / industrial dance.
4. `bach-prelude-846-acid-a` — Pulse 94.6, ~128 BPM acid house / techno.

After all four MIDI/manifest pairs pass technical validation, set `user-validation-pending` and stop. Provide direct MIDI links and a concise station audition checklist. Do not scale the catalogue until the user hears these four proofs.

## Composition safety boundary

For every proof:

- transcribe only the needed motif/harmony from the recorded source score;
- source-derived material remains on clearly named separate tracks;
- all drums, bass support, synth/keys parts and FX guide material are original ViceBlood arrangement work;
- no modern commercial performance/transcription is used as a source;
- no third-party/famous break recording is embedded;
- portable GM programs/drums are placeholders only;
- preserve station BPM/era grammar and avoid modern trap/phonk/festival-EDM markers;
- preserve attribution fields; a MIDI is not accepted without complete credit/provenance data.

## Validation

Repository baseline:

```bash
npm run check:fast
npm run check:affected:plan -- --base=origin/main
npm run check:affected -- --base=origin/main
```

Composition-focused:

```bash
npm run test:radio
npm run radio:validate -- <candidate.mid> <candidate.json>
```

## Delivery

- Keep PR #76 draft during autonomous work.
- Append progress; never replace prior evidence.
- Keep `radio-music-production-status.json` authoritative.
- At the M1.3 listening gate, provide direct links to exactly four proof MIDIs.
- No automatic merge; explicit user approval is required.
