# Hospital: readable overhead architecture

## Goal
Recognizable hospital roof and corner towers, with a gradual facade reveal when approaching its main entrance.

## In scope
Authority: BuildingParallax and its material/roof modules. Shared ground tile contrast. One presentation-only entrance zone; only the selected entrance building and its attached turrets share its frontal pose.

## Out of scope
Collision, generated city, gameplay camera control, other landmark zones and publication.

## Acceptance
- Distinct roof planes and square, shaded pointed turrets without compressed concentric texture.
- Continuous reversible entrance influence, bounded and shared by attached volumes.
- Existing axis controls, occlusion and height sorting retained.
- Ground grain is subordinate to architecture and warm entrance lighting.

## Validation
Focused projection/material tests, affected-plan checks, packaged build and browser views at entrance and outside the zone. Hardware FPS is not inferred from headless browser timings.

## Implemented and checked
### Doorway experiment paused
Entrance perspective is disabled in BuildingParallax at the user's request. Normal radial parallax and physical height bounds remain enabled. The doorway implementation is retained for later review.

### Stable doorway perspective (video regression)
The doorway now blends the regular height-bounded radial projection into a fixed directional projection of 65% of physical height. Debug multipliers affect the regular projection only; they cannot amplify the doorway pose. Attached turrets use their parent's entrance state, while the detached emergency annex retains its normal parallax. Bases and collision remain fixed.
The doorway activates within 24 units sideways / 55 forward, remains latched until beyond 58 sideways / 105 forward (or 16 behind), and uses the existing time-based interpolation. This prevents threshold jitter from repeatedly folding the facade. Multiple authored doorway orientations are supported.
Focused tests cover threshold movement, departure/re-entry, debug independence, camera-independent frontal pose, shared attached vertices and the physical bound throughout the blend.

### Common visual scale and bounded perspective
`WorldScale` defines a 1.75 m reference human as 24 world units, a 2.30 m door and 3.40 m storeys. Building presentation height follows explicit `renderHeight`, then `heightMetres`, then `storeys` (defaults: hospital/landmarks 3, emergency 1, ordinary 2, skyline 26). These are art-scale defaults, not surveyed building data or character sprite footprint dimensions. Existing gameplay elevation, collisions and vehicle sizes are unchanged; the 4.4 m car-length reference is reserved for a later vehicle pass.

The renderer computes a common attenuation across resident visible volume corners, so the combined radial parallax and entrance bias cannot displace a roof corner further than that volume's reference height. The same multiplier preserves attachment seams and proportional height bands. Doors are sized vertically from the shared metre conversion. Wall lamp fixtures now live in the sharp facade layer; only the softer, reduced halo remains in the low-resolution light layer. No old photographic lamp image was found in the active facade renderer.

26 focused scale/projection/architecture/lifecycle tests pass, including extreme sliders and combined entrance bias; package build passes.

### Hipped slate roof and medical symbol
The main hospital roof now has four slate slopes meeting at a ridge instead of a broad flat central slab. Courses and staggered joints follow each slope, with restrained hip highlights and a low glazed ridge lantern. Narrow varied stone coping sits in front of a recessed gutter. These roof details are baked into the resident bitmap and preserve attached-turret cutouts.

The hospital profile no longer supplies a text sign. A small raised red cross is drawn on its south facade over the main entrance; the emergency roof marker remains. Seventeen focused architecture, turret and material checks and packaging pass.

### Roof trim, grounded base and finishing pass
Hospital coping is now a narrow 3-world-unit dark stone edge with spaced joints, replacing wide cream bands. The facade shadow below it is short. Medical facades have a low darkened masonry base and sparse deterministic damp patches. A cached ground-contact bitmap adds narrow soft shadows at the fixed footprint, plus a shallow threshold and warm pavement spill at authored entrances. Its texture and image are released with the resident building.

Turret cap planes receive sparse projected slate courses and restrained ridge highlights, without mapping a pinched square texture onto the apex. Rooftop vents use small world-scale housings, louvres, contact shadows and short ducts; two drain details sit near the roof edge. Cap lines update with the existing projection; facade and ground gradients are prepared once per resident entry. No dynamic light or collision authority was added.

