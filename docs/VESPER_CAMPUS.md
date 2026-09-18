# Vesper � phase 1: site and architectural volumes

## Goal
Turn the existing Old Quarter club into the footprint of the approved converted-theatre concept.

## Authority / scope
`vesper-campus.js` feeds the existing city compiler. The compiled city owns collision, streaming and roofs. No second runtime or scene owner.

The reserved site is (1825,1265), 410 by 255 world units. The south frontage faces the existing street. Two 40/45-unit side passages connect to a 35-unit rear courtyard. A three-storey auditorium, four-storey stage house and one-storey service annex share the site. Floor height is 4.2 metres. Only generated infill inside the reservation is removed; roads and neighbouring towers are preserved.

Main south doorway, north backstage doorway, east service doorway and west fire escape are authored explicitly. The existing club ID is preserved for Vesper contacts and deliveries. The three queue characters move to the new frontage.

## Non-goals for this phase
Final theatre facade, marquee artwork, bespoke roof assets, nightclub interiors or drug-trading mechanics. Existing materials are temporary structural presentation.

## Acceptance
Clear pedestrian routes, no road/neighbour overlap, correct roof targets, repeatable compilation, browser startup and visible massing.

## Rear yard / neighbourhood revision
The reservation extends north to y1205. The yard is 385×90 world units with reused asphalt paving, a loading apron and the existing dumpster moved to (1900,1240). Three thin 2.1m chain-link fence volumes close the north and side boundaries; 35-unit passages remain open into the alleys. The two immediate northern towers become two/three-storey tenements; obsolete high-roof traversal links are removed by the skyline compiler. Other towers are retained.

Fence asset: `phaser/assets/vesper/yard-fence-v1.webp`, 768×256 RGBA. Generated with built-in image_gen, then resized and encoded WebP, reused by the existing cached facade renderer. No new update loop.

Generation prompt: Game asset: single horizontal section of a grimy 1990s back-alley chain link fence, straight front orthographic elevation, completely flat facing viewer, no perspective. Wide aspect 3:1. Actual transparent background, transparent diamond mesh holes. Thin rusty dull grey steel diamond wire mesh, a simple tubular steel upright at either end, narrow top and bottom rails. Low-income urban service-yard fence, worn dark galvanized metal, restrained orange rust at joints, slight dents, fine clear wire pattern suitable for dark top-down gothic punk game. Fence spans full asset width and height with minimal padding, no ground, no wall, no plants, no text, no shadows outside silhouette, no decorative spikes, no stone pillars, no barbed wire. Crisp texture and silhouette, moderately detailed hand-painted game sprite, not photo.


## Full side enclosure and paving
Side fences now continue to the south frontage at y1490, enclosing both alleys and the rear yard while the whole front stays open. All three walking surfaces reuse the world-aligned sidewalk paving. A sparse grime decal is baked once into a clipped scene texture, then into existing sector surfaces.
Asset: `phaser/assets/vesper/yard-grime-v1.webp` (512px RGBA), built-in image_gen.
Prompt: Game texture asset: subtle ground dirt decal, square, directly overhead orthographic flat texture, genuine transparent background. Only irregular faint charcoal dust, brown grime, small grease stains, fine scattered grit, a few tiny cigarette ends and very small scraps of dirty paper, dark damp smudges, concentrated unevenly around outer edges with mostly empty transparent centre. For overlaying existing small grey stone paving in a neglected 1990s nightclub back alley. No underlying paving or asphalt at all, no stones forming a floor, no objects larger than tiny litter, no text, no lighting, no baked shadows, no frame. Sparse restrained low contrast game material patina, organic nonrepeating distribution. Alpha transparent empty regions essential. Single texture, not a collage.

## Theatre material pass
The club's south face now uses the authored VESPER theatre facade. Other faces use existing stone, cropped unlit window bays and authored service doors. Roofs use the dedicated theatre roof image. Warm-light overlays are separate cached textures. Vesper uses the existing adaptive facade mesh, material lifecycle and sector/camera renderer; no additional frame owner.

Built-in image_gen assets:
- `phaser/assets/vesper/facade-v1.webp`: front elevation, 1200px max width.
- `phaser/assets/vesper/roof-v1.webp`: overhead roof, 1024px max width.
- `phaser/assets/vesper/service-door-v1.webp`: service door, 256×384 maximum.

