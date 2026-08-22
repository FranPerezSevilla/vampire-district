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
