# Curated radio soundtrack approval — 2026-08-24

## User verdict

The user approved **all twelve curated tracks** for ViceBlood: three per core station.

This closes the musical shortlist gate and authorizes licence-safe acquisition.

## Acquisition status after first ingest

At `2026-08-24T12:56:00+02:00` the user supplied official-site downloads in `Archivo.zip`.

- 9 valid MP3 masters were acquired, hashed and fully decoded successfully.
- `Kulakovka — Trip Hop` arrived only as an incomplete `.duckload` and must be downloaded again.
- `Architexture ft. Cobabeats` and `Kyoto` were not present and remain to be downloaded from Free Music Archive.

Current acquisition status is therefore **9/12**.

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
3. ejah_music — `Big Beat Rave _ Industrial Breakbeat 3`

### Pulse 94.6

1. maty1309 — `Tema Acid House`
2. Placidplace — `Franic (acid trance)`
3. BerryDeep — `Back To 90s`

Exact URLs, durations, licensing classes, credit strings, acquisition hashes and Content-ID warnings live in the audio catalogue/ledger.

## Attribution correction

`Big Beat Rave _ Industrial Breakbeat 3` is by **ejah_music**, not `Delon_Boomkin`. Exact-master ingest and current Pixabay evidence confirm the correction.

## Content-ID warnings

Keep extra evidence for:

- `catch22-coasting-west-coast-hip-hop`;
- `kulakovka-trip-hop`;
- `berrydeep-back-to-90s`.

Content ID does not invalidate the source licence; it is an operational warning for YouTube/trailers and must be handled with official download/license evidence.

## Acquisition boundary

Do not interpret "approved for the soundtrack" as permission to publish raw third-party masters in the public Git repository.

For Pixabay tracks, ViceBlood keeps substantially unchanged masters outside public Git and records their exact download filename, source page, licence evidence and SHA-256. CC BY 4.0 tracks use the same private acquisition workflow for consistency.

## Exact next task

`CURATED-3-complete-three-missing-downloads`

Download/re-download the remaining three official masters, hash them, close acquisition at 12/12, then set the state to `final-validation-pending` and prepare the handoff to a separate radio runtime PR.