### Prompts
Facade: Game-ready facade texture for VESPER nightclub, converted decaying 1920s urban theatre in a gritty 1990s gothic punk city. SINGLE FLAT RECTANGULAR FRONT ELEVATION, orthographic, ZERO perspective, no visible roof, no side walls, no street, no background margin. Entire image is the facade from ground line to cornice, landscape 7:4. Three storeys, broad building with seven generously spaced narrow window bays, soot stained grey-brown stone and dark brick, restrained theatrical stone reliefs and fluted vertical piers. Ground floor central double doors in worn oxblood paint. Directly above doors a beautiful shallow antique theatre marquee with exact readable large ivory serif lettering 'VESPER', symmetrical rows of small warm ivory bulbs along its frame. Marquee width about 28% of facade, ground-floor height about one third overall. Faded burgundy banners on either side of centre, a few distressed concert posters at ground level, small rusted grille service opening, side bays mostly dark. Sparse dim amber panes, no large baked bloom; warm lights will be layered separately by the game. Strong crafted worn architecture, crisp thin window frames, generous solid masonry, modest ornate central pediment contained inside rectangle at upper centre. Texture fills every edge. Hand-painted textured game asset, dark and readable like vintage gothic punk games, not cartoon neon, not church or cathedral, not luxury clean building. No people, no cars, no floor, no sky, no dramatic perspective, no extra text except VESPER. Carefully detailed but not photoreal.

Roof: Game asset texture, strictly vertical overhead orthographic view of a flat roof for a wide rectangular old urban theatre converted into a seedy 1990s gothic punk nightclub. Landscape aspect 2.3:1. The rectangular roof completely fills image edge to edge, NO facade, NO surrounding ground, no sky, no perspective. Very dark charcoal aged asphalt roofing with subtle broad seams, low weathered grey brown stone coping continuously around all four edges. One small old rectangular wired-glass rooflight offset left of centre, two modest square ventilation units with rusted ductwork near back edge, thin metal service walk strip and a few restrained patched tar areas and drains. Understated warm-grey dust, restrained dark oxidized metal, sparse clean readable details, believable fixed scale, not packed with machinery. Textured hand-painted high-quality game environment material matching a soot-black 1920s theatre facade. No neon, no red glowing bars, no text, no people. Top down flat texture only.

Service door: Single game sprite, front orthographic flat elevation of a seedy 1990s nightclub backstage service door and its immediate frame, isolated actual transparent background. Tall narrow dark rusted painted steel double loading doors, shallow weathered grey brown stone lintel and slim side jambs, one small caged amber bulkhead lamp centred above lintel, exterior conduit on right frame, chipped paint, few torn paper remnants without readable text at lower edge. Door takes most of image, minimal frame. No surrounding wall plane, no ground, no perspective, no shadow outside silhouette, no text, no people. Warm lamp core but no large baked glow, glow added separately in game. Detailed textured hand-painted gothic punk game asset, subdued charcoal and muted brown, crisp edges.

## Stepped historic theatre silhouette
The original 300×130 box is replaced by a 104×130 central entrance pavilion at x1978 plus two 98×114 wings. The wings are set back 16 world units from the front and use 3.4m storeys; the centre uses 4.7m storeys. All retain three facade levels. Facade artwork is partitioned into contiguous horizontal ranges, preserving one composition instead of repeating the sign. The main and both wings use mansard roof artwork, with sloped slate, copper hips, dormers and a central zinc area. These slopes are represented by the roof texture; the independent building volumes provide the actual height/parallax differences. The rear stage house and service annex retain their functional roofs. The west fire escape still reaches the west wing's real roof.

Asset: `phaser/assets/vesper/mansard-v1.webp`, 768×768, built-in image_gen.
Prompt: Game texture asset, exact overhead orthographic plan view of a historic French mansard roof on a once-beautiful 1920s urban theatre, now a decaying gothic punk nightclub. Square footprint fills square image edge to edge. Four steep dark blue-charcoal slate slopes along perimeter leading to an inset smaller flat central zinc roof, elegant weathered stone eaves, fine oxidized copper hip seams, modest antique metal ridge trim. Two small symmetrical dormer roof forms on south slope seen strictly from overhead, one narrow old wired-glass skylight on central flat area. Architecture graceful, faded grandeur, not church, no spires. Top-down hand-painted richly textured game material, readable slate rows of small believable scale, restrained wear and rust, subtle direction shading. No facade or walls, no ground, no sky, no neon, no text, no large industrial HVAC. Perfect vertical overhead, no perspective. This will map to roof geometry of a top-down game.

