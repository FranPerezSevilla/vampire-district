# Radio music roadmap revision — 2026-08-24

This addendum supersedes the direct M1.3 -> M2 transition in `RADIO_MUSIC_PRODUCTION_ROADMAP.md` until the completeness revision is cleared.

## Trigger

The user listened to all four technically valid M1.3 proofs and rejected the set musically.

Primary feedback:

- all four were weak overall;
- too many empty spaces;
- too little sound / too few simultaneous musical ideas;
- they felt like sketches, not complete songs;
- cheap General MIDI sound was also present but explicitly **not the main problem**.

Therefore M1.3 proves tooling/provenance only. It does not prove the musical production method.

## M1.3 disposition

All four `*-a` candidates remain in the repository as rejected evidence:

- `chopin-prelude-04-boombap-a`;
- `maple-leaf-gfunk-a`;
- `mountain-king-bigbeat-a`;
- `bach-prelude-846-acid-a`.

They do not count toward accepted catalogue totals.

## M1.4 — complete-song pilot

Purpose: prove that the agent can arrange one genuinely complete radio instrumental before rebuilding four stations.

First pilot:

`maple-leaf-gfunk-b`

Why Vice FM first: a mid-90s G-funk instrumental has a clear continuous groove, harmonic bed, bass movement and second-hook vocabulary, so it is a strong diagnostic for the exact sparsity/completeness failure.

B target:

- approximately 2:00–2:30;
- short intro and outro;
- real A/B development plus a short breakdown and evolved return;
- continuous rhythm/bass/harmonic foundation through core sections;
- source hook plus an original secondary hook/call-response device;
- fills and transitions at phrase boundaries;
- editable multitrack MIDI with no third-party audio dependency;
- full attribution/provenance preserved.

GitHub Tests #2263 validated the B implementation technically.

### B user verdict

The user judged B **materially better** than the rejected A sketches, so the new complete-song bar is useful.

However B is **not** the accepted Vice FM station reference. The user immediately refined the desired style:

> more hip-hop and more funk

Therefore B remains `userReview: revise`.

### M1.4C — Vice FM style refinement

Active candidate:

`maple-leaf-gfunk-c`

The C revision keeps the complete-song bar but changes the station priority:

1. hip-hop drum groove;
2. syncopated funk bass and riffs;
3. G-funk / public-domain hook identity;
4. harmonic color.

C must reduce soundtrack-like pad weight and make the song survive musically on drums + bass + funk comping even when the lead/source hook is muted.

Target C:

- about 2:10–2:20;
- stronger kick/snare backbeat and swing;
- more ghost-note detail;
- busier funk bass with pickups;
- continuous clavinet + muted-guitar comping;
- Rhodes as shorter hip-hop stabs rather than a broad bed;
- G-funk mono lead as a clear secondary hook;
- no cinematic string pad as the primary glue;
- short funk horn punctuation rather than orchestral brass beds;
- Joplin source material as recurring sample-like fragments;
- no third-party audio dependency;
- full attribution/provenance preserved.

**User gate:** after C is technically green, stop. The user decides whether this is the correct Vice FM hip-hop/funk direction. Do not rebuild the other three stations before that decision.

## M1.5 — rebuild the proof set

Only after M1.4C user approval:

- rebuild Blood City Beats as a complete song;
- retain the user-approved Vice FM reference (C or a later revision);
- rebuild Night Shift as a complete song;
- rebuild Pulse 94.6 as a complete song;
- stop for a four-station listening pass.

Exit gate: all four station directions are musically acceptable enough to canonize.

## M2 onward

M2 station grammar canonization remains blocked until M1.5 passes. M3/M4 counts may include only accepted `daw-candidate` or explicitly approved proof material, never the rejected M1.3 A set.

## Mandatory quality contract

All work from M1.4 onward must obey:

`docs/audio/RADIO_SONG_COMPLETENESS_CONTRACT.md`

The arrangement specialist is:

`docs/agents/RADIO_ARRANGER_AGENT.md`
