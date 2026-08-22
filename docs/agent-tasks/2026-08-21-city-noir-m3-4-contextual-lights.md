# M3.4 — Contextual practical-light families

Branch: `agent/city-noir-atmosphere`  
Initiative: `city-noir-atmosphere`  
Parent roadmap: `docs/roadmaps/CITY_NOIR_ATMOSPHERE_ROADMAP.md`

## Goal

Extend the presentation-only practical-light pass so building semantics create a small number of recognizable night-light accents without changing city topology, gameplay visibility, stealth, AI, missions, collision, navigation or the street-surface authority from PR #69.

The city must remain predominantly dark. Warm amber remains the default city light language. Contextual families are rare accents, never area-wide colour grading.

## Execution checklist

### M3.4.1 — Generalize the descriptor/render model

- [x] Expand `PRACTICAL_LIGHT_FAMILIES` without changing existing `warm-street` / `warm-frontage` output semantics.
- [x] Make frontage geometry/style selection reusable rather than duplicating a second renderer per family.
- [x] Preserve deterministic hashing and render-window culling.
- [x] Preserve the existing crosswalk presentation seam and presentation-only ownership.
- [x] Prevent contextual landmark families from also receiving generic warm-frontage spill.

### M3.4.2 — Cool civic / institutional accents

- [x] Add `cool-civic` family.
- [x] Restrict it to `police`, `medical`, plus explicit `cityHall` landmark identity.
- [x] Keep church/cathedral out rather than guessing civic semantics.
- [x] Use restrained desaturated cool-white / blue-grey spill.
- [x] Keep source count small and local to frontage/access points.

### M3.4.3 — Nightlife accents

- [x] Add `nightlife-accent` family.
- [x] Restrict it to the existing `club` profile.
- [x] Use wine/magenta-red rather than saturated cyberpunk pink.
- [x] Keep the spill compact and tied to the frontage source.

### M3.4.4 — Industrial dirty light

- [x] Add `industrial-dirty` family.
- [x] Restrict it to `industrial` / `warehouse` semantics.
- [x] Use existing `serviceStrip` semantics as presentation permission.
- [x] Use dirty sodium/olive-amber, smaller and weaker than nightlife/civic accents.
- [x] Keep deterministic sparse selection so most industrial façades remain dark.

### M3.4.5 — Focused automated tests

- [x] Determinism for every family.
- [x] No mutation of `buildings`, `lights` or visual-profile source data.
- [x] Family/profile allow-list enforcement.
- [x] Bounded span/depth and render-window culling.
- [x] Density restraint for industrial and generic warm frontages.
- [x] Family separation: contextual buildings do not also receive incompatible generic warm frontage.
- [x] Soft-falloff alpha remains bounded; no hard bullseye-outline regression.

Validation note: an initial industrial assertion incorrectly required every permitted industrial source to report literal `sourceKind=service-strip`; the implementation correctly allows an authored frontage edge while requiring service-strip semantics as permission. The test was corrected and the focused unit job passed on head `06d18d039c01f67eb3312329aff224279de28f3e`.

### M3.4.6 — Gameplay-scale browser evidence

- [x] `civic-cool.png`
- [x] `nightlife.png`
- [x] `industrial.png`
- [x] `mixed-families.png`

Dedicated review run `32468999890`, artifact `9441823514`, head `06d18d039c01f67eb3312329aff224279de28f3e` passed. Inspection accepted the contextual hierarchy: nightlife is the strongest special accent while civic/industrial stay restrained and darkness/warm amber remain dominant.

### M3.4.7 — Continuity/state update

- [x] Update `docs/progress/city-noir-atmosphere-status.json`.
- [x] Record validated evidence for M3.4.
- [x] Preserve PR #72 as draft and carry the next exact task forward.
- [x] Advance to M3.5 vehicle/emergency contribution; M3 itself remains open until M3.5 passes.

## Locked non-goals

Do not:
- change generated roads, sidewalks, buildings or light anchor placement;
- change AI/stealth/exposure/visibility logic;
- re-enable retired destructible-light gameplay;
- create a general-purpose lighting engine;
- add wet reflections in M3.4 (that belongs to M4);
- add broader signage/neon props (M7);
- introduce district-wide colour grading (M8).

## Stop / escalation rules

Continue autonomously while changes remain presentation-only and pass deterministic/focused validation. Stop for user intervention only if:
1. two materially different visual directions both satisfy the written canon and choosing between them is subjective;
2. implementation would require changing gameplay/topology authority;
3. a persistent CI failure cannot be resolved without changing unrelated systems;
4. the initiative reaches the M9 final user visual gate.

## Final M3.4 state

`complete` — contextual static practical-light families are implemented, focused-tested and visually validated. The initiative has moved on to M3.5.
