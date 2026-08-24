# CURATED-3 exact-master ingest — 2026-08-24

At `2026-08-24T12:56:00+02:00` the user supplied `Archivo.zip` with official-site downloads for the approved ViceBlood radio shortlist.

## Result

- 9 valid MP3 masters acquired and hashed.
- All 9 valid MP3s also decode cleanly from start to finish with ffmpeg.
- 1 incomplete DuckDuckGo temporary download rejected: `kulakovka-trip-hop-278457.duckload`.
- 2 approved Free Music Archive tracks were not present: `Architexture ft. Cobabeats` and `Kyoto`.
- Raw third-party audio remains outside the public Git repository.

The nine valid MP3s are recorded in `docs/audio/radio-acquisition-ledger.json` with original filename, SHA-256, byte size, duration and bitrate.

## Remaining three

1. Vice FM — `1000-handz-architexture-cobabeats`: download the official FMA MP3.
2. Blood City Beats — `kulakovka-trip-hop`: re-download the official Pixabay MP3. The received `.duckload` is incomplete; ffmpeg reports invalid MP3 data/header during decode.
3. Blood City Beats — `1000-handz-kyoto`: download the official FMA MP3.

## Attribution correction

`Big Beat Rave _ Industrial Breakbeat 3` is by **ejah_music**. The exact received filename is `ejah_music-big-beat-rave-_-industrial-breakbeat-3-473019.mp3`, and current Pixabay listing/profile evidence also identifies `ejah_music` as the creator. Earlier ViceBlood metadata incorrectly used `Delon_Boomkin`; creator attribution is corrected during this ingest.

The stable internal track id remains `delon-big-beat-industrial-breakbeat-3` for now to avoid needless identifier churn.

## Exact next task

`CURATED-3-complete-three-missing-downloads`

After the remaining three official masters are supplied: validate/decode them, hash them, close acquisition at 12/12, then prepare the separate runtime-radio implementation PR.
