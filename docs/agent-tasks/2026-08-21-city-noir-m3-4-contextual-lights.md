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

Acceptance:
- existing warm tests remain valid;
- no new city/topology authority exists;
- no runtime gameplay state is mutated.

### M3.4.2 — Cool civic / institutional accents

- [x] Add `cool-civic` family.
- [x] Restrict it to real institutional semantics already present in the repository: `police`, `medical`, plus explicit `cityHall` landmark identity.
- [x] Keep church/cathedral out unless an existing semantic authority explicitly classifies it as civic; do not guess.
- [x] Use restrained desaturated cool-white / blue-grey spill.
- [x] Keep source count small and local to frontage/access points.

Acceptance:
- police/hospital/city hall can acquire a recognisable cold signature;
- cold light does not become the dominant street colour.

### M3.4.3 — Nightlife accents

- [x] Add `nightlife-accent` family.
- [x] Restrict it to the existing `club` profile.
- [x] Use wine/magenta-red rather than saturated cyberpunk pink.
- [x] Keep the spill compact and tied to the frontage source.

Acceptance:
- a club is recognisable at gameplay zoom;
- the city still reads noir rather than synthwave.

### M3.4.4 — Industrial dirty light

- [x] Add `industrial-dirty` family.
- [x] Restrict it to `industrial` / `warehouse` semantics.
- [x] Use the existing `serviceStrip` semantics as permission for presentation-only service lighting when authored frontage is `none`.
- [x] Use dirty sodium/olive-amber, smaller and weaker than nightlife/civic accents.
- [x] Keep deterministic sparse selection so most industrial façades remain dark.

Acceptance:
- industrial/service areas gain a functional signature;
- no decorative prop becomes gameplay state.

### M3.4.5 — Focused automated tests

- [ ] Determinism for every family.
- [ ] No mutation of `buildings`, `lights` or visual-profile source data.
- [ ] Family/profile allow-list enforcement.
- [ ] Bounded span/depth and render-window culling.
- [ ] Density restraint for industrial and generic warm frontages.
- [ ] Family separation: contextual buildings do not also receive incompatible generic warm frontage.
- [ ] Soft-falloff alpha remains bounded; no hard bullseye-outline regression.

Test coverage is authored in `tests/city-practical-light-presentation.test.js`; keep these boxes open until CI executes the suite successfully on the contextual-light head.

### M3.4.6 — Gameplay-scale browser evidence

Generate and upload at normal gameplay zoom:

- [ ] `civic-cool.png`
- [ ] `nightlife.png`
- [ ] `industrial.png`
- [ ] `mixed-families.png`

Each capture must show:
- player remains visible;
- roads/curbs/crosswalks remain readable;
- requested family is present in `scene.cityPracticalLightDescriptors`;
- no page errors;
- darkness remains the dominant broad-area value.

The dedicated review harness now discovers these targets from real generated building/light semantics; keep the boxes open until the workflow artifact is inspected.

### M3.4.7 — Continuity/state update

- [ ] Update `docs/progress/city-noir-atmosphere-status.json`.
- [ ] Append evidence to `docs/progress/CITY_NOIR_ATMOSPHERE_PROGRESS.md`.
- [ ] Update PR #72 description with actual validated state.
- [ ] Mark M3 complete only after focused tests and contextual browser evidence pass.

## Locked non-goals

Do not:
- change generated roads, sidewalks, buildings or light anchor placement;
- change AI/stealth/exposure/visibility logic;
- re-enable retired destructible-light gameplay;
- create a general-purpose lighting engine;
- add wet reflections in M3.4 (that belongs to M4);
- add signage/neon props beyond the tiny source marker needed for the light itself (M7 owns broader environmental storytelling);
- introduce district-wide colour grading (M8 owns district identity).

## Stop / escalation rules

Continue autonomously while changes remain presentation-only and pass deterministic/focused validation. Stop for user intervention only if:

1. two materially different visual directions both satisfy the written canon and choosing between them is subjective;
2. the implementation would require changing gameplay/topology authority;
3. a persistent CI failure cannot be resolved without changing unrelated systems;
4. the initiative reaches the final user visual gate defined by M9.

Until one of those conditions occurs, execute the checklist in order and record rejected experiments rather than hiding them.

## Current execution checkpoint

Implementation and review-harness authoring through M3.4.4 are complete on the branch. Focused/unit and dedicated browser validation are running before M3 can be closed.
