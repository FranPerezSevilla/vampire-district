# M1.4 revision checkpoint — song completeness

## User verdict on M1.3

Date: 2026-08-24.

The user rejected the four M1.3 proof arrangements as a set.

Direct musical diagnosis captured:

- “en general son muy malos todos”;
- the problem is not only cheap General MIDI sound;
- the arrangements are musically `meh`;
- there are too many empty spaces;
- there is too little sound/content;
- they do not feel like complete songs.

This verdict is authoritative. The M1.3 A candidates are technically valid but musically rejected.

## Root cause

The first composition contract optimized too heavily for short proof sketches and genre devices such as sparsity/negative space. The resulting MIDIs demonstrated motif + beat + provenance but underdeveloped:

- full-song form;
- simultaneous musical roles;
- secondary hooks;
- bass variation;
- harmonic continuity;
- fills and transitions;
- evolved return sections.

Passing CI was mistakenly allowed to look like progress toward musical acceptance. That boundary is now explicit.

## New quality authority

Mandatory contract:

`docs/audio/RADIO_SONG_COMPLETENESS_CONTRACT.md`

Specialist agent:

`docs/agents/RADIO_ARRANGER_AGENT.md`

Roadmap override:

`docs/roadmaps/RADIO_MUSIC_PRODUCTION_REVISION_2026-08-24.md`

## First revision pilot

Candidate: `maple-leaf-gfunk-b`

Station: Vice FM.

Source/provenance remains Scott Joplin, *Maple Leaf Rag*, John Stark & Son first edition (1899), IMSLP #270188, Public Domain. No rights boundary changes are required.

Arrangement target:

- 96 BPM;
- 56 bars / roughly 2:20;
- 4-bar intro;
- 12-bar A1;
- 8-bar A2 variation;
- 12-bar B section;
- 4-bar breakdown that remains musically filled;
- 12-bar A-prime / peak;
- 4-bar outro;
- source motif used as a hook, not as continuous accompaniment;
- original G-funk second hook/call-response;
- continuous drums, bass and harmonic support after the intro;
- fills at meaningful phrase boundaries;
- roughly 8–11 editable musical tracks rather than a 5-track sketch.

The development handoff should report simple density evidence, but metrics do not replace listening judgment.

## Gate

Exact production sequence:

1. generate deterministic `maple-leaf-gfunk-b` recipe and manifest;
2. validate MIDI structure/provenance/attribution;
3. set `user-validation-pending` for this one pilot;
4. stop;
5. only if the user says the B pilot is materially better, proceed to M1.5 and rebuild the remaining stations.

Do not count any M1.3 A proof toward M3/M4 accepted-track totals.
