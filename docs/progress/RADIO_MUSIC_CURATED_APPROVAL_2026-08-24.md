# 2026-08-24 — curated radio 12/12 approval gate

## User verdict

The user listened to the finished-track shortlist and approved **all twelve tracks** for inclusion in the ViceBlood car-radio soundtrack direction.

Verdict: `approved-all-twelve`.

This closes the curation/pruning gate. No replacement search is required for the current 3-tracks-per-station seed catalogue.

## Approved station set

### Vice FM

1. Daisuke Teiko — `The Real Deal 90s hip hop instrumental`
2. 1000 Handz & Cobabeats — `Architexture ft. Cobabeats`
3. catch22music — `Coasting West Coast Hip Hop`

### Blood City Beats

1. Kulakovka — `Trip Hop`
2. Abydos_Music — `Trip Hop Lovers`
3. 1000 Handz — `Kyoto`

### Night Shift

1. ejah_music — `Big Beat Rave _ Industrial Breakbeat 1`
2. NaturesEye — `Dirty Industrial Rave`
3. Delon_Boomkin — `Big Beat Rave _ Industrial Breakbeat 3`

### Pulse 94.6

1. maty1309 — `Tema Acid House`
2. Placidplace — `Franic (acid trance)`
3. BerryDeep — `Back To 90s`

Exact URLs, durations, licensing classes, credit strings and Content-ID warnings live in `docs/audio/radio-curated-track-catalog.json`.

## Content-ID warnings

Keep extra evidence for:

- `catch22-coasting-west-coast-hip-hop`;
- `kulakovka-trip-hop`;
- `berrydeep-back-to-90s`.

Content ID does not invalidate the source licence; it is an operational warning for YouTube/trailers and must be handled with official download/license evidence.

## Acquisition boundary

The approved tracks are now `acquisition-ready`.

Do not interpret "approved for the soundtrack" as permission to publish raw third-party masters in the public Git repository.

For Pixabay tracks, the Content License permits commercial use as part of a larger creative work but prohibits standalone distribution. ViceBlood therefore keeps substantially unchanged Pixabay masters outside public Git and records their exact download filename, source page, licence evidence and SHA-256. They may later be embedded in the distributed game as part of the larger ViceBlood work.

CC BY 4.0 tracks permit commercial redistribution with attribution, but PR #76 uses the same acquisition-ledger workflow for operational consistency.

## Exact next task

`CURATED-3-acquire-approved-audio-and-hash`

For each of the twelve tracks:

1. acquire from the official source using an authorised download path;
2. record exact original filename and SHA-256;
3. preserve Content-ID certificate/evidence when applicable;
4. preserve mandatory CC BY attribution;
5. classify the master storage location;
6. do not enter runtime playback/integration in this PR.

After exact acquisition evidence exists for all approved tracks, set the state to `final-validation-pending` and prepare the handoff to a separate radio runtime PR.
