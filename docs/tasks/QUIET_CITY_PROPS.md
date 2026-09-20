# Quiet city furniture materials

## Goal

Bring street furniture, cathedral furnishings and rooftop equipment into the accepted quiet near-black West Market style: clear forms, sparse edge wear and light as the color accent.

## In scope

- Authority: PropSpriteStack and RooftopObjects keep existing shared meshes/projection. StackMaterialAtlas owns the single prepared prop atlas; GameScene preloads raster sources.
- Edit authored sibling versions of gothic-street-atlas and ordinary-rooftop-objects with ImageGen. Update crop/loader references only where output requires it.
- Street lamps, benches, intact/broken dumpsters, fences, cathedral piers/pews/altar/candles, ventilation/chimney/access rooftop units.
- Review all active furniture paths for source/tint differences. Adjust shared material tints only if needed for consistent exposure.

## Out of scope

No simulation, collision, footprint, city layout, character/car appearance, light engine, projection parameters or new render pass. Preserve existing user changes. No commit/push.

## Acceptance

- Quiet charcoal iron/stone, dark timber, minimal rust/grain/speckling, crisp edges and readable warm lantern/candle glass.
- All requested active WebGL prop types use the new shared art; cuts, transparency and broken-dumpster state remain correct.
- Rooftop objects match dark roofs instead of looking like shiny noisy grey patches.
- No increase in shared live atlas count, prepared geometry, per-frame draw calls or filter passes. Inspect memory dimensions and texture preparation.
- Compare actual street/cathedral/roof views before and after at identical positions and settings; confirm ordinary and exaggerated axis values still attach objects correctly.

## Validation

Review affected plan/runner. Existing focused prop packing, geometry, light, cathedral and projection checks; production build and actual browser comparison. No new tests merely mirroring image-key substitutions. Broader branch failures remain recorded separately.

## Result — 2026-09-20

Integrated two ImageGen-authored sibling revisions:

- `phaser/assets/props/gothic-street-atlas-v2.png`: smoother blackened iron, subdued dark timber/green paint, quieter charcoal stone, clean candle/lantern emission. Used by street lamps, hospital bench, dumpsters (intact/broken), fences and all stacked cathedral furnishings. Altar cloth tint 0x9da5ad reduces its excessive brightness without dimming candles.
- `phaser/assets/architecture/ordinary-rooftop-objects-v2.png`: quieter ventilation units, chimneys and access huts, with crisp grille/slat/door structure. Replaces v1 rather than adding another loaded sheet.
- Both retain 1254 × 1254 dimensions and the existing UV contracts. Props retain alpha silhouettes/holes (mask IoU ~98.5%, mostly edge changes). No mesh, footprint, scene loop or projection change. Characters/cars and the accepted building/floor textures remain as before.
- Normal WebGL uses the new sheets everywhere. Existing non-WebGL fallback images remain unchanged; this pass targets the active stacked-prop and roof-object paths.

## Cost and evidence

- Source PNGs together: 5,172,656 → 4,200,742 bytes (~18.8% smaller). This is a download/storage reduction, not a claim of higher FPS.
- Same single packed prop texture, 1024 × 2048 / 16 frames / ~10.67 MiB including mipmaps. Unpacked source released after preparation. Same rooftop source dimensions (~6 MiB RGBA); only v2 loaded. No additional draw passes or runtime image filters.
- Prop counts / prepared quads match at all six comparison positions: 117/2761, 124/3223, 124/3223, 124/3223, 129/3397, 131/3559. Roof-object geometry remains five faces per object. Total resident roof/material cache counts differ between runs due to streaming and cache timing; do not claim identical total scene memory from these samples.
- Before/candidate/production-after screenshots and reports: `docs/screenshots/quiet-props-*`. Same requested camera positions/settings; the normal camera system continues to govern game zoom. Includes hospital bench, police lamps/fences, cathedral nave/altar, West Market roofs, intact and broken dumpster.
- Final production review: zero page errors, correct v2 source requests, old roof source absent, temporary prop source released, sliders 0/2000% on each axis and combined work. Final altar exposure inspected after tint adjustment.

## Validation and handoff

- Production build and 40 focused native checks pass. Existing cathedral seam assertion updated from exact object equality to 1e-8 coordinate tolerance: equivalent sums differed by ~4.5e-13 with the newly restored classic projection; no roof geometry changed.
- Affected plan reviewed against origin/main; runner attempted and again stops at Windows child `npm test`, before its broader suites start. Full branch checks are not declared green; earlier unrelated failures remain documented in the prior tasks.
- Exact prompts and source provenance: `phaser/assets/props/gothic-street-atlas-v2.md`, `phaser/assets/architecture/ordinary-rooftop-objects-v2.md`. Built-in ImageGen, no CLI fallback.
- Preview rebuilt at `http://127.0.0.1:4174/`, Python PID 16940. No commit/push. Work complete pending visual feedback.
