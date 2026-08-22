# City noir atmosphere — M6.2 vehicle grounding checkpoint

Date: 2026-08-22  
Branch: `agent/city-noir-atmosphere`  
PR: #72  
Milestone state: **M6 complete**

## Why this checkpoint exists

The M6.2 runtime/test changes were already present on the PR branch when work resumed after the CI fix was landed in `main` and synchronized into PR #72. The canonical machine state and PR description still described M6.2 as awaiting user direction.

This checkpoint reconciles documentation with the code and the successful current-head evidence. It does not add a second implementation of M6.2.

## M6.2 delivered scope

Vehicle grounding is presentation-only and remains inside the existing vehicle visual authority.

`phaser/src/vehicles/VehicleGroundingPresentation.js` defines one shallow `vehicle-contact-shadow` ellipse consumed by `phaser/src/vehicles/VehicleView.js`.

Current policy:

- color: black;
- alpha: `0.17`;
- width: `92%` of archetype width;
- height: `70%` of archetype height;
- directional bias: `x +0.7`, `y +1.3`;
- minimum footprint: `8 × 4`;
- same rule for civilian and police archetypes.

The primitive replaces the old nearly-coincident rectangular underlay rather than stacking another darkness layer. It is attached to the existing vehicle visual, so it moves/rotates naturally without a world scan.

No character, building or street-prop shadow changes are part of M6.2. No collision, AI, Heat, traffic, police, pathfinding, mission or visibility authority changes.

## Focused test evidence

`tests/vehicle-contact-shadow-presentation.test.js` verifies:

- deterministic/frozen specs;
- restrained alpha and bounded footprint sizing;
- larger vehicles receive a larger but still shallow shadow;
- civilian and police archetypes use the same rule;
- one named ellipse is created;
- input archetype data is not mutated.

## Gameplay-scale browser evidence

`tests/browser/city-vehicle-light-review.spec.js` includes the M6 grounding review and produced:

- `grounding-traffic.png`;
- `grounding-large-vehicle.png`;
- `grounding-police-wet.png`;
- `grounding-dark-control.png`;
- `vehicle-grounding-manifest.json`.

The manifest records:

- ordinary hatchback: `26.68 × 10.5`, alpha `0.17`;
- van: `36.8 × 13.3`, alpha `0.17`;
- police vehicle: `32.2 × 11.9`, alpha `0.17`;
- dark-control vehicle: `28.52 × 11.2`, alpha `0.17`.

The wet-police capture confirms local emergency reflections still receive on a real road while the vehicle retains its contact footprint. The dark control confirms there is no dynamic wet response there and the shadow remains subordinate to the body silhouette.

## Validation

Validated implementation/evidence head:

`5468cca1a0b75316aecc9f7d5fc3ac2c03671955`

- GitHub `Tests` run `32554016255`: **success**.
- GitHub `City atmosphere review` run `32554016253`: **success**.
- City atmosphere review artifact `9470977413`.

The final head adjustment was review-harness-only (`test: keep M6 police evidence unobstructed`): it isolates the police capture after road/light state is established. Runtime grounding behavior was not changed by that harness correction.

## Visual assessment

Accepted for the M6 gate.

The contact footprint is intentionally subtle: it gives ordinary and large vehicles a consistent ground cue, remains compatible with wet/police light presentation and does not turn the dark control into a heavy black vehicle blob.

## M6.3 decision

**Skipped / not required.**

M6.2 evidence does not show a meaningful residual floating street-prop problem that warrants a generic prop-shadow family. Existing street props therefore remain untouched and under their current authority.

A future prop adjustment must be justified by a specific gameplay-scale visual deficit and should target one existing-renderer family only.

## M6 closure

M6 is complete:

- building shadow language remains PR #63 authority;
- character contact grounding remains `ModularCharacterView` authority;
- vehicle grounding deficit is addressed in `VehicleView`;
- no duplicate gameplay/presentation authority was created;
- pure top-down readability is preserved;
- affected validation is green.

## Next task

Per the default bounded-task cadence, autonomous work stops at this checkpoint.

Next planned task, only after new user direction:

`M7.1-decorative-sign-neon-grammar`

Do not combine M7.2 steam/smoke or M7.3 contextual micro-scenes with that next slice.
