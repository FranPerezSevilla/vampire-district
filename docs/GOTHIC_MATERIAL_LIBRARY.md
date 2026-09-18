# Gothic punk material library — September 2026

## Scope

Citywide asphalt, sidewalk slabs and pedestrian cobbles share the same world-aligned image materials, including irregular polygon junctions. Building geometry, collisions, navigation and parallax controls are unchanged. The hospital introduces reusable textured lancets, entrance, corner shafts and slate pinnacles through the institutional architecture profile.

## Assets

Eight 512 × 512 WebP assets in `phaser/assets/materials/`, totaling approximately 0.9 MiB:

- `asphalt-gothic-v1`, `slab-gothic-v1`, `cobble-gothic-v1`, `stone-gothic-v1`.
- `lancet-dark-v1`, `lancet-warm-v1`, `portal-gothic-v1`, `slate-gothic-v1`.

Generated with the integrated image generator from two four-quadrant atlases. Each quadrant was exported at 512 px without changing the original image. Ground atlas generation: `exec-13d934af-91ec-4726-be83-30d24d465195`; architecture atlas: `exec-f744aa49-c73a-42a2-8c3e-937f9058ed8c`. The approved art direction is a 1990s urban gothic hospital, dark weathered masonry, restrained amber glazing and small worn paving, not a neon or medieval setting.

## Rendering and cost

`MaterialTiles` prepares mirrored tile images once per scene/material. Paving stays world-aligned and is drawn into the existing static street render texture, not regenerated every frame. Polygon junctions rasterize only their clipped bounding box on a sector refresh; scratch textures are removed after drawing. Mirroring can produce occasional symmetrical marks, but closes the tile borders.

`BuildingMaterialImages` bakes window frames, masonry, warm bloom and real hospital lettering into resident facade textures. Institutional facades are capped at 1024 × 384. Turret stone and slate textures are shared, while their reusable meshes follow the existing camera projection. Per-building meshes and images are disposed when leaving the resident set; shared turret images are disposed with the renderer.

This adds detail without per-stone scene objects or per-window dynamic lights. First-time sector rasterization and moving-facade mesh submission still have a cost. Browser smoke checks are not a guarantee of a particular FPS on the user's machine.

## Verification

Focused geometry, facade, paving and city-surface tests; packaged build; browser boot and hospital camera checks. Existing unrelated working-tree changes are preserved.
