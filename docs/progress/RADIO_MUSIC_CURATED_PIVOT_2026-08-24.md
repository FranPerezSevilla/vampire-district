# 2026-08-24 — curated soundtrack pivot

## User decision

After the generated MIDI experiments, the user preferred the B pilot to C but concluded that autonomous composition was not producing music at the required quality level.

A subsequent search for finished modern licensed tracks produced an enthusiastically received first shortlist. That permanently changed the canonical strategy for the shipping radio catalogue.

## Canonical strategy

Do **not** autonomously compose the shipping radio catalogue.

Use:

`finished modern track -> individual recording licence check -> station fit -> user shortlist -> acquisition evidence -> later runtime integration`

The MIDI workbench and generated candidates remain historical R&D. They may still be useful for stingers, experiments or explicit user-directed MIDI work, but they do not count toward the curated shipping catalogue.

## Licence authority

- Pixabay Content License: use permitted for free, without required attribution, and modification is allowed subject to prohibited uses including standalone redistribution. Keep creator/source records anyway.
- CC BY 4.0: commercial sharing/adaptation permitted with appropriate attribution, licence reference and change indication when modified.
- Each recording is verified from its individual official track page. Platform reputation alone is not sufficient.
- Content ID is tracked separately from licence safety.

## Balanced 12-track shortlist reached

The catalog now contains exactly three licence-verified tracks per core station.

### Vice FM

1. `daisuke-teiko-real-deal-90s-hip-hop` — user shortlist-approved / acquisition-ready.
2. `1000-handz-architexture-cobabeats` — user shortlist-approved / acquisition-ready / CC BY 4.0.
3. `catch22-coasting-west-coast-hip-hop` — licence-verified / pending user review / Content ID registered.

### Blood City Beats

1. `kulakovka-trip-hop` — user shortlist-approved / acquisition-ready / Content ID registered.
2. `abydos-trip-hop-lovers` — licence-verified / pending user review.
3. `1000-handz-kyoto` — licence-verified / pending user review / CC BY 4.0 / source says not AI-generated.

### Night Shift

1. `ejah-big-beat-industrial-breakbeat-1` — user shortlist-approved / acquisition-ready.
2. `natureseye-dirty-industrial-rave` — licence-verified / pending user review.
3. `delon-big-beat-industrial-breakbeat-3` — licence-verified / pending user review.

### Pulse 94.6

1. `maty1309-tema-acid-house` — user shortlist-approved / acquisition-ready.
2. `placidplace-franic-acid-trance` — licence-verified / pending user review.
3. `berrydeep-back-to-90s` — licence-verified / pending user review / Content ID registered.

Exact URLs, durations, licence classes and credits live in `docs/audio/radio-curated-track-catalog.json`.

## Current gate

State: `user-validation-pending`.

The user has already enthusiastically approved the first five seeds. The seven additional licence-verified tracks must now be listened to and kept/rejected before acquisition.

Do not download/commit third-party audio into the repository yet.

## New primary agent

`docs/agents/RADIO_CURATOR_AGENT.md`

Composer/Arranger agents are historical/experimental after this pivot and must not autonomously scale the soundtrack.

## Exact next task

`CURATED-2-user-prune-seven-new-tracks`

After user pruning:

- promote kept tracks to `acquisition-ready`;
- replace rejected tracks until each station has at least three approved tracks;
- only then define exact audio acquisition/download/checksum workflow.
