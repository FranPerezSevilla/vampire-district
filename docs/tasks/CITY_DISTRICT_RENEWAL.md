# City district renewal — 20 September 2026

## Goal
Extend the approved West Market language to all fourteen districts, with authored public spaces, coherent street fronts, appropriate roofs and restrained district furniture.

## Authority and scope
- Road graph and city compiler remain the only source of roads, footprints, pedestrian surfaces and streamed geometry.
- New authored district block definitions and compiler pass, composed after existing landmark campuses and West Market. Preserve accepted campuses, campaign anchors and traffic network.
- Existing OrdinaryBlockProfiles/Architecture/Roofs and RooftopObjects own architectural presentation. Extend their reusable recipes and shared bitmap atlases; no second renderer or simulation loop.
- ProjectedStreetLamps owns existing shared street furniture presentation; integrate bounded district decor there.
- Authored raster artwork via imagegen, provenance alongside assets. Quiet black masses, crisp openings, sparse warm light; no procedural texture noise.
- User follow-up includes replacing Vesper, police and cathedral facade materials while retaining their existing geometry and entrances.

## Sequence
1. Measure present road connectivity, district coverage and available parcels; record before map and explicit urban diagnosis.
2. Author connected courts/frontages/service yards per district, reserve them against infill and reconcile entrances/roof access.
3. Apply appropriate architectural families and roof forms; generate shared sheets only for missing families.
4. Add sparse purpose-placed street/rooftop objects, keeping circulation clear and presentation culled.
5. Regenerate through existing compiler/streaming, validate geometry and walkability, build and review every district in game. Record runtime resource/performance observations.

## Non-goals
New missions, faction rules, water/boat simulation, new interiors, traffic population changes, changes to accepted cars/characters or parallax settings. No commit, push or deployment requested. Do not claim proposed atlas landmarks are playable interiors.

## Acceptance
- [x] All 14 districts covered by an explicit urban/art decision, including preservation of West Market and landmark campuses.
- [x] Roads remain connected; no new building/road or unintended building/building overlap; courts have usable exits and doors face open space.
- [x] Source regeneration idempotent; source and generated streaming agree.
- [x] Quiet, distinguishable art families and roof silhouettes with shared assets; rooftop props have physical support and independent parallax.
- [x] No per-frame texture baking, unbounded asset growth or new city-wide simulation. Resident decor has visibility retention/eviction; existing material budget retained. See measured limits in the result document.
- [x] Focused native checks, city validation and actual browser review; report full-suite limitations separately.

## Validation
Review affected-test plan and attempt affected runner. Add direct native checks for authored layouts, navigation and architectural recipes; use production browser walkthrough for each district. Previous unrelated full-suite failures and Windows npm child-runner limitation remain documented in earlier task records.

## Status
Implemented: 14 plans, 102 authored volumes, 75 public surfaces, 48 sparse decor anchors, six new shared facade recipes, industrial roof forms and three landmark facade adaptations. No world expansion. Seven ImageGen masters with lossless transport copies. 75 focused tests pass; city validation 0 errors/0 warnings; 82 generated files reproduce byte-for-byte. Browser captures of all districts and final keyboard traversal pass. Full affected runner retains the Windows child-process limitation. Performance is not certified at 60 FPS.

Results, per-district decisions, saved assets/prompts, evidence and measured limits: [CITY_DISTRICT_RENEWAL.md](../art-direction/CITY_DISTRICT_RENEWAL.md).
