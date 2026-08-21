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

- [ ] Classify existing static sources: warm street, warm frontage, cool civic, nightlife, industrial.
- [ ] Classify dynamic sources: headlight, tail/brake, police red/blue.
- [ ] Define per-family reflection colour/intensity/stretch without changing source families.
- [ ] Build a deterministic nearest-road receiver query from existing `roads` authority.
- [ ] Reject sources beyond a bounded receiver distance.

### M4.2 — Asphalt-only receiver descriptors

- [ ] Convert source descriptors into small reflection fragments attached to a road ID.
- [ ] Keep fragment centres inside the selected road receiving surface.
- [ ] Use deterministic hash offsets to break symmetry.
- [ ] Keep sidewalks, roofs, building masses and arbitrary open ground out of the receiver model.
- [ ] Do not alter walkability/collision/interaction state.

### M4.3 — Static wet response

- [ ] Render warm/civic/nightlife/industrial reflections below their practical-light source pass.
- [ ] Use several broken low-alpha fragments instead of one solid ellipse.
- [ ] Stretch mostly away from the source and into the receiving road.
- [ ] Keep the majority of dark asphalt unlit.

### M4.4 — Dynamic vehicle/emergency response

- [ ] Derive dynamic reflections from `scene.cityVehicleLightDescriptors`.
- [ ] Headlights: short forward wet streaks.
- [ ] Tails/braking: compact red rear response.
- [ ] Police: highly localized alternating red/blue wet response using existing pulse intensity.
- [ ] Cull with the active camera/render window and do not add a second vehicle renderer.

### M4.5 — Focused tests

- [ ] Determinism / no source mutation.
- [ ] Every reflection references a real road receiver.
- [ ] Fragment centres remain inside that receiver bounds/surface contract.
- [ ] Source-to-road maximum-distance bound.
- [ ] Static family colour/intensity mapping remains restrained.
- [ ] Dynamic response follows vehicle source family/intensity.
- [ ] No sidewalk/building/topology data is mutated.

### M4.6 — Gameplay-scale evidence

Capture and inspect:

- [ ] `wet-warm-street.png`
- [ ] `wet-nightlife.png`
- [ ] `wet-vehicle.png`
- [ ] `wet-police-red.png`
- [ ] `wet-police-blue.png`
- [ ] representative dark block remains mostly dark

Acceptance:
- road reads damp/wet without SSR;
- reflections look broken rather than mirrored;
- road/crosswalk/player readability is preserved;
- no false interactive/walkable cues are introduced;
- special colours remain local.

### M4.7 — Continuity

- [ ] Update machine state and progress log.
- [ ] Update PR #72 body with validated M4 evidence.
- [ ] Close M4 only after focused tests and gameplay-scale captures pass.
- [ ] Advance directly to M5 low-frequency grime/surface dressing.

## Stop rules

Use the initiative-wide stop/escalation rules. Do not stop merely because a visual iteration needs tuning; record rejected variants and continue. Stop for the user only at a genuine subjective fork, authority conflict, unrelated persistent CI blocker, or the M9 final visual gate.
