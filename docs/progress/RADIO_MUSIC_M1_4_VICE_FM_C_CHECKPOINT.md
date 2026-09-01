# M1.4 Vice FM style refinement — Hip-Hop / Funk C

## User verdict on B

Date: 2026-08-24.

The user confirmed that `maple-leaf-gfunk-b` is materially better than the rejected M1.3 sketches because it finally feels more like a complete song.

The user then refined the Vice FM direction:

> more hip-hop and more funk

This means B proves the **song-completeness bar**, but it is not yet the accepted Vice FM style reference.

## Canonical Vice FM emphasis

Until superseded by later user feedback, Vice FM should prioritize:

1. **hip-hop drum groove** — strong kick/snare backbeat, swing, ghost notes and phrase fills;
2. **funk bass and rhythmic riffs** — syncopated bass, clavinet/muted-guitar conversation and clear pocket;
3. **hook identity** — G-funk mono lead and public-domain source fragments used as memorable hooks;
4. **harmonic color** — Rhodes/organ support, but not broad cinematic pads carrying the track.

Operational test:

> If the lead and source hook are temporarily muted, drums + bass + funk comping should still feel like a convincing 1990s hip-hop/funk instrumental.

Avoid making Vice FM read primarily as cinematic soundtrack, generic funk-jazz, or orchestral game score.

## C revision

Candidate:

`maple-leaf-gfunk-c`

Source/provenance remains Scott Joplin, *Maple Leaf Rag*, John Stark & Son first edition (1899), IMSLP #270188, Public Domain. Rights/attribution are unchanged and no third-party audio is introduced.

Arrangement:

- 94 BPM;
- 52 bars / ~2:13;
- 11 musical tracks + conductor;
- intro -> Verse A -> Hook A -> Verse B -> Funk Break -> Hook B/Peak -> outro;
- stronger layered hip-hop kick/snare pocket;
- more ghost-note and swing detail;
- busier syncopated funk bass with pickups;
- continuous clavinet and muted-guitar conversation;
- Rhodes changed from broad bed to shorter hip-hop stabs;
- G-funk mono lead moved forward as the original secondary hook;
- cinematic low strings/pad removed;
- brass reduced to short funk horn punctuation;
- Joplin motif shortened into sample-like recurring fragments.

Measured role-density guardrail:

- core minimum active musical roles: 5;
- core average: 6.9;
- peak: 9;
- core bars below 4 roles: 0.

These metrics only prove the arrangement is not accidentally empty; they do not prove musical quality.

## Gate

Exact next sequence:

1. validate the C deterministic recipe, manifest, provenance and completeness metadata in CI;
2. set `user-validation-pending`;
3. let the user listen to C;
4. do not rebuild the other stations until the user accepts or further refines the Vice FM direction.

B remains historical evidence with `userReview: revise`.
