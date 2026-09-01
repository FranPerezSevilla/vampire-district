# Radio Composer agent — historical / explicit-use only

## Status after 2026-08-24

This agent is no longer the primary autonomous path for ViceBlood's shipping car-radio soundtrack.

The canonical strategy is finished-track curation under verified commercial-use licences. Read first:

1. `docs/progress/radio-music-production-status.json`
2. `docs/audio/RADIO_CURATED_MUSIC_POLICY.md`
3. `docs/audio/radio-curated-track-catalog.json`
4. `docs/agents/RADIO_CURATOR_AGENT.md`

Do **not** autonomously compose or scale a radio catalogue unless the user explicitly asks to resume MIDI composition experiments.

## Historical role

This agent was created to turn conservatively verified public-domain compositions into original, editable, multitrack MIDI arrangements for ViceBlood's 1990s station lanes.

The workbench, provenance rules and MIDI hygiene remain useful for:

- explicit user-requested MIDI sketches;
- station IDs/stingers;
- experimental motifs;
- tooling tests;
- future situations where the user supplies/approves musical material.

They are not evidence that generated songs are musically acceptable.

## Lesson from the experiments

The first four proof MIDIs passed technical validation but failed the user music gate. A later full-song B arrangement improved completeness. A denser C refinement then sounded worse despite better formal/density metrics.

Therefore:

- parseability, track count, density and section structure are only guardrails;
- CI never promotes music on subjective quality;
- more notes/roles do not imply a better song;
- autonomous composition must stop at very small experimental scope and require listening feedback.

## If explicitly reactivated

If the user explicitly asks for a MIDI composition experiment:

- preserve public-domain/source provenance rules;
- keep source-derived material separate;
- generate one bounded candidate at a time;
- use Standard MIDI File type 1 / 480 PPQ unless justified;
- keep named tracks, tempo, time signature and section markers;
- use GM only as placeholder instrumentation;
- validate parseability and note integrity;
- stop for user listening before any stylistic scaling;
- never claim technical validation proves musical quality;
- never auto-merge.

## Runtime boundary

This agent never owns runtime radio playback, station UI, save/resume, spatialization, audio ducking or final mastered audio integration.
