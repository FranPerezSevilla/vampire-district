# M6 — Grounding and shadow consistency

Branch: `agent/city-noir-atmosphere`  
Initiative: `city-noir-atmosphere`  
Depends on: completed M5 grime/service dressing and the existing building/character/vehicle presentation authorities.

## Goal

Improve the sense that moving/placed objects sit on the same ground plane without creating a second lighting model, rewriting the approved building shadow language, or making dark gameplay areas harder to read.

M6 is presentation-only. Shadows must not affect collision, AI, stealth, visibility, Heat, traffic, missions or pathfinding.

## M6.1 — shadow-language audit — complete

The audit was performed against the current branch after M5 closed. No runtime shadow code was changed in M6.1.

### Building authority — already strong; locked

`phaser/src/rendering/buildings/BuildingPresentationPolishRenderer.js` already owns the approved PR #63 building depth/shadow grammar.

**Decision:** do not add a city-atmosphere building shadow overlay and do not rewrite PR #63 shadow primitives.

### Character authority — contact grounding already exists

`phaser/src/rendering/ModularCharacterView.js` already creates one shallow black contact ellipse inside each modular character root.

**Decision:** keep the existing character shadow language. Do not stack another atmosphere shadow under characters.

### Vehicle authority — selected M6.2 target

Before M6.2, `phaser/src/vehicles/VehicleView.js` used a subtle nearly-coincident dark body underlay. It separated the procedural body from asphalt but read more like body depth than ground contact.

**Decision:** M6.2 targets vehicles only and keeps `VehicleView` as sole vehicle visual authority.

### Street props — secondary

Gameplay dumpsters remain owned by `StreetFurnitureSystem`. M6 does not introduce duplicate prop entities or alter hit/collision/broken/body-containment state.

## M6.2 — vehicle contact shadow — complete

The authorized bounded slice is complete.

### Implementation

`phaser/src/vehicles/VehicleGroundingPresentation.js` provides a small pure presentation primitive consumed by `VehicleView`:

- family: `vehicle-contact-shadow`;
- one ellipse per vehicle;
- black, alpha `0.17`;
- width scale `0.92`;
- height scale `0.70`;
- slight south/east bias (`x +0.7`, `y +1.3`);
- minimum footprint `8 × 4`;
- size derives only from the vehicle archetype;
- the same rule is used for civilian and police vehicles;
- the shadow is a child of the existing vehicle visual, so it moves and rotates with that visual;
- no world scan, gameplay state, collision, AI, Heat, police, traffic or mission authority is introduced.

The former nearly-coincident rectangular underlay is replaced by the shallow contact footprint. Vehicle body styling is otherwise left in its existing authority.

### Focused validation

`tests/vehicle-contact-shadow-presentation.test.js` protects:

- deterministic, immutable footprint geometry;
- restrained alpha and bounded dimensions;
- larger archetypes receiving proportionally larger shallow footprints;
- the same grounding rule for civilian and police archetypes;
- exactly one named ellipse from the grounding primitive;
- no mutation of archetype data.

### Gameplay-scale evidence

`tests/browser/city-vehicle-light-review.spec.js` captures and asserts the required four contexts:

- `grounding-traffic.png` — ordinary civilian traffic;
- `grounding-large-vehicle.png` — a larger van;
- `grounding-police-wet.png` — police vehicle on a wet/lighted road;
- `grounding-dark-control.png` — dark control with dynamic wet response absent.

Validated implementation/evidence head: `5468cca1a0b75316aecc9f7d5fc3ac2c03671955`.

- `Tests` run `32554016255`: **success**.
- `City atmosphere review` run `32554016253`: **success**.
- review artifact: `9470977413`.

Visual assessment: **accepted for M6**. The footprint remains deliberately subtle, scales with the vehicle, coexists with wet/emergency-light presentation and does not swallow the body/wheel silhouette in the dark control.

## M6.3 — local prop grounding — skipped / not required

M6.2 evidence did not prove a meaningful residual floating-prop problem that justifies another shadow family.

Therefore:

- do not add a generic prop-shadow system;
- keep sparse street props with their existing authority;
- revisit one specific prop family only if later gameplay-scale evidence identifies a concrete deficit.

## M6 exit — complete

- [x] moving vehicles feel seated on the ground plane;
- [x] existing building shadow grammar remains intact;
- [x] existing character grounding remains intact;
- [x] pure top-down language is preserved;
- [x] no fake isometric façade/depth system was introduced;
- [x] no prop adjustment was added without evidence;
- [x] focused and browser validation are green.

Detailed closure checkpoint: `docs/progress/CITY_NOIR_ATMOSPHERE_M6_2_CHECKPOINT.md`.

## Next bounded task

M6 is closed.

Per the initiative cadence, stop here and wait for user direction. If authorized, the next bounded task is **M7.1 decorative sign/neon grammar** only. Do not combine M7.2 steam/smoke or M7.3 contextual micro-scenes into that slice.
