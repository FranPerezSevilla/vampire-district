# ViceBlood 90s radio music bible

## Mission

ViceBlood car radios should sound like stations that plausibly existed in a mid/late-1990s city while using legally clean source material and editable MIDI sketches rather than third-party commercial recordings.

The core production pattern is:

`verified public-domain composition -> independent transcription / motif extraction -> original 1990s genre arrangement -> multitrack MIDI -> user DAW polish -> final rendered asset in a later integration pass`

The point is not to make a classical-music station. The listener should hear a convincing 1990s station first and only then recognise a familiar public-domain melody inside it.

Credit/provenance requirements are mandatory and live in `docs/audio/RADIO_MUSIC_ATTRIBUTION.md`. No candidate is complete merely because the composition is public domain; the score/source layer, arrangement layer and any later third-party audio material must also be traceable.

The first verified proof-cycle source set is recorded in `docs/audio/RADIO_MUSIC_SOURCE_SEEDS.md`. Candidate ideas below remain creative backlog unless separately provenance-cleared.

## Output model

This initiative produces **MIDI production sketches**, not final mastered audio.

- The agent owns source verification, transcription where required, arrangement, MIDI structure, naming, provenance metadata and attribution metadata.
- The user owns final instrument selection, sample replacement, mix, mastering and subjective polish in a DAW.
- General MIDI programs and drum notes are placeholders only.
- Runtime radio playback/integration is a separate concern and must not be smuggled into this PR.

## Core station grid

Station IDs are stable working IDs. Display names can change later without rewriting the production catalogue.

| ID | Working display name | 1990s lane | Typical BPM | Sonic grammar |
| --- | --- | --- | ---: | --- |
| `blood-city-beats` | Blood City Beats | boom bap + trip-hop | 82–100 | dry/dusty drums, restrained swing, round/sub bass, Rhodes/organ/piano, sparse nocturnal texture |
| `vice-fm` | Vice FM | G-funk + West Coast funk/hip-hop instrumentals | 88–108 | syncopated funk bass, dry kick/snare, electric piano/clav, mono/portamento synth lead, relaxed pocket |
| `night-shift` | Night Shift | big beat + breakbeat + industrial dance | 125–150 | original programmed breaks, distorted bass, orchestral/metal hits, noise/riser gestures, aggressive edit points |
| `pulse-94-6` | Pulse 94.6 | house + acid house + techno | 120–140 | four-on-floor or period break patterns, 909-like placeholder drums, 303-like mono bass, piano/organ stabs, repetitive club structure |

### Stretch station

`static` may later cover 1990s alternative/grunge/industrial rock. It is deliberately deferred until the four electronic/hip-hop stations are proven because convincing rock arrangement is less useful to validate with General MIDI guitar placeholders.

## Era guardrails

Use production vocabulary and arrangement devices that were established in the 1990s. Avoid modern genre markers that would immediately date the soundtrack after the setting.

Do use:

- boom bap, trip-hop, G-funk, West Coast funk, big beat, breakbeat, industrial dance, house, acid house and techno;
- period-appropriate swing, sparse sampling-style repetition, funk bass, mono synth leads, break programming, four-on-floor club structures and restrained effects;
- original MIDI programming that evokes period equipment without copying a specific recording.

Do not use as the default language:

- trap hi-hat rolls, modern 808-slide grammar, phonk/cowbell drift, dubstep drops, festival-EDM supersaw builds, modern synthwave/retrowave nostalgia grammar or contemporary lo-fi-study-beat clichés;
- a prompt or brief that asks for a living/recent artist's exact style;
- a copyrighted commercial arrangement as a transcription reference.

## Public-domain source rule

A famous old composition is **not enough by itself**. Each track must pass a provenance gate before arrangement work starts.

For every source work:

1. locate a score or authoritative catalogue entry whose public-domain status is documented for the source being used;
2. record composer, work title, composition/publication information when known, edition/source, stable source URL or catalogue identifier and the status statement relied upon;
3. record the source/reproduction licence or reuse terms and the resulting credit requirement (`required-player-credit`, `courtesy-player-credit` or `internal-only`);
4. transcribe from that score/source, not from a modern commercial recording;
5. never import a third-party recording or famous break/sample merely because the underlying composition is old;
6. if status or attribution obligation is unclear, stop using that candidate and choose another one rather than guessing.

Prefer clean public-domain/CC0 sources. CC BY may be used only with exact attribution/version recorded. NC, ND and ShareAlike dependencies are non-canonical unless explicitly approved by the user.

The arrangement itself must be original ViceBlood work. Genre conventions are allowed; copying the distinctive arrangement, bass line, beat, hook or sound design of a modern copyrighted recording is not.

## M1.2 verified proof-cycle seeds

These four are cleared as the first proof inputs; exact edition/source evidence and credits are in `RADIO_MUSIC_SOURCE_SEEDS.md` and their candidate manifests.

| Station | Candidate | Source work | Planned proof |
| --- | --- | --- | --- |
| Blood City Beats | `chopin-prelude-04-boombap-a` | Chopin — Prelude in E minor, Op.28 No.4 | ~88 BPM dark boom bap / trip-hop |
| Vice FM | `maple-leaf-gfunk-a` | Joplin — Maple Leaf Rag | ~96 BPM G-funk / West Coast instrumental |
| Night Shift | `mountain-king-bigbeat-a` | Grieg — In the Hall of the Mountain King | ~138 BPM big beat / industrial breakbeat |
| Pulse 94.6 | `bach-prelude-846-acid-a` | Bach — Prelude in C major, BWV 846 | ~128 BPM acid house / techno |

