# Cathedral of the Last Dawn

## Goal

A large Gothic cathedral in Cathedral Hill, with an imposing exterior and a continuous walkable interior on the street layer.

## Authority and scope

- Shared authored plan: `phaser/src/data/cathedral-campus.js`; compiler composition in `tools/city-compiler/generate-road-topology.js` and a campus compiler.
- Canonical generated building records remain the sole collision/navigation/streaming authority. The interior uses actual wall, pier and furniture footprints, not a second collision system.
- Rendering: generated bitmap materials, cached ground, and the existing `BuildingParallax` / `BuildingMaterialImages` composition. Visual roof volumes derive from the same plan.
- Site: northeast cathedral block, approximately 560 × 432 world units, within the existing surrounding roads. No world expansion required.
- Interior: nave, crossing, choir and side chapels; open main and lateral entrances. Cutaway is presentation only and follows player position on street layer.

## Non-goals

- Sprite stacking, vehicle changes, new missions, new input bindings, a separate interior scene, save schema changes, traffic density or resolution changes.
- Publication or push.

## Acceptance

- Cathedral silhouette has two tall towers, a raised central nave, transepts and a choir, with coherent scale and Gothic materials.
- Roads and sidewalks retain clearance; compilation is repeatable.
- Walking through all three entrances and between nave, crossing and choir works; walls, columns and benches block movement.
- Roof withdraws on entry, restores on exit, and remains present on rooftop layers; movement/collision never depends on the cutaway.
- Generated roof traversal and maintenance access remain usable.
- Materials and lights cache once, offscreen geometry is culled, and no new simulation loop exists.

## Validation

Focused campus geometry, collision routes, cutaway and existing parallax tests; city validation/regeneration; packaged build; browser inspection of exterior/interior and actual walking; affected-test plan and relevant checks. Record results and any existing unrelated failures below.

## Assets

Generated with built-in imagegen. Final files and generation prompts recorded with the asset deliverables.

- [Runtime assets and prompts](../phaser/assets/cathedral/README.md): five original generated images, lossless WebP runtime copies with identical decoded pixels. Total runtime transfer 9.77 MB versus 14.63 MB PNG originals.
- Geometry uses the existing human/world scale: nave 22 m, towers 32 m plus 9 m spires. Three entrances, nave, crossing, choir and two side chapels; four existing church NPCs repositioned without adding population.
- Pitched roof planes share wall eaves and the existing camera transform. Four flying supports connect exterior piers to the upper nave.
- Entry/exit cutaway affects cathedral presentation only, fades in roughly half a second and uses a 7-unit exit margin to avoid threshold flicker. Floor, piers and furniture are baked once into a cached 1120 × 864 ground image. The canonical wall/furniture records stay solid regardless of opacity.

## Verification — 2026-09-18

- Focused cathedral/parallax/attached-volume/lighting/other-campus tests: 35/35 pass. Pavement integration checks: 2/2 pass after extending the existing scene mock with the image API used by the cached ground stamp.
- City compiler: 0 errors, 0 warnings, grade A (87.8). Existing 4800 × 3600 bounds and road graph retained; affected chunks regenerated.
- Packaged build succeeds; browser suite coverage check passes (41 specs / 8 suites).
- Actual browser walking: front entry to choir, crossing to west exit and crossing to east exit all pass. Roof fades away inside and restores outside; no page errors. Exterior and interior visually reviewed.
- Short measurements on Chromium / Intel HD530, framebuffer 2160 × 1440, unchanged texture filtering, population and resolution: interior 299 frames over 5 seconds, mean 16.67 ms, p95 18 ms, max 18.4 ms. Walking east from the frontage for 6 seconds: mean 17.19 ms (~58 FPS), p95 18.2 ms, max 82.3 ms, four frames over 50 ms. The route leaves the cathedral block; this does not establish stable 60 FPS citywide.
- Full native suite at the first integration checkpoint: 1,255 tests, 1,210 pass, 45 fail. One new pavement mock mismatch was fixed and rechecked. Other failures include already tracked UI/city fixtures and a traffic search fairness assertion; the latter was reproduced against an isolated archive of the pre-cathedral HEAD. No claim that the full suite is green. The 32-spec browser plan from the accumulated branch diff was not run after the native gate failed; custom browser checks above are additional focused coverage.
- Affected-test plan reviewed. The Windows selector stops at its `npm test` launch; the native suite and city checks above were run directly.
- No commit or push in this task.

### Location

Cathedral Hill, northeast of the city, east of the police precinct. Main entrance at **3916, 602**; forecourt at **3916, 650**. Walk through the arch to enter; no interaction key or scene load.
