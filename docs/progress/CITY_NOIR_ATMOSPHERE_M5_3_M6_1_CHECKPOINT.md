# City noir atmosphere — M5.3 / M6.1 checkpoint

Date: 2026-08-21  
Branch: `agent/city-noir-atmosphere`  
PR: #72

This checkpoint records the two bounded tasks explicitly authorized by the user in the current batch: finish M5.3 and, only if M5.3 validated successfully, continue with M6.1. The batch ends after M6.1 documentation.

## M5.3 — service-corner composition — complete

Authority:
- `phaser/src/policies/CityServiceCornerDressingPolicy.js` owns presentation-only `service-corner-litter`;
- source inputs are existing M5.2 `service-strip` descriptors plus read-only building geometry;
- `StreetFurnitureSystem` dumpsters remain gameplay authority and are not read/mutated by the delivered M5.3 family.

Changed:
- added deterministic, sparse industrial/warehouse service-corner litter;
- maximum 6 descriptor compositions and 3 tiny fragments per composition;
- minimum 86-unit spacing;
- maximum 34-unit outward distance from source building;
- road/crosswalk/building rejection;
- static render-window culling;
- neutral dark paper/debris fragments only;
- installed after M5.2 grime in `phaser/src/main.js`;
- added focused unit coverage and gameplay-scale browser evidence.

Validation history:
- initial browser review failed in the test harness because the immutable descriptor array was sorted in place;
- production code and unit tests were unaffected;
- commit `034e165ecd9436e6b697ad248d7bab9b605214a8` corrected the harness to sort a copied array while preserving immutable production descriptors;
- `Tests` run `32491558013`: **success**;
- `City atmosphere review` run `32491558002`: **success**;
- artifact `9450153767`;
- captures: `service-corner-dressing.png`, `service-frontage-grime.png`, `mixed-grime-context.png`, `grime-dark-control.png`.

Visual result:
- tiny service-corner debris is visible only as a secondary contextual detail;
- mixed city composition remains sparse;
- dark control remains free of world-wide litter spam;
- no interaction/collision/gameplay cue is introduced.

M5 exit: **complete**.

## M6.1 — shadow-language audit — complete

Authority audit:

### Buildings
`phaser/src/rendering/buildings/BuildingPresentationPolishRenderer.js` already has the approved PR #63 layered directional shadow/depth grammar: layered rect/polygon/circle shadow passes, parapet/roof shade and raised-volume depth. No atmosphere-level building shadow should be added.

### Characters
`phaser/src/rendering/ModularCharacterView.js` already creates a shallow black contact ellipse inside each modular character root (alpha about `0.27`, size tied to body width). Player/civilian/police grounding is already consistent enough; do not stack a second character shadow.

### Vehicles
`phaser/src/vehicles/VehicleView.js` currently uses a subtle nearly-coincident dark rectangular underlay (`0x070a11`, alpha `0.20`). It separates the body from asphalt but reads mostly as body depth rather than a soft ground-contact cue. Vehicles are therefore the clearest remaining M6 grounding deficit.

### Street props
`phaser/src/systems/StreetFurnitureSystemCore.js` paints gameplay dumpsters without a separate contact shadow. This is a secondary possible deficit only; prop gameplay state/collision must remain untouched and no prop shadow should be bundled into the first vehicle correction.

Decision:
- M6.2 is locked to **vehicle contact shadow only**;
- keep `VehicleView` as the sole vehicle presentation authority;
- one cheap shallow low-alpha footprint, slightly directionally biased to match existing building shadow language;
- dimensions derived from vehicle archetype footprint;
- no per-frame city scan, lighting authority or gameplay dependency;
- characters/buildings remain unchanged;
- street-prop grounding is deferred to optional M6.3 only if later visual evidence proves it necessary.

Canonical M6 task contract:
- `docs/agent-tasks/2026-08-21-city-noir-m6-grounding-shadows.md`.

## Next checkpoint

The current authorized batch ends here. The next bounded task is **M6.2 vehicle contact shadow**, but it must not start until the user explicitly says to continue again.