## Candidate source matrix

These are **creative candidates only** beyond the verified M1.2 seed set. Inclusion here is not provenance approval; each must be verified independently before generating a canonical MIDI.

| Public-domain work candidate | Suggested station | 90s transformation idea |
| --- | --- | --- |
| Satie — `Gnossienne No. 1` | Blood City Beats | nocturnal trip-hop / boom-bap hybrid |
| Satie — `Gymnopédie No. 1` | Blood City Beats | sparse trip-hop with Rhodes and deep bass |
| Chopin — Prelude in E minor, Op. 28 No. 4 | Blood City Beats | dark 90s boom bap |
| Chopin — Funeral March (Piano Sonata No. 2, III) | Blood City Beats | slow menacing hip-hop instrumental |
| Joplin — `Maple Leaf Rag` | Vice FM | G-funk pocket with motif fragments on keys |
| Joplin — `The Entertainer` | Vice FM | relaxed funk/hip-hop instrumental |
| Beethoven — Symphony No. 5 opening motif | Vice FM or Pulse 94.6 | funk riff treatment or minimal techno hook |
| Grieg — `In the Hall of the Mountain King` | Night Shift | accelerating-feel big beat / breakbeat |
| Saint-Saëns — `Danse macabre` | Night Shift | industrial breakbeat with orchestral hits |
| Tchaikovsky — `Dance of the Sugar Plum Fairy` | Night Shift or Pulse 94.6 | eerie breakbeat or stripped techno |
| Bach — Toccata and Fugue in D minor, BWV 565 | Pulse 94.6 | acid/techno motif treatment |
| Bach — Prelude in C major, BWV 846 | Pulse 94.6 | piano-house / hypnotic club arrangement |

## Recognition strategy

The radio should not be twenty novelty remixes of the most obvious classical hits.

For the 20-track MVP target:

- about 12 tracks should be recognition anchors built from broadly familiar motifs;
- about 8 may use less obvious public-domain works chosen because they fit the station better;
- no single composer should dominate a station;
- a source motif should be recognisable without requiring the entire original composition to be reproduced;
- different stations should not reuse the same source work unless there is a deliberate, user-approved reason.

## MIDI handoff contract

Canonical candidate MIDI files are Standard MIDI File type 1 where practical.

Expected baseline:

- 480 ticks per beat unless a track has a documented reason to differ;
- explicit conductor/meta track with title, tempo and time signature;
- meaningful track names; never `Track 1`, `Track 2`, etc.;
- source melody/motif material kept separate from ViceBlood drums, bass, pads, leads and FX guides;
- GM programs/percussion used only as portable placeholders;
- no SysEx, embedded proprietary plugin state or external sample dependency;
- proof-of-style sketches may be 45–90 seconds;
- production candidates target roughly 2:00–3:15 unless the arrangement benefits from a shorter form;
- clean ending/tail and clear section markers suitable for later editing;
- generated MIDI must open successfully in a standard parser before it is committed.

Each MIDI gets a sidecar manifest with at least:

- stable track ID;
- station ID;
- working title;
- source work/composer;
- source edition/catalogue and URL;
- provenance status;
- source licence/reuse terms and date checked;
- mandatory `attribution` object per `RADIO_MUSIC_ATTRIBUTION.md`, including ready-to-use player credit and any required/courtesy/internal source attribution;
- 1990s genre lane;
- BPM and approximate duration;
- MIDI track list;
- arrangement notes;
- generation/validation status;
- user review state;
- file SHA-256 when practical.

A candidate cannot be promoted to `daw-candidate` while required provenance or attribution fields are unresolved.

## Repository locations

During this PR, MIDI workbench outputs belong under:

`phaser/assets/audio/radio-midi/<station-id>/`

A candidate normally has:

- `<track-id>.mid`
- `<track-id>.json`
- optional `<track-id>-notes.md` only when the arrangement needs human-readable production notes.

Final rendered `.ogg`/`.mp3` assets are **not** part of this composition PR. When runtime audio integration happens later, it should follow the catalogue and attribution conventions established by PR #44 if that contract has landed.

## Relationship to neighboring audio work

- PR #44 is the general sound-catalogue / attribution-ledger initiative. This PR does not replace its runtime sound-event contract.
- PR #58 establishes the public-domain-score provenance pattern for the Satie main-theme source. This initiative follows the same conservative separation between composition rights, source-score provenance and independently produced arrangement assets.
- Car-radio playback logic, station selection UI, persistence, spatialization, volume ducking and streaming are explicitly outside this PR.

## User review philosophy

Objective validation can prove that a MIDI is parseable, properly structured, provenance-complete and attribution-complete. It cannot prove that a groove feels right.

The agent should therefore work autonomously through bounded production batches, then stop at the roadmap's explicit listening gates with direct links to the generated MIDI files and a compact audition checklist. The user can then edit accepted MIDI files in a DAW or request a revised arrangement before the catalogue expands.
