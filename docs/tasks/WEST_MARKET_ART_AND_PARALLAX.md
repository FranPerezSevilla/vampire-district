# West Market art rollout and classic parallax

## Goal

Apply the accepted quiet gothic-punk facade/roof language to all eleven West Market volumes. Restore radial camera-relative parallax with two independent, wide-range axis controls.

## Authority / intended files

- Presentation recipes: OrdinaryBlockProfiles, OrdinaryBlockArchitecture, OrdinaryBlockRoofs; shared authored atlas registered in GameScene and documented in the asset README.
- Shared height-plane projection: CityPerspective, BuildingParallax, rooftop objects, projected lights/props and VehiclePerspectiveControls.
- Focused geometry/control tests, actual production review and handoff.

## Acceptance

- Existing market / tenement / shop designs retained; new residential/service variants fit their physical bay widths and entrance orientations.
- Every pilot volume receives an appropriate roof; small wings do not gain oversized equipment or duplicate dormers.
- No frontal bias / proximity effect. Equal offsets north/south and east/west produce equal/opposite displacement, and connected surfaces stay joined.
- North–south and east–west sliders respond independently from zero to an experimental 2000% of classic strength; reset returns to 100%. Cars retain their separate control.
- Changing controls does not rebake textures or introduce a new runtime loop.
- Inspect street, side/rear views and slider extremes in the actual game.

## Non-goals

No changes to city footprints, collision, roads, traffic, population, vehicle art/behaviour or new rooftop physics. No commit/push.

## Validation

Focused native geometry, shared projection, facade/roof layout, controls and art cache tests; production browser boot, all pilot buildings, extreme sliders and reset. Review affected plan/runner. Existing broad-suite failures from the layout pass stay separately recorded.

## Result — 2026-09-20

- Applied the accepted art kit to all eleven West Market volumes. Existing tenement/market/shop recipes remain; the market wing uses matching masonry and a simpler zinc roof. Courtyard housing uses mansards or compact zinc covers, warehouse uses a raised skylight, workshop has a low zinc roof.
- Added one authored atlas, `west-market-facades-v1.png`, for courtyard homes, the warehouse and workshop. 1254 × 1254; 2,188,893 bytes on disk, 6,290,064 bytes decoded RGBA. Exact prompt/provenance: `phaser/assets/architecture/west-market-facades-v1.md`.
- Modular crops keep a single central entrance and readable bay widths. Primary elevations and independent dormers follow the authored entrance side, including north/east/west-facing courtyard fronts. Dormers reserve space from roof equipment.
- Classic radial city projection restored. Two axes 0–2000%; 100% matches the former classic 4/4 axis strengths within its stable viewport envelope. No front bias or entrance/proximity effect. Cars retain their existing independent projection. Roofs, attachments and props share the height-plane formula.
- Experimental slider maxima no longer inflate ordinary culling margins: bounds follow the selected gains. Warm material keys stayed unchanged through repeated slider changes. Eleven volumes now have 22 roof parts (the original three had seven); this is a scoped visual expansion, not a claimed performance optimization.

## Validation outcome

- Production build passes; preview `http://127.0.0.1:4174/`, current Python PID 18768.
- 59 focused native checks pass: projection symmetry/gain/continuity, seams, residency, lights, controls, facade/roof fit, existing West Market layout and vehicle independence.
- Production Chromium: six neighborhood views; every pilot volume has composed facade materials and roof parts; eight slider combinations up to 2000%, reset and warm cache reuse; no page errors.
- Three additional detail views at 400%, then actual hospital/police/Vesper resident sets at classic settings; no page errors. Screenshots/reports `docs/screenshots/west-market-art-*`.
- The six initial loop FPS snapshots rose from ~38 on first load to ~59 after warming. These are brief, non-controlled observations, not a 60 FPS guarantee or a before/after benchmark.
- Affected plan reviewed against origin/main (broad branch: 278 runtime files). Runner attempted, exits at Windows child `npm test` before selected suites start. Full branch validation is not green; previously documented broad-suite failures remain. No new city/compiler edits or generated fixture writes in this art pass.
- No commit/push.
