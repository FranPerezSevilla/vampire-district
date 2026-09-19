# Police precinct: structure phase

Authority: existing city compiler and existing building/parallax renderer. Source plan: `phaser/src/data/police-campus.js`; compiler: `tools/city-compiler/police-campus.js`. Surface composition uses the existing sector cache.

The existing northern civic block provides a 570 × 386 world-unit reservation (41.6 × 28.1 metres using 24 units per 1.75m human). Existing surrounding roads remain connected. Main tower: six spacious storeys plus two stepped roof tiers, two three-storey wings, one-storey gatehouse. Front court separates pedestrian access from the side motor pool. Four 40 × 70 bays fit vehicles around 60 units long; the parking aisle is about 100 units wide. Front pedestrian passage is 50 units wide; vehicle gate is 100 units wide.

This phase places collision-backed building and perimeter volumes, roofs and static pavement. Gate is closed and static; the pedestrian passage remains open. Art Deco facade/entrance/roof assets, projecting entry piers, stepped crown, four parked patrol vehicles and cached courtyard lighting are now installed. Gate operation remains future gameplay work. See POLICE_ART_DECO_ASSETS.md for asset prompts and details. Existing police station dispatch anchor is retained on the public road.

Acceptance: idempotent compiler, no building-road overlap, clear walking path, clear parking bays, correct roof drop, different module heights and shared parallax. Do not replace generated topology by hand or add another rendering loop.

## Fence asset
Built-in image generation, source exec-667be8a5-c5de-4549-9b1f-068f57aa3e27.png. Runtime asset: phaser/assets/police/fence-v1.webp, alpha preserved, resized to fit 768 × 256. Shared by fence and gate material bakes.
Prompt: Production game asset: one seamless horizontal modular panel of severe 1990s police compound wrought iron security fence, perfectly flat FRONT ELEVATION, not perspective. Long wide rectangle 4:1. Blackened steel narrow vertical bars with simple pointed tips, two horizontal cross rails, thick understated square terminal posts at far left and right. Dark graphite with restrained grey edge highlights so readable against dark backgrounds. Transparent background between bars and outside silhouette. No ground, no wall, no scenery, no text, no shadows cast outside, no ornate curves or decorative gothic tracery. Oppressive utilitarian art deco police fortress material. Crisp simplified textured 2D game raster, controlled detail, evenly sized vertical bars, panel fills canvas with small transparent margins.

Perimeter revision: masonry at one precinct storey (4.7m), railing 22 world units above it. Railing is a separate 1.2-unit footprint module with an explicit elevated base; its facade UV covers only the iron portion. Pale parking curb follows the perimeter and driveway, leaving the road entrance open. Wall reuses stone from the generated Art Deco facade asset.
