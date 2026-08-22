# M4 — Wet asphalt and local reflection language

Branch: `agent/city-noir-atmosphere`  
Initiative: `city-noir-atmosphere`  
Depends on: M3 practical-light sources and M3.5 vehicle/emergency light contribution.

## Goal

Make the existing road surface read as damp-to-wet at night by giving already-established light sources a cheap, broken, local receiving response on asphalt. This is not a reflection engine and must not become one.

The visual target is irregular light response: elongated stains, broken shimmer and small puddle-like fragments. Never render a clean mirrored copy of a lamp, building, vehicle or sign.

## Locked authorities

- PR #69 remains sole authority for road geometry, asphalt wear, gutters, drains, cracks, repairs and road paint.
- M3 remains sole authority for practical-light source identity/colour.
- `VehicleView` / vehicle systems remain sole vehicle authority.
- M4 owns only presentation-only receiving response on eligible road surface.

## Execution checklist

### M4.1 — Source classes and receiving contract

- [x] Classify existing static sources: warm street, warm frontage, cool civic, nightlife, industrial.
- [x] Classify dynamic sources: headlight, tail/brake, police red/blue.
- [x] Define per-family reflection colour/intensity/stretch without changing source families.
- [x] Build a deterministic nearest-road receiver query from existing `roads` authority.
- [x] Reject sources beyond a bounded receiver distance.

### M4.2 — Asphalt-only receiver descriptors

- [x] Convert source descriptors into small reflection fragments attached to a road ID.
- [x] Keep fragment centres inside the selected road receiving surface.
- [x] Use deterministic hash offsets to break symmetry.
- [x] Keep sidewalks, roofs, building masses and arbitrary open ground out of the receiver model.
- [x] Do not alter walkability/collision/interaction state.

### M4.3 — Static wet response

- [x] Render warm/civic/nightlife/industrial reflections below their practical-light source pass.
- [x] Use several broken low-alpha fragments instead of one solid ellipse.
- [x] Stretch mostly away from the source and into the receiving road.
- [x] Keep the majority of dark asphalt unlit.

### M4.4 — Dynamic vehicle/emergency response

- [x] Derive dynamic reflections from `scene.cityVehicleLightDescriptors`.
- [x] Headlights: short forward wet streaks.
- [x] Tails/braking: compact red rear response.
- [x] Police: highly localized alternating red/blue wet response using existing pulse intensity.
- [x] Cull with the active camera/render window and do not add a second vehicle renderer.

### M4.5 — Focused tests

- [x] Determinism / no source mutation.
- [x] Every reflection references a real road receiver.
- [x] Fragment centres remain inside that receiver bounds/surface contract.
- [x] Source-to-road maximum-distance bound.
- [x] Static family colour/intensity mapping remains restrained.
- [x] Dynamic response follows vehicle source family/intensity.
- [x] No sidewalk/building/topology data is mutated.

### M4.6 — Gameplay-scale evidence

Capture and inspect:

- [x] `wet-warm-street.png`
- [x] `wet-nightlife.png`
- [x] `wet-vehicle.png`
- [x] `wet-police-red.png`
- [x] `wet-police-blue.png`
- [x] representative dark block remains mostly dark

Acceptance:
- road reads damp/wet without SSR;
- reflections look broken rather than mirrored;
- road/crosswalk/player readability is preserved;
- no false interactive/walkable cues are introduced;
- special colours remain local.

### M4.7 — Continuity

- [x] Update machine state and progress continuity evidence.
- [x] Update PR #72 body with validated M4 evidence.
- [x] Close M4 only after focused tests and gameplay-scale captures pass.
- [x] Advance directly to M5 low-frequency grime/surface dressing.

## Validated evidence

M4 implementation authority is `phaser/src/policies/CityWetStreetPresentationPolicy.js`. It reuses M3 practical/vehicle light descriptors and existing generated `roads`, creates deterministic road-bound fragments, and leaves the production maximum receiver reach unchanged at the per-family caps (nightlife remains `90px`).

The first M4 browser evidence attempt exposed a validation-fixture problem rather than a production defect: the authored nightclub source was legitimately farther than the bounded nightlife receiver reach, so no nightlife reflection existed for that review frame. Commit `62e2eb4fd4aade64e1f4e6393996e09d4e7db4f9` corrected only the browser evidence fixture by placing a test-only nightlife source on the nearest real generated asphalt receiver and feeding it through the same production descriptor builder and renderer. No production reach or reflection behaviour was relaxed.

Validated head: `62e2eb4fd4aade64e1f4e6393996e09d4e7db4f9`.

- `Tests` run `32475694164`: **success**; unit tests and all browser-system shards passed.
- `City atmosphere review` run `32475694166`: **success**.
- review artifact `9444326985`: `city-atmosphere-review`.
- static evidence: `wet-warm-street.png`, `wet-nightlife.png`, `wet-dark-control.png`.
- dynamic evidence: `wet-vehicle.png`, `wet-police-red.png`, `wet-police-blue.png`.
- manifest evidence confirms every displayed wet fragment is attached to a real generated road receiver; police wet alpha follows the existing red/blue pulse intensities rather than creating a new emergency-light state.

Visual assessment: accepted for M4. The response stays sparse and broken, the dark asphalt base remains dominant, saturated nightlife/police colours remain local, and navigation/player/crosswalk readability is preserved. M4 is complete; M5 is next.

## Stop rules

Use the initiative-wide stop/escalation rules. Do not stop merely because a visual iteration needs tuning; record rejected variants and continue. Stop for the user only at a genuine subjective fork, authority conflict, unrelated persistent CI blocker, or the M9 final visual gate.
