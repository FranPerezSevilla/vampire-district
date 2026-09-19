# Fleet horizontal sections

`fleet-stack.svg` is the active shared atlas: 32 authored cells of 48 × 28 units, with a pivot at (24,14) and the nose pointing right. It rasterises once at 8 pixels per atlas unit (1536 × 1792, 10.5 MiB RGBA). All 21 archetypes reuse it; no per-car or per-palette baking is performed. `VehicleStackModels.js` assembles family silhouettes once per archetype with the original physical width/height. Culling includes each model's highest section at the maximum car slider setting.

Shared parts include body sections, glasshouse, commercial compartments, roof vents, pickup bed, taxi sign, police markings, emergency lightbar and medical emblems. Body, bonnet, tyres and trim continue to use existing damage handles. Bus route text retains the existing routeBadge contract and is positioned on the projected roof. Car projection uses only the camera and car slider, never landmark state. Canvas/missing-atlas renderers keep the legacy fallback.

## Historical sedan pilot

`sedan-stack.svg` is an authored vector atlas, not a generated per-car texture. It keeps the original sedan's 34 × 16 world-unit footprint. Its 15 cells are 48 × 28, with a shared pivot at (24, 14) and the nose pointing right.

The loader rasterises the atlas once at 8 pixels/world-unit (1536 × 896, approximately 5.25 MiB RGBA). The 21 submitted quads reuse these cells. Body paint, bonnet damage, wheel rubber and glass/trim damage read the existing VehicleView material handles. There are no per-palette or per-vehicle texture copies.

Authoring: undertray, four tyres, layered sills/shoulders, bonnet/boot, separate chrome/lamps, narrowing glasshouse, metal roof and sunroof. The frame-to-height table lives in `VehicleSpriteStack.js`. The 10.15-unit height is proportional to this car's unchanged footprint, rather than rescaling collision dimensions to the building art scale.

The current pilot covers the civilian `sedan` archetype. Other vehicles and Canvas-only renderers retain their existing drawing.
