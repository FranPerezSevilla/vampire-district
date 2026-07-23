# Motorized police — Milestone 13.6

_Last updated: 2026-07-23_

## Status

**Implementation candidate.**

Milestone 13.6 adds a bounded motorized response layer on top of the accepted macro graph, lane polylines, authored vehicles and existing foot-police AI.

The feature does not turn police cruisers into civilian traffic tokens and does not create another general-purpose vehicle simulation.

## Goals

- make wanted levels 2–3 visibly escalate through road response;
- preserve one authoritative police officer AI after dismount;
- keep total police pressure bounded while officers are travelling inside cruisers;
- use the accepted macro graph and lane geometry instead of direct off-road pursuit;
- create one partial roadblock without hard-locking the player;
- preserve rooftop and sewer escape routes;
- remember an abandoned suspect vehicle briefly after the player exits;
- allow cruisers to be blocked or disabled and transfer their officers to foot pursuit;
- keep civilian traffic, authored campaign vehicles and motorized response as separate authorities.

## Wanted-level response

```text
wanted 0–1   no motorized response
wanted 2     1 pursuit cruiser · 2 officers reserved
wanted 3     1 pursuit cruiser + 1 partial roadblock cruiser · 4 officers reserved
```

The existing police totals remain authoritative:

```text
wanted 0  → 2 total officers
wanted 1  → 3 total officers
wanted 2  → 5 total officers
wanted 3  → 7 total officers
```

`PoliceSystem.desiredCount()` subtracts officers who are currently inside active response cruisers. When they dismount, they enter `NpcSystem` as normal police and the reservation disappears, so the total converges on the same wanted-level target instead of stacking extra units.

## Authority model

```text
ExposureSystem
  → wanted level
  → MotorizedPoliceSystem desired response units

MacroTrafficPoliceSystem
  → district graph and district lookup

TrafficMaterializationSystem
  → accepted lane manifest and civilian proxy positions

MotorizedPoliceSystem
  → response-unit identity, role, route, cruiser health, local container and dismount decision

PoliceSystem
  → officer creation after dismount
  → existing foot search, containment, attack and patrol AI
```

Explicitly not authoritative:

- civilian macro traffic does not own police units;
- `VehicleSystem.vehicles` does not contain response cruisers;
- campaign save does not persist transient wanted-response cruisers;
- the motorized layer does not duplicate foot officer AI after dismount.

## Macro routing

Pure policy functions live in:

- `phaser/src/police/MotorizedPolicePolicy.js`

They own:

- desired cruiser count by wanted level;
- deterministic pursuit/roadblock role assignment;
- breadth-first shortest district path;
- graph-edge lookup;
- forward/reverse lane selection;
- route-leg construction;
- bounded progression through route legs;
- partial final-leg stop for roadblocks;
- officer reservation calculation.

Response origins are selected from distant district candidates. The cruiser follows explicit lane polylines and never travels in a straight line through buildings.

## Local cruiser materialization

`MotorizedPoliceSystem` owns a fixed pool of two police-cruiser containers.

Default local rules:

```text
maximum units              2
materialize radius         920
pursuit dismount distance  150
roadblock trigger distance 210
impact cooldown            0.9 s
abandoned-car memory       4 s
```

A cruiser is visible only when:

- the player is on the street layer;
- its current point is resident in city streaming;
- it is within the local materialization radius.

Switching to rooftops or sewers hides the cruiser containers but does not delete the macro response state. This preserves vertical escape without teleporting police units away.

## Pursuit cruiser

At wanted level 2 and above, unit zero receives the `pursuit` role.

It:

- routes toward the player or remembered suspect vehicle district;
- slows when civilian traffic, authored vehicles or another response cruiser blocks the next lane point;
- materializes near the player;
- dismounts when it reaches an interception boundary, becomes locally blocked, or closes on an on-foot suspect;
- leaves its cruiser as a local obstacle after officers deploy.

This first phase uses macro lanes to deliver the response to the correct district boundary. Full freeform lane selection inside a district remains deferred.

## Partial roadblock

At wanted level 3, unit one receives the `roadblock` role.

It:

- follows a separate deterministic route;
- stops at `72%` of its final route leg;
- rotates across the lane;
- blocks only part of the road;
- deploys officers when the player approaches.

Only one roadblock cruiser is created. The system intentionally preserves another street lane plus rooftop and sewer exits, so the response adds pressure without a hard lock.

## Dismount and foot-AI transfer

`PoliceSystem.spawnMotorizedOfficers()` creates up to two officers per cruiser.

Each officer receives:

