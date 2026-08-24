# ViceBlood curated radio music policy

## Decision

As of 2026-08-24, the canonical soundtrack-production strategy is **curation of finished modern tracks with explicit commercial-use permission**, not autonomous composition of the radio catalogue.

The MIDI composition work in this PR remains useful R&D and provenance/tooling history, but it is no longer the preferred path for building the shipping soundtrack.

Canonical flow:

`finished track discovery -> per-track licence verification -> station fit review -> user approval -> licence-safe acquisition record -> later runtime integration`

## Why this supersedes autonomous composition

The first four generated MIDI proofs were technically valid but musically weak. A later full-song pilot improved completeness, but subsequent style refinement demonstrated an important limit: measurable density, structure and technical validity do not imply good musical taste or a convincing finished song.

Therefore:

- CI can validate metadata and file integrity, but **cannot approve music**;
- the Composer/Arranger agents must not autonomously scale toward generated songs;
- generated MIDI may still be used for experiments, stingers or user-directed sketches, but only when explicitly requested;
- the shipping catalogue should prefer finished tracks by real artists/producers under licences that permit use in a commercial game.

## Accepted licence classes

### Pixabay Content License

Allowed when the individual official Pixabay track page says the track is free for use under the Pixabay Content License.

Operational rules:

- acquire only from the official Pixabay track page;
- keep track title, contributor, source URL, date checked and a licence reference/snapshot;
- attribution is not required by the Pixabay licence, but ViceBlood keeps a courtesy/internal credit record;
- **do not commit the raw Pixabay MP3 to the public Git repository in substantially the same form as downloaded**;
- the licensed track may be embedded in the distributed ViceBlood game/build as part of the larger creative work;
- keep the local/runtime master outside public source control and record its exact filename + SHA-256 in the acquisition ledger;
- Content ID status must be recorded separately because it can affect trailers/YouTube even when game use is licensed;
- for Content-ID-registered tracks, preserve the official download certificate/evidence when available;
- a Content ID claim is not automatically a rights failure, but tracks without Content ID are preferred when quality is otherwise comparable.

Rationale: Pixabay permits commercial use, copying and adaptation, but prohibits distribution of the content on a **Standalone** basis. A public repository containing a substantially unchanged MP3 would make the track directly redistributable as a standalone file, so ViceBlood uses a conservative no-raw-Pixabay-audio-in-public-Git rule.

### Creative Commons Attribution 4.0 (CC BY 4.0)

Allowed for commercial use, adaptation and redistribution when the individual source explicitly applies CC BY 4.0.

Required record:

- title;
- creator/attribution party;
- source URL;
- CC BY 4.0 licence link/reference;
- exact requested credit if supplied;
- indication of modifications if ViceBlood later edits the track.

CC BY permits redistribution, including commercially, when its terms are followed. For operational consistency, PR #76 still treats complete third-party audio as acquisition material rather than source-code content; the later runtime/audio PR decides how packaged masters are supplied to builds.

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

For `registered` tracks, keep the original source/download evidence so future YouTube claims can be disputed with the licence record. Prefer non-registered alternatives for trailers and promotional uploads when possible.

## Credits policy

ViceBlood keeps an internal credit record for **every** curated track even when attribution is optional.

Player-facing credits:

- CC BY: mandatory, using the creator's requested attribution plus licence identification;
- Pixabay: courtesy credit recommended but optional under the platform licence;
- CC0/Public Domain: courtesy/source credit recommended.

## Acquisition state

Metadata approval is not the same as publishing raw audio in source control.

Track states:

1. `discovered` — candidate found;
2. `licence-verified` — source/licence checked;
3. `user-shortlist-approved` — user likes it enough to keep evaluating;
4. `acquisition-ready` — licence/credit/Content-ID fields complete and user approved;
5. `acquired` — exact authorized download + checksum/certificate evidence recorded; raw restricted master may remain outside public Git;
6. `runtime-candidate` — ready for later radio integration/package ingestion;
7. `rejected` — not counted.

## Acquisition ledger contract

For each acquired track record:

- catalogue track ID;
- official source URL;
- acquisition date;
- original downloaded filename;
- SHA-256 of the exact master;
- media/container type;
- licence class and licence URL;
- attribution string;
- Content ID status;
- certificate/evidence filename or reference where applicable;
- storage classification (`external-runtime-master`, `public-redistributable`, etc.);
- any modifications later applied for the game and the derivative hash.

PR #76 owns curation plus this acquisition provenance. Runtime playback, station UI, scheduling and shipping-format integration remain a separate implementation PR.
