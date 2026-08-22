# 90s radio music production progress

Append-only progress/evidence log for the dedicated radio composition initiative.

Do not rewrite prior entries. Corrections should be appended as new dated entries explaining what changed.

## 2026-08-22 — M0 production contract established

### User intent captured

The radio soundtrack should:

- use music styles that plausibly existed in the 1990s;
- leverage famous or recognisable public-domain compositions where useful;
- avoid relying on copyrighted commercial recordings;
- be produced as editable MIDI files;
- leave final instrument/sample replacement, mixing and mastering to the user in a DAW;
- be structured so an autonomous agent can advance the catalogue incrementally without needing conversation history.

### Core station decision

Four core lanes were selected for the first production cycle:

1. Blood City Beats — boom bap / trip-hop.
2. Vice FM — G-funk / West Coast funk and hip-hop instrumentals.
3. Night Shift — big beat / breakbeat / industrial dance.
4. Pulse 94.6 — house / acid house / techno.

A fifth alternative/grunge/industrial-rock station (`static`) is intentionally stretch scope because General MIDI guitar sketches are less useful for validating the production pipeline than the four electronic/hip-hop lanes.

### Production/legal boundary

Canonical method:

`verified public-domain score/source -> independent transcription or motif extraction -> original 1990s arrangement -> multitrack MIDI -> user DAW polish`

Important consequences:

- old composition status does not grant permission to copy a modern recording/arrangement;
- public-domain/provenance evidence must be recorded before arrangement;
- no third-party commercial recording is needed for the core workflow;
- famous break samples are not assumed safe merely because the break is historically common;
- genre conventions are used without exact named-artist imitation.

### Repository boundary

This PR is composition/workbench scope only.

It deliberately excludes:

- runtime radio playback;
- car/station UI;
- save-state radio logic;
- voice DJs;
- final rendered audio;
- unrelated gameplay/audio refactors.

Neighboring PRs are recognized but not pulled into the branch:

- PR #44 — general sound catalogue / attribution ledger;
- PR #58 — public-domain Gnossienne provenance pattern.

### Agentization

Created a dedicated Radio Composer operational contract with:

- canonical read order;
- exact provenance-first composition protocol;
- DAW-friendly MIDI specification;
- sidecar manifest requirements;
- one-track normal autonomous batch size (two maximum before state/progress update);
- explicit user listening gates;
- anti-patterns covering modern genre leakage, recording/sample rights and runtime scope drift.

### Roadmap state

M0: complete.

Exact next task:

`M1.1-midi-workbench-and-manifest-contract`

M1.1 must build the smallest reusable MIDI writing/validation substrate and prove it with a synthetic smoke fixture. It must not yet count a musical radio track.

After M1.1, M1.2 provenance-clears one work per station. M1.3 generates four proof-of-style MIDIs and then stops for the user's first listening gate.

### Validation

M0 changes documentation/contracts only. No runtime behavior or generated audio/MIDI asset is changed at this checkpoint.

## 2026-08-22 — attribution contract added

### User requirement

The user explicitly requested that radio music have the same disciplined attribution handling as the project's sound effects: credits must be recorded as the assets are produced rather than reconstructed at release time.

### Contract added

Created `docs/audio/RADIO_MUSIC_ATTRIBUTION.md` and added it to the canonical continuation order.

The contract separates:

1. underlying public-domain composition;
2. score/edition/digital reproduction used as the transcription reference;
3. original ViceBlood arrangement;
4. any third-party material later introduced during DAW production.

### Player-facing credit rule

Every canonical public-domain-derived radio track must carry a ready-to-use composer/work credit, defaulting to:

`“<Work>” — <Composer> (<year when known>). Arranged for ViceBlood (2026).`

Additional source/sample attribution is included in player credits whenever its licence actually requires it.

### Licence policy

Preferred dependencies are clean public-domain sources and CC0.

CC BY is allowed only with exact attribution/version recorded. `NC`, `ND`, `SA`/ShareAlike and unclear-commercial-reuse dependencies are non-canonical unless the user explicitly approves them.

Modern commercial recordings, performances and famous sample/break recordings remain disallowed by default even when the underlying composition is public domain.

### Pixabay relationship

Current Pixabay Content License attribution is not mandatory, but credit is appreciated. Existing project practice may continue crediting Pixabay contributors as a courtesy; the radio/SFX ledgers should distinguish `courtesy` from legally/licence-required attribution.

### M1.1 impact

The next workbench/manifest task must implement an `attribution` object and validation. A candidate may not become `daw-candidate` while required credit/provenance information is unknown.

M7 must produce a final credit roll-up that can be copied into the game's credits without relying on conversation history.

## 2026-08-22 — M1.1 MIDI workbench implementation checkpoint

### Implementation

Commit `85e22cc49ccfe15092d9a8127f85e4b4e47751d2` adds a dependency-free development-only workbench under `tools/radio-composer/`:

- `midi-workbench.js` — SMF Type-1 writer, narrow parser/validator, SHA-256 helper and sidecar manifest validator;
- `manifest.schema.json` — explicit manifest contract;
- `smoke.js` — synthetic end-to-end fixture generator;
- `validate-candidate.js` — CLI pair validator;
- `README.md` — fresh-agent usage and production workflow;
- `tests/radio-composer-workbench.test.js` — focused `node:test` coverage;
- package scripts `test:radio`, `radio:smoke` and `radio:validate`.

No Phaser/runtime dependency was added and the synthetic smoke fixture is explicitly excluded from catalogue counts.

### MIDI validation contract now proven locally

A temporary isolated execution of the exact workbench code passed 4/4 focused tests:

1. writes a named Type-1 MIDI with conductor/tempo metadata;
2. rejects malformed MIDI headers;
3. rejects manifests missing provenance/attribution requirements;
4. writes and re-validates a paired synthetic MIDI + sidecar manifest.

The smoke fixture produced:

- conductor track;
- `01 Synthetic Motif`;
- `02 Placeholder Drums`;
- 96 BPM;
- SHA-256 `7eaace8e27615f8e9f9a59035371aa98e0f8044830cd330f949fd716e854d46e`.

The pair validator confirmed track-name/order agreement and matching hash.

### Attribution gate implemented

The manifest validator now requires source/reuse fields plus an `attribution` object containing:

- credit classification;
- ready-to-use player credit;
- internal source credit;
- licence/status statement;
- third-party asset list.

This is the tooling enforcement requested after the attribution-policy discussion; a later `daw-candidate` cannot silently omit required source/credit metadata.

### Repository validation state

GitHub workflow **Tests #2221** / run `32578217186` was still `in_progress` at the final bounded observation for implementation commit `85e22cc49ccfe15092d9a8127f85e4b4e47751d2`.

Per repository bounded-wait rules, autonomous work does not poll indefinitely. M1.1 is therefore recorded as `implementation-complete-validation-pending`, not falsely marked green.

Exact next task remains:

`M1.1-ci-validation-and-closeout`

Only after that gate is green should state advance to `M1.2-provenance-seed-set`; M1.2 will select and document exactly one clean source work per core station before any proof arrangement is generated.