- a stable ID derived from the cruiser unit;
- `motorizedUnitId`;
- deployment reason and role;
- a current player investigation target;
- the normal police NPC type and existing AI state.

Dismount triggers include:

- pursuit interception;
- roadblock approach;
- local traffic blockage;
- cruiser disablement.

The operation is idempotent. Repeated dismount calls return the existing officer IDs and cannot duplicate officers.

## Abandoned suspect vehicle memory

While the player drives during wanted level 2–3, the system records:

- vehicle ID;
- position and angle;
- remembered timestamp;
- expiry timestamp.

After the player exits, cruisers continue targeting the remembered vehicle position for four seconds before returning to the player focus. Foot officers remain governed by `PoliceSystem` and can continue the direct chase.

This creates a small but readable opportunity to abandon a car and escape vertically or through sewers.

## Cruiser collision and disablement

The motorized system wraps the current public `VehicleSystem.canOccupy()` chain after civilian traffic collision hooks.

Visible cruisers:

- block player-vehicle occupancy;
- remain physical obstacles after officers dismount;
- can receive high-speed player impact damage;
- damage and slow the player vehicle on hard contact;
- add exposure and local police heat;
- use a per-unit impact cooldown.

A disabled cruiser:

- stops progressing;
- uses wreck presentation;
- remains a local obstacle while visible;
- immediately deploys any officers still inside.

Response-cruiser health is transient wanted-response state. It is not a campaign-owned vehicle condition and is discarded when the wanted response retires.

## Runtime order

Milestone 13.6 extends the accepted pre-frame order:

```text
ChunkStreamSystem
DistrictPackSystem
EntityStreamSystem
DistantSimulationSystem
MacroTrafficPoliceSystem
TrafficMaterializationSystem
TrafficLocalBehaviorSystem
TrafficPhysicalConsequencesSystem
TrafficImpactConsequencesSystem
MotorizedPoliceSystem
PedestrianSystem
normal GameplayRuntime frame
```

This position means:

1. macro graph and civilian lane state are current;
2. traffic contact consequences are resolved;
3. police cruisers sample the final local road state;
4. normal police/NPC AI then consumes any newly dismounted officers.

## Diagnostics

```js
window.NBD_MOTORIZED_POLICE.snapshot()
window.NBD_MOTORIZED_POLICE.reconcile()
window.NBD_MOTORIZED_POLICE.step(seconds)
window.NBD_MOTORIZED_POLICE.damage(unitId, amount)
window.NBD_MOTORIZED_POLICE.dismount(unitId, reason)
window.NBD_MOTORIZED_POLICE.blocks(x, y, radius)
window.NBD_MOTORIZED_POLICE_READY
```

The snapshot exposes:

- wanted level and desired unit count;
- reserved officer count;
- deployments, dismounts and disabled cruisers;
- suspect-vehicle memory;
- unit role, route, progress, status and district target;
- local visibility, health and officer IDs;
- initialization errors.

## Automated coverage

Unit tests cover:

- wanted-level unit counts;
- pursuit and roadblock role assignment;
- shortest district routing;
- lane direction;
- route-leg construction;
- multi-leg advancement;
- partial roadblock stop;
- officer reservation before and after dismount.

Chromium coverage targets:

- wanted-level-two cruiser deployment;
- bounded foot officer count while officers are reserved;
- pursuit arrival and two-officer dismount;
- wanted-level-three roadblock role and cross-lane angle;
- roadblock collision occupancy;
- cruiser disablement without duplicate officers;
- cruiser hiding during rooftop escape;
- remembered suspect vehicle after exit;
- no page errors.

## Deliberately deferred

- freeform intra-district lane choosing;
- multiple simultaneous roadblocks;
- spike strips;
- drive-by firearms;
- police vehicle persistence between wanted events;
- police impound and retrieval;
- prisoner transport;
- helicopter/cruiser tactical coordination;
- full police-vehicle damage VFX;
- faction-specific response vehicles.

## Acceptance criteria

- wanted level 2 deploys one pursuit cruiser and reserves two officers;
- wanted level 3 deploys a second partial roadblock cruiser;
- total police count remains bounded by existing wanted targets;
- cruisers follow authored lanes and respect local blockers;
- officers transfer into existing foot AI exactly once;
- a blocked or disabled cruiser cannot trap the player permanently;
- the partial roadblock preserves another road or vertical/sewer escape;
- abandoning a vehicle leaves short-lived search memory;
- cruisers hide off-street without deleting macro response state;
- civilian traffic and campaign vehicles remain separate authorities;
- unit, boot, systems and campaign CI domains remain green.