### Attached volume intersection
The main roof bitmap now cuts out attached tower footprints, including its perimeter trim. Facade height bands subtract intervals embedded in related volumes at that height; the tower wall above the parent roof remains complete. Cropped meshes preserve original horizontal UV coordinates for both stone and lighting, rather than stretching the remaining texture. This is a presentation union for parent/attached volumes only, not a change to unrelated neighbours or collisions. 23 focused projection/union/material tests and the packaged build passed.

### Complete corner turret modules
`CornerTurrets` now expands the hospital into two attached presentation volumes. Each has a full ground-to-shoulder facade, its own height, square footprint and pointed cap. Default hospital configuration: width 44, overhang 10, shoulder 55 above the hospital roof, cap height 58. `building.turrets` can configure these values; no recursive modules are created. The previous hospital buttress drawings and rooftop ornaments are removed.

Bodies use the existing facade material cache, parent material seed and height-band depth sorting. Caps use the same projection above each module roof. The common stone pattern is shared with the hospital; the towers have no fake entrance, hospital sign or duplicate light layer. The extension is visual: compiler collision and pedestrian navigation footprints are unchanged. New physical annex footprints would require a coordinated city-authoring change.

22 focused tests pass for module dimensions, independent heights, cap projection, material identity, depth bands and disposal. Build and entry/exit browser smoke pass without page errors.

### Lit doors and continuous hospital masonry
Medical portal glass now uses an illuminated warm base color, with the glow kept in the independent light layer. The same `warmGlow` gradient helper draws emitting windows, actual authored door halos and two wall lamps per horizontal facade. Hospital floor bands and stacked horizontal facade cornices are removed, including the contrasting ground-floor strip; vertical piers continue through the wall. Other architecture families retain their banding. No per-frame lights or new scene objects were added. Build and 16 focused material/architecture/lifecycle checks passed.

### Current rule: access doorway only
Supersedes the distance rule below. `BuildingEntrances` holds shared presentation entrances (id, wall side, normalized wall position), consumed by both facade drawing and perspective activation. The hospital's main south door is configured; other buildings do not trigger without an explicit layout. Multiple entrances are supported. This does not add interior gameplay transitions or move existing navigation anchors.

The effect is full within 12 units sideways and 25 units in front of the threshold, fades to zero by 38 sideways / 80 forward, and never activates behind the wall. Existing temporal smoothing is retained. 22 focused tests pass, including two entrances on different sides, rear rejection and no implicit doors; package build passes.

### Latest direction: frontal at distance, normal close up
The distance rule now overrides the earlier entrance-reveal direction below: hospital perspective bias is zero within 55 world units of its footprint and smoothly reaches full frontal bias at 240 units. Neighbouring buildings still share the same height-proportional bias. The transition remains reversible and camera control is unchanged.

Institutional windows, tower lancets and double doors are drawn with crisp Canvas paths instead of downsampled image cutouts. Institutional facade resolution is bounded at 1536 × 512. Warm gradients are cached on a separate transparent layer at one quarter of each dimension and projected with a 2 × 2 mesh per full face; structural facades retain their 8 × 8 mesh. Light layers use the same height bands and are released with the facade. This is cached presentation lighting, not dynamic shadow-casting lights.

30 focused tests pass, including inverse distance behaviour and disposal of both material and light resources. Build passes. The previous general-suite failures remain outside this pass.

### Earlier iteration
The roof has distinct hip planes and a central rooflight. Pinnacles use directional solid slate faces over textured square shafts; no texture is pinched into the tip. A hospital entrance zone has a smooth spatial falloff and a 350 ms exponential transition. It applies one height-proportional northward bias to all resident buildings, honoring the north/south debug multiplier. It does not reposition the gameplay camera. Paving contrast is reduced citywide; the hospital entrance receives a baked warm glow.

40 focused tests passed. Packaged build and browser entrance/exit check passed without page errors (influence rose above .98 and returned below .01). Visual review included the overhead roof and the revealed facade. Full `check:fast`: 1143 passed, 39 failed across campaign, HUD, boot, city and other existing working-tree areas; this is not a green whole-project validation. The affected runner exits when attempting `npm test` on this Windows setup. Browser suite coverage passed separately.

The appearance is a reviewable first pass, not a claim of exact concept reproduction. Existing facade height-band sorting remains; additional landmark zones are intentionally not enabled.
