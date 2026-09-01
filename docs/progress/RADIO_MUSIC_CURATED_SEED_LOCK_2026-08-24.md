# 2026-08-24 — nine-track runtime seed lock

## User decision

After exact-master ingest reached 9 valid acquired MP3s, the user chose to stop pursuing the remaining three downloads and continue development.

This supersedes the earlier 12/12 acquisition target.

## Active runtime seed

The first runtime radio implementation uses the nine already acquired and fully decoded masters:

- Vice FM: 2 tracks;
- Blood City Beats: 1 track;
- Night Shift: 3 tracks;
- Pulse 94.6: 3 tracks.

Authority: `docs/audio/radio-runtime-seed-set.json`.

## Dropped candidates

The following remain historical curated candidates but are excluded from the first runtime seed:

- `1000-handz-architexture-cobabeats` — missing official FMA download;
- `kulakovka-trip-hop` — supplied DuckDuckGo temporary download was incomplete/corrupt;
- `1000-handz-kyoto` — missing official FMA download.

Do not block radio runtime implementation on these three. They can be reconsidered later without reopening the first runtime milestone.

## Acquisition result

All nine active seed masters have:

- exact original downloaded filename;
- SHA-256;
- byte size;
- duration and bitrate metadata;
- clean full-file ffmpeg decode;
- source/licence/credit evidence.

The masters remain outside public Git according to the curated music policy.

## Next boundary

PR #76 owns curation/licensing/acquisition metadata only and remains draft pending explicit merge approval.

Runtime radio implementation must be a separate PR. It may be developed as a stacked PR from the #76 branch so work can continue without merging #76 first.
