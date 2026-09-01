# Radio song completeness contract

## Why this exists

The first M1.3 proof set passed technical validation but failed the user listening gate. The user judged all four arrangements as musically weak: too many empty spaces, too little simultaneous musical content, and more like sketches than complete songs. General MIDI timbre was a secondary problem, not the main failure.

This contract is a mandatory quality override for all radio composition work after 2026-08-24.

## Core principle

A radio candidate must be a **complete instrumental song first** and a public-domain remix second.

A recognisable motif plus a beat is not sufficient. A sparse loop is not sufficient. Passing MIDI/provenance CI is not evidence of musical acceptance.

## Form requirement

New proof/revision candidates normally target **2:00–2:45** before DAW production.

Before writing MIDI, define a section map. The default full-song pilot shape is:

- short intro: 2–4 bars;
- A section: 8–16 bars;
- A variation or pre-B: 4–8 bars;
- B section / second hook: 8–16 bars;
- short breakdown: 2–4 bars;
- A-prime / peak return: 8–16 bars;
- short outro: 2–4 bars.

Sections must change musical information: instrumentation, bass behavior, hook treatment, harmony, rhythm, counterline or intensity. Repeating one 4-bar loop for two minutes does not satisfy the contract.

## Density requirement

Negative space is allowed only as an intentional contrast device.

After the intro, normal core sections should contain at least these roles:

1. rhythm foundation;
2. bass;
3. harmonic or riff support;
4. hook/melodic identity or a deliberate substitute role.

A strong section should normally have **5–8 audible roles**, including percussion/secondary rhythm, counterline, pad, stabs, lead or texture as appropriate to the station.

Rules:

- no long unexplained gaps in drums, bass or harmony;
- a breakdown may reduce density, but must still sound intentionally musical rather than unfinished;
- no core section should spend more than one consecutive bar with fewer than three musical roles unless the arrangement explicitly documents why;
- peak sections should add information instead of merely playing the same loop louder;
- intro/outro may be thinner, but should still establish or resolve the song.

These are guardrails, not a substitute for listening judgment.

## Development requirement

Every candidate needs at least:

- one primary hook;
- one secondary hook, counterline, call/response idea or clearly different B-section device;
- bass variation across sections;
- drum fills/turnarounds at meaningful 4/8-bar boundaries;
- at least one harmonic or voicing variation;
- at least one deliberately arranged breakdown/build/return transition;
- a recognisable ending rather than an arbitrary MIDI stop.

The public-domain source may supply the primary hook, but ViceBlood must supply enough original arrangement material to make the track a song.

## 1990s production rule

Density does not mean modern maximalism. Keep the approved 1990s grammar, but use the full vocabulary of that grammar: layered drums/percussion, bass movement, keys/guitar-style chops, pads, brass/stabs, mono leads, call/response, fills and section changes.

Do not solve sparsity with modern trap rolls, supersaws, festival drops or contemporary EDM layering.

## MIDI handoff expectation

A full-song candidate should normally expose separate editable tracks for:

- source-derived motif/melody;
- drums;
- secondary percussion where useful;
- bass;
- harmonic bed;
- rhythmic comping/riff layer;
- lead or secondary hook;
- counterline or pad;
- transition/FX guides.

Track count is not a score. Ten empty tracks are still an empty arrangement.

## Listening gate

Technical validation answers: “is the MIDI structurally valid and legally traceable?”

The user listening gate answers: “does this actually sound like a complete song I would accept on a car radio?”

A candidate rejected at the listening gate stays explicit as `status: rejected`, `userReview: revise`. Never silently promote or count it toward catalogue targets.
