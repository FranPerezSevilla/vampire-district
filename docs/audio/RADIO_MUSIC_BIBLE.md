# ViceBlood 90s radio music bible

## Canonical strategy — 2026-08-24

ViceBlood car radios should sound like believable 1990s stations using **finished modern tracks whose individual recordings have explicit commercial-use permission**.

The canonical production path is now:

`finished track discovery -> per-recording licence verification -> station fit -> user approval -> acquisition evidence -> later runtime integration`

The prior public-domain-composition/MIDI arrangement work remains in the repository as historical R&D, tooling and provenance experiments. It is **not** the preferred shipping-catalogue path after the user rejected the autonomous composition quality.

Primary authority:

- `docs/audio/RADIO_CURATED_MUSIC_POLICY.md`
- `docs/audio/radio-curated-track-catalog.json`
- `docs/agents/RADIO_CURATOR_AGENT.md`
- `docs/progress/radio-music-production-status.json`

## Core station grid

| ID | Working display name | 1990s lane | Curated target |
| --- | --- | --- | --- |
| `blood-city-beats` | Blood City Beats | trip-hop + boom-bap + nocturnal downtempo hip-hop | finished dark/urban tracks with groove, not generic cinematic beds |
| `vice-fm` | Vice FM | hip-hop + G-funk + funk-forward rap instrumentals | finished West Coast/old-school tracks that feel good while cruising |
| `night-shift` | Night Shift | big beat + breakbeat + industrial dance + period rave | aggressive finished tracks with break-driven momentum |
| `pulse-94-6` | Pulse 94.6 | house + acid house + techno | club-ready finished tracks with credible 1990s dance vocabulary |

`static` remains stretch scope for later alternative/grunge/industrial-rock curation.

## Era guardrails

Do use:

- boom bap, trip-hop, G-funk, West Coast funk, big beat, breakbeat, industrial dance, house, acid house and techno;
- tracks whose production language plausibly belongs to the mid/late 1990s even if the recording itself is modern;
- contrast between stations: ViceBlood is dark, but the radios do not all need to be dark.

Avoid as canonical station language:

- modern trap hi-hat/808-slide grammar;
- phonk/cowbell drift;
- dubstep drops;
- current festival-EDM supersaw builds;
- modern synthwave/retrowave nostalgia pretending to be period music;
- contemporary lo-fi-study-beat wallpaper when it lacks a real song identity.

## Recording-rights rule

The exact **recording** used in ViceBlood must have a verified licence that allows use in a commercial game. It is not enough for the underlying composition to be public domain or for a website to call something "royalty free" generically.

For every candidate:

1. verify the individual official track page;
2. record exact source URL, creator and duration;
3. record the exact licence class and commercial-use assessment;
4. capture required attribution or courtesy credit;
5. capture Content ID status separately where relevant;
6. capture AI-generated/modified status when the source provides it;
7. do not acquire/commit the audio until the user has approved the shortlist and the acquisition record is ready.

Accepted licence classes and detailed rules live in `RADIO_CURATED_MUSIC_POLICY.md`.

## Quality rule

A legally safe track is not automatically a good radio track.

Prefer tracks that:

- are complete songs/instrumentals, normally around 2–4+ minutes;
- survive repeated listening while driving;
- have enough development and groove to feel like music rather than stock-video filler;
- clearly belong to a station;
- add contrast to neighboring tracks;
- are not all from the same creator or exact production template.

The user is the subjective music gate.

## Current curated direction

The first 12-track balanced shortlist is stored in:

`docs/audio/radio-curated-track-catalog.json`

It contains three licence-verified tracks per core station. Five initial seeds received enthusiastic user shortlist approval; seven additional tracks are pending user listening before acquisition.

## Credits

Keep an internal source/credit record for every track.

- CC BY 4.0: player-facing attribution is mandatory; include licence identification and later indicate modifications when applicable.
- Pixabay Content License: attribution is not required by the platform licence, but keep courtesy/internal creator credit and the official track URL.
- CC0/Public Domain recordings: keep provenance/courtesy credit anyway.

## Content ID

Content ID is tracked separately from licence safety. A Pixabay track can be licensed for game use and still be registered with Content ID.

Registered tracks are allowed to remain candidates, but:

- preserve official download/licence evidence;
- expect possible automated YouTube/trailer claims;
- prefer otherwise-equivalent non-registered tracks for promotional use.

## Historical MIDI R&D

The repository still contains:

- the MIDI workbench;
- public-domain source manifests;
- four rejected A proofs;
- the Maple Leaf B complete-song experiment;
- the rejected C refinement;
- Composer/Arranger agent contracts.

These are historical/experimental after the curated-track pivot. Do not autonomously expand them into the shipping soundtrack unless the user explicitly asks to resume MIDI composition.

## Runtime boundary

PR #76 owns curation, licensing evidence, credits and eventual exact acquired-file provenance. A separate implementation PR owns:

- car-radio playback;
- station tuning/selection UI;
- scheduling/randomization;
- save/resume;
- in-world spatialization;
- ducking;
- streaming/encoding choices.
