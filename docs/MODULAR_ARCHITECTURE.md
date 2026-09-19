# Modular architectural grammar

## Goal and scope
Replace generic repeated facade windows with reusable visual families. Authority: ArchitecturalProfiles selects presentation only; BuildingMaterialImages bakes the result. UrbanMaterialDetail delegates facade details to that grammar; BuildingIdentity uses its palette. No compiler footprint, collider, simulation, input or save changes.

## Profiles
- institutional: pointed openings, stone piers, layered cornice, barred lower bays. Hospital and cathedral share it.
- tenement: lintels, aged masonry palette, shopfront bays.
- industrial: wide gridded windows, shuttered ground floor, restrained cornice.
- deco: vertical piers, tall windows, layered entrance. Police selects it.
- tower: narrow repeated bays, restrained metal palette, monumental base.

Selection: valid building.architecture override, then landmark/family/skyline, then deterministic ID-based fallback. Unknown overrides fall back safely. Tower wings normalize their identity. The compiler need not be edited to add a new visual family; authored district selection can supply architecture later. Current default variety is per building, not a complete district zoning system.

## Modules and performance
Base, openings, piers, entrance, cornice and weathering are drawn into the existing cached facade texture. Sign text is data on the profile result and rendered by the shared Canvas sign module. Hospital uses a medical marker; the annex has no facade sign; police uses a shield. No per-window scene objects, lights, textures or update callbacks. Maximum 32 bays and 4 upper rows; facade texture dimensions remain capped at 1024 by 384. Existing two-face preparation budget and eviction remain in BuildingParallax. Geometry projection is unchanged.

## Acceptance / limits
Distinct deterministic families with bounded windows and no frame-dependent decoration. Focused tests cover selection, overrides, bounds and distinct rendering. Hospital, cathedral and police retain their existing special roof silhouettes; this iteration modularizes facades and palettes, not every roof or a complete lighting system. Loading and frame-time regressions require browser profiling; bounded decoration alone is not proof of 60 FPS.

## Sparse facade pass
Bay spacing is wider, upper floors reduced to two (four on towers), with deterministic solid vertical bays and occasional upper omissions. Ground openings follow the same solid-bay rhythm. Every lit upper window receives an amber radial bloom baked into its facade texture after shading, using the same lit flag and sign exclusion as its glass. No extra scene object, dynamic light or per-frame texture operation. The original projection is restored (height/700 spread; 0.55 height vertical lift). Facades are split at resident building roof heights and ordered by elevation together with roofs, rather than drawing each whole building by footprint bottom. Bands reuse the same facade texture and matching UV intervals; mesh rows scale to the band fraction. This addresses a low annex covering an upper wall without weakening lateral parallax.

## Vertical proportions and pavement
Visual elevations increase by 1.6 across ordinary buildings, landmarks, annexes and towers. Spread divides that new height by 1120, preserving the prior height/700 lateral displacement; vertical lift follows the increased height. Height-band sorting uses the new elevations. Openings occupy 22% of each bay instead of 38%, with taller upper glazing; no additional window rows. Pavement uses darker charcoal/slate colours and smaller stones (courtyard 7x5, sidewalk 11x8 world units). Cached repeat textures shrink proportionally to 224x160 and 220x160, avoiding a growth in stone generation count. Gameplay footprints and collision remain unchanged.

## Institutional end bays
Institutional profiles reserve their first and last bay for solid full-height buttress modules, including the ground floor. Layered bases, shafts and caps provide supports for future roof turrets; these are currently facade details, not new roof geometry. Two-bay service facades have no upper windows but retain a centered entrance; one-bay facades retain a central opening. Vertical spacing between upper rows increases while the visual height multiplier rises to 2.15; spread uses height/1505 to preserve lateral motion. Pavement is darkened again without increasing pattern density or runtime objects.

## Roof pinnacles and sign relief
Institutional facades wider than 180 world units receive two cached octagonal stone drums with faceted slate spires above the front cornice. Their roof-space graphics follow the roof transform, participate in player occlusion and are destroyed with the resident building. They currently share the roof projection rather than receiving independent tip-height perspective. Narrow annexes are excluded. Buttresses gain recessed lancets, block joints and stepped bases. Shared sign painting adds stone coping, a recessed metal panel, rivets, shadowed serif lettering and restrained baked warmth. No dynamic lights are introduced.

## Four-direction bird-eye projection
The fixed south-facing vertical bias is removed. X and Y now use the same radial displacement from the camera centre, retaining the existing lateral strength and roof scale. Buildings below the centre expose their north wall; those above expose their south wall. At the transition the wall narrows continuously to zero; opposing faces are never emitted together. Existing resident facade cache, height-band occlusion and footprint collision are retained. Decorative pinnacle artwork currently shares the roof transform.

## Radial pinnacle volume
Pinnacles now cache octagonal rings in world coordinates, with a 28-unit drum and a tip at 89 units above the roof. Each vertex uses the roof displacement multiplied by (buildingHeight + localZ) / buildingHeight. The base therefore matches the roof exactly while the tip leans radially further, without a fixed north-facing silhouette. Faces are ordered far-to-near within each turret; projected polygons also feed the player occlusion mask. The existing building camera-key controls redraw; no textures or lights are regenerated. Pinnacle graphics remain grouped immediately above their parent roof in the global depth order, so interpenetrating spires on different buildings are not independently depth-buffered. This supersedes the earlier flat roof-space pinnacle description.

## Local parallax tuning panel
On localhost/127.0.0.1, a bottom-left debug panel exposes independent north-south and east-west multipliers from 0 to 4, initially 2. One reproduces the previous projection. Non-local builds retain multiplier 1 and do not display the panel. Values are session-only and reset when the renderer is recreated. Input invalidates the existing camera cache so stationary views update immediately; axes apply consistently to roof scale, facade vertices, face selection, pinnacle projection and occlusion. The panel is removed when its renderer is destroyed. High settings are exploratory rather than a new approved art baseline.

## Square corner-tower refinement
The latest pinnacle model replaces the octagonal drum with a square shaft and four-sided pyramidal spire. Its width and front edge match the institutional buttress bays exactly via architectureBays, avoiding detached round roof ornaments. Recessed lancet surrounds, masonry joints, a stepped square cornice with vertical returns and narrow slate ridge highlights are projected with the same per-vertex elevation. This supersedes the octagonal descriptions above.
