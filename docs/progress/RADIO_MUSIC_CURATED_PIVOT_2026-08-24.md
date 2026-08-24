# 2026-08-24 — curated soundtrack pivot

## User decision

After the generated MIDI experiments, the user preferred the previous B pilot to the C refinement but concluded that autonomous composition was not producing music at the required quality level.

The subsequent finished-track search produced an enthusiastically received shortlist. This changes the canonical strategy.

## New strategy

Do **not** autonomously compose the shipping radio catalogue.

Use:

`finished modern track -> individual recording licence check -> station fit -> user shortlist -> acquisition evidence -> later runtime integration`

The MIDI workbench and generated candidates remain in the PR as historical R&D. They may still be useful for stingers, experiments or explicit user-directed MIDI work, but they do not count toward the curated shipping catalogue.

## First curated seed set

### Vice FM

1. **Daisuke Teiko — The Real Deal 90s hip hop instrumental**
   - Pixabay Content License;
   - 3:20;
   - old-school / 90s hip-hop;
   - Content ID not indicated on the checked official page;
   - acquisition-ready.

2. **1000 Handz & Cobabeats — Architexture ft. Cobabeats**
   - CC BY 4.0;
   - 2:13;
   - instrumental, explicitly not AI-generated on the source page;
   - required credit: `1000 Handz & Cobabeats`;
   - acquisition-ready.

### Blood City Beats

3. **Kulakovka — Trip Hop**
   - Pixabay Content License;
   - 2:12;
   - trip-hop;
   - Content ID registered;
   - acquisition-ready with Content-ID warning.

### Night Shift

4. **ejah_music — Big Beat Rave _ Industrial Breakbeat 1**
   - Pixabay Content License;
   - 2:18;
   - breakbeat / rave / gaming tags on official source page;
   - acquisition-ready.

### Pulse 94.6

5. **maty1309 — Tema Acid House**
   - Pixabay Content License;
   - 3:58;
   - acid house;
   - acquisition-ready.

Exact URLs and licence metadata live in `docs/audio/radio-curated-track-catalog.json`.

## Licensing authority

- Pixabay licence summary permits free use, no required attribution and modification, subject to prohibited uses including standalone redistribution. Keep internal/courtesy credit anyway.
- CC BY 4.0 permits commercial sharing/adaptation with appropriate attribution, licence reference and change indication when modified.
- Each individual track must be verified from its official track page; platform reputation alone is not enough.

## New agent

`docs/agents/RADIO_CURATOR_AGENT.md` becomes the primary autonomous music agent.

Composer/Arranger agents are historical/experimental after this pivot and must not autonomously scale the soundtrack.

## Exact next task

`CURATED-1-expand-to-three-tracks-per-core-station`

Target: at least 12 acquisition-ready finished tracks, 3 per core station, before the next user listening/pruning gate.

Normal autonomous batch: up to 4 newly verified tracks, prioritizing the least-covered stations.

No third-party audio files should be committed/downloaded into the repository until the acquisition workflow is explicitly handled; this phase owns verified metadata and source evidence.
