# CURATED-3 exact-master ingest — 2026-08-24

At `2026-08-24T12:56:00+02:00` the user supplied `Archivo.zip` with official-site downloads for the approved ViceBlood radio shortlist.

## Final result for the first runtime seed

- 9 valid MP3 masters acquired, hashed and fully decoded.
- 1 incomplete DuckDuckGo temporary download (`kulakovka-trip-hop-278457.duckload`) was rejected.
- 2 approved Free Music Archive tracks were not present (`Architexture ft. Cobabeats` and `Kyoto`).
- The user subsequently chose to **stop pursuing those three files and continue development**.
- Raw third-party audio remains outside the public Git repository.

This means CURATED-3 is complete with a **nine-track runtime seed**, not a 12-track acquisition target.

Authority for the active runtime set: `docs/audio/radio-runtime-seed-set.json`.

## Exact-master evidence

For each of the nine active masters, `docs/audio/radio-acquisition-ledger.json` records:

- exact original downloaded filename;
- SHA-256;
- byte size;
- duration;
- bitrate;
- acquisition timestamp.

All nine accepted MP3s decode cleanly end-to-end with ffmpeg.

## Historical dropped candidates

These remain documented curated candidates but are not part of the first runtime seed:

1. `1000-handz-architexture-cobabeats` — missing official FMA MP3;
2. `kulakovka-trip-hop` — received `.duckload` was incomplete/corrupt;
3. `1000-handz-kyoto` — missing official FMA MP3.

Do not block runtime work on them. They may be reintroduced later if desired.

## Attribution correction

`Big Beat Rave _ Industrial Breakbeat 3` is by **ejah_music**. The exact received filename is `ejah_music-big-beat-rave-_-industrial-breakbeat-3-473019.mp3`, and current Pixabay listing/profile evidence also identifies `ejah_music` as the creator. Earlier ViceBlood metadata incorrectly used `Delon_Boomkin`; creator attribution was corrected during ingest.

The historical internal track id remains `delon-big-beat-industrial-breakbeat-3` temporarily to avoid identifier churn.

## Next task

Curation/licensing/acquisition work hands off to a separate runtime-radio PR. PR #76 stays draft until explicit user merge approval; runtime development may proceed as a stacked PR meanwhile.
