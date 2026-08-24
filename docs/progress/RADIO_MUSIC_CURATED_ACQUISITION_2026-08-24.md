# CURATED-3 acquisition checkpoint — 2026-08-24

## CI baseline

GitHub Tests #2299 completed successfully on commit `8b2b793b0459382d210221cbd40c17c672c06f2b`.

The user approved all twelve curated tracks: three per core station.

## First exact-master ingest

At `2026-08-24T12:56:00+02:00` the user supplied `Archivo.zip` containing official-site downloads.

Result:

- **9 valid MP3 masters acquired and hashed**;
- **1 incomplete DuckDuckGo temporary download rejected** (`kulakovka-trip-hop-278457.duckload`);
- **2 approved FMA tracks absent from the archive** (`Architexture ft. Cobabeats`, `Kyoto`).

The nine valid MP3s parse cleanly with ffprobe and are recorded in `docs/audio/radio-acquisition-ledger.json` with exact original filenames, SHA-256, byte size, duration and bitrate.

The raw third-party masters remain outside the public Git repository.

## Remaining three

### Vice FM
- `1000-handz-architexture-cobabeats` — **missing**; download the official FMA MP3.

### Blood City Beats
- `kulakovka-trip-hop` — **redownload required**. The received `.duckload` is an incomplete temporary file. `ffmpeg` reports invalid MP3 data/header while decoding.
- `1000-handz-kyoto` — **missing**; download the official FMA MP3.

When those three official masters are available, place them in the private ingest flow and hash them before closing CURATED-3.

## Attribution correction discovered during ingest

`Big Beat Rave _ Industrial Breakbeat 3` is by **ejah_music**.

The downloaded filename is:

`ejah_music-big-beat-rave-_-industrial-breakbeat-3-473019.mp3`

Current Pixabay search/profile evidence also identifies `ejah_music` as the creator. Earlier ViceBlood metadata naming `Delon_Boomkin` was incorrect and is corrected in the catalogue, acquisition ledger and credits.

The stable internal track id remains `delon-big-beat-industrial-breakbeat-3` for now to avoid needless identifier churn; creator attribution is authoritative as `ejah_music`.

## Repository/publication boundary

Pixabay masters are not committed as substantially unchanged standalone audio files to the public repository. Exact hashes/provenance live in the acquisition ledger; the masters are packaged later through the private build/runtime asset flow.

CC BY 4.0 masters use the same private workflow for consistency even though redistribution is permitted with attribution.

## Exact next task

`CURATED-3-complete-three-missing-downloads`

After the remaining three masters are supplied:

1. validate/decode them;
2. record original filename, SHA-256, byte size, duration and acquisition time;
3. confirm 12/12 acquired;
4. move to `final-validation-pending`;
5. prepare the separate runtime radio implementation PR.
