# 90s radio music production roadmap

## Mission

Build an editable, legally traceable MIDI catalogue for ViceBlood car radios using public-domain source compositions re-arranged into convincing 1990s genres.

The target is an MVP of four distinct stations and roughly twenty production-candidate MIDI tracks. The user performs final DAW sound selection, mix and mastering.

This roadmap governs **composition work only**. Runtime radio playback/integration belongs in a later dedicated PR.

## Canonical station scope

Core stations:

1. `blood-city-beats` — boom bap / trip-hop.
2. `vice-fm` — G-funk / West Coast funk and hip-hop instrumentals.
3. `night-shift` — big beat / breakbeat / industrial dance.
4. `pulse-94-6` — house / acid house / techno.

Stretch only after the core pack works:

- `static` — alternative / grunge / industrial rock.

Detailed creative and legal guardrails live in `docs/audio/RADIO_MUSIC_BIBLE.md`.

## Milestone ladder

### M0 — production contract and agent boundary — COMPLETE

Deliverables:

- radio music bible;
- dedicated Radio Composer agent contract;
- machine-readable status with exact `nextTask`;
- append-only progress log;
- bounded agent task document;
- dedicated draft PR branch.

Gate:

- no runtime code is changed;
- station lanes, legal-source rule, MIDI output contract and user-review philosophy are explicit.

### M1 — reusable MIDI workbench + four proof tracks

Purpose: prove the production method before scaling the catalogue.

#### M1.1 — tooling and manifest contract

Create the smallest reusable workbench needed for deterministic MIDI generation and validation.

Expected outcomes:

- `tools/radio-composer/` orientation/readme;
- reusable MIDI-writing helpers or a documented minimal dependency decision;
- parser/validation path that confirms generated files open correctly;
- sidecar manifest schema/contract;
- no runtime dependency and no final audio renderer.

The implementation may use Python or Node tooling, but must not add a gameplay/runtime dependency merely to write MIDI.

#### M1.2 — provenance seed set

Choose exactly one source-work candidate for each core station and pass the public-domain provenance gate before arrangement begins.

Recommended first-pass pairing, subject to provenance verification:

- Blood City Beats — Satie or Chopin;
- Vice FM — Joplin;
- Night Shift — Grieg or Saint-Saëns;
- Pulse 94.6 — Bach or Beethoven.

Record source evidence in each track manifest. If one source is ambiguous, replace it; do not pause the whole milestone merely to preserve a preferred title.

#### M1.3 — four proof-of-style MIDIs

Generate one 45–90 second MIDI sketch per core station.

Each proof must:

- read immediately as its intended 1990s genre lane;
- expose the public-domain motif clearly enough to recognise;
- use separate source and arrangement tracks;
- use portable placeholder instruments;
- include section markers and a valid manifest;
- be sufficiently different from the other three stations that a blind listener could plausibly identify the station family.

**User gate:** after all four proofs exist and validate technically, set state to `user-validation-pending` and stop autonomous composition. Provide the four MIDI links and ask the user to approve/revise the station directions.

### M2 — station grammar canonization

Starts only after M1 user feedback.

For each station:

- record accepted BPM range, drum pocket, bass behavior, key instrument palette, density, arrangement shape and anti-patterns;
- revise any failed proof track;
- promote accepted proof tracks to `daw-candidate` status;
- ensure guidance uses genre/era language rather than imitation of a specific copyrighted artist/recording.

Exit gate: all four station grammars are user-approved enough to scale.

### M3 — first catalogue pack: 12 tracks

Build to three tracks per core station, including the accepted M1 proof where appropriate.

Rules:

- one bounded composition task normally produces one track; two is the maximum autonomous batch before status/progress is updated;
- provenance precedes arrangement;
- avoid repeating the same composer within one station until alternatives have been considered;
- production candidates target about 2:00–3:15;
- every candidate receives technical validation and manifest metadata;
- failed/weak candidates stay in workbench status rather than being silently counted.

Exit gate: 12 technically valid MIDI candidates, three per station, with complete provenance and no unresolved duplicate identity problems.

### M4 — MVP catalogue: 20 tracks

Expand to five tracks per core station.

Quality/diversity targets:

- about 12/20 recognition-anchor tracks using broadly familiar motifs;
- about 8/20 deeper public-domain choices selected for musical fit;
- no station dominated by one composer or one arrangement template;
- meaningful variation in tempo, intro length, bass shape and section structure while keeping station identity intact;
- total catalogue should plausibly yield roughly 40–60 minutes of final radio music after DAW production.

User intervention is not mandatory track-by-track unless a candidate is musically ambiguous. The agent may advance autonomously while the station grammar remains inside approved boundaries.

### M5 — station glue: IDs, stingers and transitions

Create editable MIDI sketches for non-song musical glue:

- 2–3 short station IDs/stingers per core station;
- 1 transition/bumper family per station;
- optional bed loops that can sit under future voice announcements.

No generated speech or copyrighted broadcast sample is required in this PR.

### M6 — catalogue audit

Run a complete audit before handoff.

Required checks:

- all committed MIDI files parse successfully;
- manifests and file IDs match;
- source provenance is complete for every composition;
- no third-party recording/sample dependency has crept in;
- no arrangement is documented as a copy of a named modern artist/recording;
- station counts and style labels are correct;
- duplicate source use is explicit and justified;
- abandoned prototypes are clearly marked and not counted as accepted candidates.

### M7 — DAW handoff and final user validation

Produce a compact handoff index containing:

- accepted MIDI candidates by station;
- working title and source-work credit;
- BPM/duration;
- suggested sound-replacement palette;
- known weak points or intentional placeholders;
- provenance location;
- final-credit recommendation where useful.

Set machine state to `final-validation-pending` and stop autonomous work.

The user decides which candidates receive final DAW production and whether this PR is ready to merge as the canonical MIDI source pack.

**No automatic merge.**

## Post-M7 work explicitly excluded

The following require a separate implementation PR:

- car-radio playback system;
- station tuning/selection UI;
- track scheduling/randomization;
- save-state/resume behavior;
- in-world radio spatialization;
- audio ducking around dialogue/police dispatch;
- final rendered audio encoding and streaming strategy.

## Autonomous continuation rules

A fresh agent may proceed from the machine-readable `nextTask` without asking the user for routine choices when:

- the task stays inside the approved station grammar;
- source provenance is clear;
- no user listening gate has been reached;
- no runtime/gameplay scope is required.

Stop and request user input when:

- M1 proof-of-style listening gate is reached;
- a station direction requires a subjective choice not covered by prior approval;
- provenance cannot be established safely and no equivalent candidate can be substituted;
- final M7 listening/handoff gate is reached.

## Definition of done

This initiative is complete when:

- four 1990s station identities are documented and user-approved;
- twenty accepted/editable MIDI production candidates exist across the four core stations;
- station glue MIDI exists;
- every source composition has conservative provenance metadata;
- the MIDI package is technically valid and DAW-friendly;
- the user has received the final handoff and explicitly approves merge readiness.