## Independent dormers and close-frontage perspective
Six dormers are presentation-only attached volumes: base elevation equals the corresponding wing/centre roof, with 16 additional world units of height, separate front/side textures and projected roof. They inherit their compound's perspective state. Mansard v2 removes the painted windows so they are not doubled.

LandmarkFrontage groups landmarks with their annexes (excluding fences and roof decorations). Its smooth influence covers the south frontage of each member, at full strength within 10 units and zero by 48; a 20-unit lateral fade avoids hard boundary transitions. Player positions inside solid volumes are excluded. A single damped state controls the whole compound. The on-screen debug slider sets magnitude 0–100%, initially 75%. It is removed when the scene shuts down.

Facade depth divisions now use canonical building heights, including attachments, rather than heights of the currently visible buildings. This removes visibility-dependent repartitioning of existing facade meshes. Camera follow remains projected in the existing post-camera hook.

Assets generated with built-in image_gen:
- `phaser/assets/vesper/mansard-v2.webp` (768 square). Edit prompt: Edit this game roof texture. Remove ONLY the two small dormer windows on the bottom/south slate slope and fill their footprints with continuous matching slate tiles. Preserve all other roof geometry, hips, central zinc, skylight, colours, exact overhead camera and square framing unchanged. No new features. The dormers will be separate 3D-like game modules.
- `phaser/assets/vesper/dormer-v1.webp` (192 square). Prompt: Small game architecture texture: perfectly flat front orthographic elevation of a single antique theatre dormer window, rectangular tight framing filled edge to edge with aged grey stone facade. A dark oval window with a fine bronze cross mullion centered beneath a restrained curved stone pediment, slate-grey oxidized zinc trim at top, delicate faded 1920s theatre stone ornament. Tall-ish square panel, no perspective, no visible roof or sides, no background or transparency, no ground, no text, no people, no glow. Hand painted dark gothic punk game material, crisp moderate detail and clear window silhouette. It will be mapped to an independent roof dormer volume.

## Render budget and small props (2026-09-18)
All facade material quads use the existing screen-space adaptive mesh (0.35px interpolation tolerance); canonical landmark grouping is cached instead of rebuilt per frame. Unlit Vesper side/rear faces skip empty light textures. No extra update loop or dynamic light source was added.

Generated using built-in image_gen, alpha preserved; crops/resizes only:
- `vesper/yard-grime-v2.webp` (384px): generic sparse charcoal/brown dusty smears and damp patches on transparency; no litter, tiny grains, recognizable objects, underlying paving, or baked lighting. Low-detail, irregular clean shapes. Source exec-499561d6-9603-423e-8c58-8a8590f9c5f2.png.
- `props/bench-clean-v1.webp` and `props/lamp-clean-v1.webp`: extracted from transparent two-prop atlas, source exec-d55cb8b9-7b09-4ccc-a85e-1ffe7148f816.png. Prompt: simple overhead four broad wooden slats with black iron supports; separate Art Deco lamp with ivory square head, charcoal stem and compact base. Crisp silhouettes, one highlight/shadow per form, no grain, scratches, blur, glow or external shadows. Designed for small in-game sizes. Bench max150x46, lamp max32x104, lossless WebP.
The hospital bench and police lamps use these shared assets; light glow remains a separate cached layer. Yard grime opacity reduced to 0.32.

Validation: 16 focused geometry/frontage/mesh tests passed; production package builds. Headless browser check at Vesper (1400x850, zoom0.9, camera2030/1565) reported 2703 facade cells before and1885 after; resident visible quads279 vs268. This is a workload snapshot, not a controlled FPS benchmark (streaming/material readiness may differ). Baseline same-frame adaptive estimate1960 vs2703 supports lower tessellation work. No page errors. Live preview rebuilt on port4174.
