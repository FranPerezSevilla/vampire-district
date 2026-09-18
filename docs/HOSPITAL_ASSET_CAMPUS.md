# Hospital access — current layout
The main hospital is restored to x=300,y=300,w=400,h=280. The emergency wing is restored to y=500, with roof bounds and traversal restored by the authored hospital-campus compiler.
The full baked forecourt and access aprons are no longer rendered. A narrow light stone approach (x=484,y=580,w=32,h=110) uses only the walkway portion of the asset. Two transparent painted ambulance bays occupy the existing southern road (x=550,y=696,w=164,h=34). Markings are visual; they do not add dispatch AI or reroute traffic.
The pavement material now repeats directly without four-way mirroring. Both pedestrian areas and sidewalks share its world-aligned 128-unit tile. No geometry, collision, or road ownership changes are introduced by the paint.
Existing entrance, service, roof and furnishing assets remain. Doorway perspective remains disabled.
Validation: footprint restoration, idempotence, walkway clear of buildings/roads, bay markings inside road bounds, roof travel endpoints, city validation and browser preview.

## Ambulance layby
The road surface now extends into the pavement at x=540–700,y=612–691. The curb follows the three closed sides and chamfered corners, leaving the south edge open to the existing carriageway. The two bay decals move inside this service recess (x=548,y=620,w=144,h=62), clear of the through lanes. `hospital-access.js` owns this authored presentation layout; it uses the existing cached asphalt asset and sector drawing. Buildings and traffic routing remain unchanged.

The revised bay decals are nearly square (72×62 world units each); the recess extends inward without reaching the hospital or annex footprints.
