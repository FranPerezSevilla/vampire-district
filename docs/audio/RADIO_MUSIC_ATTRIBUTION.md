# ViceBlood radio music attribution contract

## Purpose

Every radio MIDI candidate must carry enough provenance and credit metadata that the final commercial game can generate accurate credits without reconstructing rights history months later.

This document separates three things that are easy to conflate:

1. **the underlying composition** — e.g. Erik Satie's `Gnossienne No. 1`;
2. **the score/edition/reproduction used as the transcription reference** — which may have its own reuse terms even when the composition is public domain;
3. **the ViceBlood arrangement/production** — original MIDI arrangement work created for the game.

The conservative rule is: if any of these layers has unclear rights or unclear credit obligations, the candidate is not provenance-complete.

## Player-facing credit policy

ViceBlood should credit the composer and source work for every public-domain-derived radio track.

Default player-facing format:

> **“<Work title>” — <Composer> (<composition/publication year when known>)**  
> **Arranged for ViceBlood (2026)**

Example:

> **“Gnossienne No. 1” — Erik Satie (1890)**  
> **Arranged for ViceBlood (2026)**

This composer/work credit is mandatory for the canonical radio catalogue. It also aligns with the Spanish public-domain rule that use of public-domain works must respect authorship and integrity.

The final UI may group these entries under `Car Radio Music` rather than showing a full legal paragraph after every station track.

## Internal provenance versus visible credits

Not every provenance fact needs to be shown to the player.

### Always keep internally

For every candidate retain:

- composer;
- work title;
- composition/publication year when known;
- score/edition/catalogue identifier;
- source institution/site;
- stable source URL or identifier;
- exact rights/public-domain statement relied upon;
- source/reproduction licence or reuse terms when applicable;
- date rights status was checked;
- whether source attribution is legally/licence-required, courtesy-only or internal-only;
- arrangement credit string;
- third-party material list, even when empty.

### Show to the player when required

Player-facing credits must include:

- composer + work title for all public-domain-derived tracks;
- any attribution text required by a score/source licence actually used in a way that triggers attribution;
- any attribution required by third-party samples, loops, performances or recordings later used in the final audio;
- any licence notice whose terms require public display.

### Internal-only by default

Source library/catalogue details such as shelfmarks, archive IDs and research URLs may remain internal when the source's terms do not require player-facing attribution and the source reproduction itself is not distributed in the game.

## Source-selection policy

The Radio Composer must minimise downstream licence obligations.

### Preferred

- public-domain composition + independently transcribed public-domain score/edition with clear reuse status;
- CC0 source material;
- original ViceBlood MIDI programming.

### Allowed with explicit manifest obligations

- CC BY material where commercial adaptation is clearly allowed and exact attribution text/version is recorded.

### Do not use canonically without explicit user approval

- `NC` / NonCommercial material;
- `ND` / NoDerivatives material;
- `SA` / ShareAlike material, including CC BY-SA, because it can impose distribution obligations on adaptations;
- sources with ambiguous authorship or unclear commercial reuse terms;
- modern commercial recordings, performances, stems or MIDI transcriptions merely because the underlying composition is public domain;
- famous drum breaks or vocal samples without separate recording/performance clearance.

If the preferred source has awkward or unclear terms, choose an equivalent cleaner score/source rather than making the whole catalogue depend on it.

## Archive/reproduction caution

A public-domain composition does not automatically mean that every digital scan, typesetting, transcription or database reproduction can be redistributed without conditions.

Therefore:

- do not commit archive scans, PDFs or score images to the ViceBlood repository merely because the musical work is public domain;
- use external score pages as research/transcription references and record their identifiers;
- inspect the source site's exact reuse/licence terms;
- when an institution applies commercial-reuse conditions to its digital reproduction, do not redistribute that reproduction as a ViceBlood asset;
- if it is unclear whether the planned transcription/derivative use is permitted under the source terms, select another source with cleaner reuse status before creating the canonical MIDI.

The objective is to own the generated MIDI/arrangement workflow while retaining a verifiable trail to the underlying public-domain music.

## Third-party audio and the later DAW pass

This PR intentionally creates MIDI without embedded third-party samples. The user's later DAW production may add instruments, loops, one-shots or ambience; those final rendered assets must retain the same rights discipline.

For every added third-party audio item record:

- asset title/description;
- creator;
- source page;
- exact licence/version;
- commercial-use status;
- modification permission;
- whether attribution is `required`, `courtesy`, or `not-required`;
- exact credit line if required;
- edits made in the ViceBlood production.

Pixabay currently permits use without attribution under its Content License, although credit is appreciated. If ViceBlood chooses to credit Pixabay contributors as a courtesy, record that explicitly as `courtesy` rather than treating it as a legal requirement. Existing SFX attribution practice may continue unchanged.

## Candidate manifest attribution contract

Every MIDI sidecar manifest must contain an `attribution` object at minimum:

```json
{
  "attribution": {
    "playerCredit": "“Gnossienne No. 1” — Erik Satie (1890). Arranged for ViceBlood (2026).",
    "composerCreditRequired": true,
    "sourceCreditRequirement": "internal-only",
    "sourceLicence": "public-domain source / exact source status recorded",
    "sourceLicenceUrl": "<stable rights/licence URL when applicable>",
    "sourceAttributionText": null,
    "arrangementCredit": "Arranged for ViceBlood (2026)",
    "thirdPartyMaterials": []
  }
}
```

Allowed `sourceCreditRequirement` values:

- `required-player-credit`;
- `courtesy-player-credit`;
- `internal-only`.

A candidate cannot become `daw-candidate` while any required attribution field is unknown.

## Catalogue attribution ledger

Maintain a canonical table/index during production with one row per accepted candidate:

| Track ID | Station | Work | Composer | Source / edition | Source status | Player credit | Extra required attribution | Third-party material |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |

The per-track sidecar manifest remains the detailed source of truth. The ledger is the human-readable roll-up used for final game credits.

## M7 final-credit gate

The DAW handoff is incomplete unless it includes a generated final-credit recommendation covering every accepted radio track.

Before setting `final-validation-pending`, verify:

- every accepted candidate has a composer/work credit;
- every source licence/reuse obligation is resolved;
- all required third-party credits are present;
- no `NC`, `ND` or unapproved `SA` dependency exists;
- no player-facing credit depends on memory or conversation history;
- the final credit list can be copied directly into the game's credits with only formatting changes.

## Relationship to PR #44

PR #44 owns the general game-audio catalogue/attribution-ledger direction. This radio contract is deliberately self-contained so PR #76 can progress before PR #44 merges.

When final rendered radio audio is integrated into runtime later, merge/mirror the radio credit records into the canonical game-wide attribution ledger established by PR #44 rather than maintaining two competing final ledgers.
