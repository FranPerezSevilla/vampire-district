# ViceBlood curated radio music policy

## Decision

As of 2026-08-24, the canonical soundtrack-production strategy is **curation of finished modern tracks with explicit commercial-use permission**, not autonomous composition of the radio catalogue.

The MIDI composition work in this PR remains useful R&D and provenance/tooling history, but it is no longer the preferred path for building the shipping soundtrack.

Canonical flow:

`finished track discovery -> per-track licence verification -> station fit review -> user approval -> acquisition record -> later runtime integration`

## Why this supersedes autonomous composition

The first four generated MIDI proofs were technically valid but musically weak. A later full-song pilot improved completeness, but subsequent style refinement demonstrated an important limit: measurable density, structure and technical validity do not imply good musical taste or a convincing finished song.

Therefore:

- CI can validate metadata and file integrity, but **cannot approve music**;
- the Composer/Arranger agents must not autonomously scale toward 12/20 generated songs;
- generated MIDI may still be used for experiments, stingers or user-directed sketches, but only when explicitly requested;
- the shipping catalogue should prefer finished tracks by real artists/producers under licences that permit use in a commercial game.

## Accepted licence classes

### Pixabay Content License

Allowed when the individual official Pixabay track page says the track is free for use under the Pixabay Content License.

Operational rules:

- download only from the official Pixabay page;
- keep track title, contributor, source URL, date checked and a licence snapshot/reference;
- attribution is not required by the Pixabay licence, but ViceBlood keeps a courtesy/internal credit record;
- do not redistribute the track as a standalone music download;
- Content ID status must be recorded separately because it can affect trailers/YouTube even when game use is licensed;
- a Content ID claim is not automatically a rights failure, but tracks without Content ID are preferred when quality is otherwise comparable.

### Creative Commons Attribution 4.0 (CC BY 4.0)

Allowed for commercial use and adaptation when the individual source explicitly applies CC BY 4.0.

Required record:

- title;
- creator/attribution party;
- source URL;
- CC BY 4.0 licence link/reference;
- exact requested credit if supplied;
- indication of modifications if ViceBlood later edits the track.

### CC0 / Public Domain recording

Allowed when the **recording itself**, not merely the composition, is clearly CC0/Public Domain. Keep source/provenance evidence anyway.

## Rejected by default

Do not canonicalize tracks with:

- NC / NonCommercial restrictions;
- ND / NoDerivatives when editing/looping may be required;
- unclear commercial-game rights;
- a site-specific licence that explicitly requires a paid game/app licence;
- unverified reuploads of commercial music;
- famous commercial recordings merely labelled "no copyright" by a third party;
- samples/recordings whose upstream rights are unclear.

## Content ID

Content ID is an operational risk, not necessarily a licence failure.

For each track record one of:

- `not-indicated-on-source-page-at-check-time`;
- `registered`;
- `not-applicable`;
- `unknown`.

For `registered` tracks, keep the original download/source evidence so future YouTube claims can be disputed with the licence record. Prefer non-registered alternatives for trailers and promotional uploads when possible.

## Credits policy

ViceBlood keeps an internal credit record for **every** curated track even when attribution is optional.

Player-facing credits:

- CC BY: mandatory, using the creator's requested attribution plus licence identification;
- Pixabay: courtesy credit recommended but optional under the platform licence;
- CC0/Public Domain: courtesy/source credit recommended.

## Acquisition state

Metadata approval is not the same as committing audio to the repository.

Track states:

1. `discovered` — candidate found;
2. `licence-verified` — source/licence checked;
3. `user-shortlist-approved` — user likes it enough to keep evaluating;
4. `acquisition-ready` — licence/credit/Content-ID fields complete;
5. `acquired` — exact downloaded audio file + checksum recorded;
6. `runtime-candidate` — ready for later radio integration;
7. `rejected` — not counted.

PR #76 owns stages 1–5 and soundtrack curation metadata. Runtime playback remains a separate implementation PR.
