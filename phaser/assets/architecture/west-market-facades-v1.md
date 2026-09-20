# West Market complementary facades

- Generated with the built-in ImageGen tool, 2026-09-20.
- Style reference: `ordinary-block-v2.png`. The reference was preserved.
- Output: `west-market-facades-v1.png`, 1254 × 1254, one shared atlas (~6 MiB decoded).
- Original tool output: `C:/Users/Franelly/.codex/generated_images/01a0a55f-f06c-7ff3-9e79-c762c9424c59/exec-1ddbd3e5-d416-4d73-b748-873f929a75eb.png`.
- Three authored two-storey elevations: residential courtyard, industrial warehouse, service workshop. The central entrance is used once; side bays repeat at physical scale. Additional upper storeys reuse the upper strip. Quiet secondary walls use the existing atlas.
- Crops (normalized): court [.002,.002,.998,.325], warehouse [.002,.334,.998,.661], workshop [.002,.669,.998,.988].
- Composed only when a facade enters the existing material cache. No per-frame raster generation or new simulation loop.

## Exact generation prompt

Use case: style-transfer.
Asset type: reusable raster facade atlas for ViceBlood, a 1990s gothic-punk top-down game with projected building walls.
Input image: the existing atlas is a STYLE REFERENCE. Produce a complementary atlas, not a city scene. Keep its near-black masses, restrained texture contrast, crisp window and door shapes, quiet charcoal stone, sparse amber interiors. Do not change the source asset.
Composition: square image split into THREE equal-height horizontal strips, each spanning the entire width, orthographic front elevation, precisely flat with no perspective. Every strip is a continuous two-storey facade: the upper floor occupies its top half, the ground floor its bottom half, perfectly horizontal floor division at the middle of each strip. Fill the complete strips edge to edge with architecture, no gaps or labels, no roof or ground. Each strip has four narrow window bays and generous quiet wall around them; a central ground-floor entrance. Fixed verticals, crisp edges.
TOP STRIP: restrained blackened-brick residential courtyard wing, narrow rectangular sash windows, subtle wrought iron on lower windows, tall understated central door with small amber fanlight, one upper window warmly lit, otherwise dark. Elegant decayed city architecture, not a church.
MIDDLE STRIP: former Victorian market warehouse, soot-black industrial brick, slim tall arched steel factory windows upstairs with one softly amber interior, broad dark loading door in the center below, closed metal shutter and a narrow service door to either side. Heavy stone jambs, understated.
BOTTOM STRIP: old service workshop, almost black roughcast with aged charcoal stone edges, upstairs three sparse tall dark windows and one dim amber window, broad timber carriage gate below at center and a small warm service window on one side. Very little ornament.
Materials must read as large black shapes first. No noisy grit everywhere, no white stone, no bright outlines, no pale mortar, no heavy bloom, no vignette, no fog. Light is inside openings only; spill added in engine. Absolutely no people, cars, props in front, text, signage, roof, pavement, borders or watermark. Match the reference quality and exposure; distinguish the three architectural uses through openings and proportions.
