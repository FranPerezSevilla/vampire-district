# Ordinary buildings: night-city material kit

## Bounded implementation

Authority: BuildingParallax owns the existing roof/facade projection; BuildingMaterialImages owns resident material composition and disposal. Add an OrdinaryBuildingMaterials kit for ordinary housing, commercial and industrial volumes using authored raster modules.

Files: new facade/roof image atlases in phaser/assets/architecture, OrdinaryBuildingMaterials.js, BuildingMaterialImages.js, BuildingParallax.js, GameScene preload, focused tests and this document.

Acceptance: a representative block around tenementNorth / shops / marketBlock reads as dark masonry, recessed crisp windows with selective warm interiors, inhabited ground floors and articulated roofs. Modules retain consistent world scale and fit narrow buildings; materials are composed only at cache creation, retained/released with the existing budget. Inspect real-game screenshots and measure a camera traversal before/after.

Non-goals: no new building simulation, collisions, city footprints, storey heights, landmark art, car/actor changes, global light engine or full-building sprite stacking. Authored atlases provide visual detail; code only lays out/crops reusable modules on existing surfaces.

User addition: rooftop equipment must be independent objects with roof-relative bases, their own height, material faces and the shared city projection, ready for subsequent rooftop gameplay. RooftopObjects owns the visual modules and BuildingParallax owns their residency/disposal. Do not bake equipment into the roof. Add frontal/lateral/rear live sliders to the existing debug perspective panel; CityPerspective remains the single projection authority for buildings, rooftop modules and street props. Cars remain independent. Preserve continuous, shared affine projection at every attachment seam. Sliders must update a stationary scene, isolate game controls, reset and clean up on shutdown. Validate roof attachment vertices at extremes and resource reuse during movement.

## Validation

Use affected plan/runner; focused native geometry/cache tests plus production browser boot, representative block, side/rear facades, narrow buildings, camera traversal, atlas memory and cache cleanup. Existing broad-branch failures remain separately reported.

## Assets and prompts

Built-in image_gen through the imagegen skill. Three original PNGs live in `phaser/assets/architecture`; full prompts, cell layout and crop notes are recorded in that directory's README.

## Implemented layout

Ordinary housing, shops/markets and industrial buildings share this kit. Landmark campuses, skyline towers and their authored attachments retain their existing art. The review block is `tenementNorth` (650,1280), `shops` (900,1320), `marketBlock` (260,1320); stand at (780,1524) to see the first two fronts.

Facade bays use the existing storey height in world units. There is one ground-floor entrance/storefront per front, blank masonry between some upper bays, and sparse warm interiors. Facade art is already exposed for night: skip the old second darkening pass. A shared soft light stamp adds spill during cache composition; window geometry stays sharp. Roofs use a repeated quiet membrane with fixed-width nine-sliced stone coping. No equipment is baked onto these roofs.

### Rooftop objects

`RooftopObjects.js` defines ventilation units, chimneys and access enclosures as independent scene objects. Each has a stable id, building id, world footprint, roof elevation (`base`) and physical height. Its top and upright faces sample one shared authored atlas. Five surfaces per object, back-face culling, no sprite slices or per-object canvas/texture allocation. The access door appears only on its front. Foot vertices use exactly the same height-plane transform as the host roof.

An ordinary building may override the reusable placements with `roofObjects: [{id, kind, u, v, width, depth, height}]`; u/v are normalized roof positions and dimensions are metres. `roofObjects: []` leaves a clear roof. Placement keeps a parapet margin and rejects overlapping equipment. This is presentation metadata for future rooftop encounters; equipment collision, cover, interaction and roof-layer gameplay are not implemented by this art pass.

BuildingParallax controls active/dormant residency and destroys equipment when its host cache is evicted. Existing dormant limits remain 12 buildings / 32 MiB of composed materials. Source atlases are shared, approximately 18 MiB decoded total (three 1254-square textures).

### Perspective controls

The lower-left debug panel adds Frontal / Lateral / Trasero from 0–250%, plus the independent car volume control and a reset button. Changes apply live without moving the camera. 100% preserves the previous city view; all three at 0% give the orthographic footprint. Opposing north/south projection anchors preserve one affine field, so attached roofs, walls, equipment and street furniture share their projected vertices. The rear anchor stays behind the zero-lean point even at close zoom. No landmark approach trigger is restored. Cars retain their own projection.
