# Motorized police — Milestone 13.6

_Last updated: 2026-07-23_

## Status

**Accepted and implemented.**

Milestone 13.6 adds a bounded motorized response layer on top of the accepted macro graph, authored lane polylines and existing foot-police AI.

Police cruisers are neither civilian traffic tokens nor campaign-owned vehicles. They are transient wanted-response units that deliver officers into the authoritative `PoliceSystem`.

## Wanted-level response

```text
wanted 0–1   no motorized response
wanted 2     1 pursuit cruiser · 2 officers reserved
wanted 3     1 pursuit cruiser + 1 partial roadblock · 4 officers reserved
```

Existing total officer targets remain unchanged:

```text
wanted 0  → 2 officers
wanted 1  → 3 officers
wanted 2  → 5 officers
wanted 3  → 7 officers
```

`PoliceSystem.desiredCount()` still returns the public total. `footDesiredCount()` subtracts officers currently inside response cruisers. When a crew dismounts, those NPCs enter the existing police list and their reservation disappears, keeping total pressure bounded rather than stacking extra officers.

## Authority model

```text
ExposureSystem
  → wanted level
  → MotorizedPoliceSystem response count

MacroTrafficPoliceSystem
  → district graph and district lookup

TrafficMaterializationSystem
  → accepted lane manifest and current civilian proxy positions

MotorizedPoliceSystem
  → response identity, role, route, cruiser health, local container and dismount decision

MotorizedPoliceLocalPolicy
  → macro/local blocker boundary and roadblock-arrival guard

PoliceSystem
  → foot-officer creation after dismount
  → normal search, containment, attack and patrol AI
```

Explicitly not authoritative:

- civilian traffic does not own police response units;
- `VehicleSystem.vehicles` does not contain response cruisers;
- campaign save/checkpoints do not persist transient cruisers;
- the motorized layer does not run a second foot-officer AI.

## Macro routing

`MotorizedPolicePolicy.js` owns pure deterministic rules:

- desired cruiser count;
- pursuit/roadblock role assignment;
- breadth-first district routing;
- graph-edge and lane-direction lookup;
- route-leg construction;
- bounded multi-leg advancement;
- `72%` final-leg stop for the partial roadblock;
- officer reservation count.

Origins are selected from distant district candidates. A cruiser follows explicit forward/reverse lane polylines and never crosses buildings in a straight line.

Distant travel is abstract. Local parked cars and civilian proxies begin blocking only when the candidate cruiser position enters the local materialization window. This prevents an authored depot vehicle from freezing a response in another district while still enforcing local road occupancy near the player.

## Local materialization

`MotorizedPoliceSystem` owns a fixed pool of two police-cruiser containers.

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
- its point is resident in city streaming;
- it lies within the local radius.

Rooftop or sewer traversal hides local containers while preserving macro response state, allowing the player to break line pressure vertically without deleting the pursuing units.

## Pursuit cruiser

At wanted level 2 and above, unit zero receives the `pursuit` role.

It:

- targets the player or remembered suspect vehicle district;
- follows the macro lane route;
- respects local civilian traffic, authored vehicles and the other response unit after materialization;
- dismounts at an interception boundary, near an on-foot suspect, when locally trapped, or when disabled;
- leaves its cruiser as a local obstacle while the wanted response remains active.

## Partial roadblock

At wanted level 3, unit one receives the `roadblock` role.

It:

- uses a separate deterministic origin and route;
- stops at `72%` of its final route leg;
- rotates across the lane;
- blocks only part of the road;
- deploys its crew after reaching the cross-lane stop and the player approaches.

A roadblock cannot deploy early merely because it entered the 210-unit trigger radius. If local traffic permanently traps it for at least `1.15 s`, officers may dismount before arrival and continue on foot.

Only one roadblock exists, preserving another lane plus rooftop/sewer escape options.

## Officer reservation and transfer

`PoliceSystem.spawnMotorizedOfficers()` creates two officers per cruiser with:

- stable IDs derived from the unit;
- `motorizedUnitId`;
- deployment reason and motorized role;
- the normal police NPC type and existing AI state;
- an immediate player investigation/chase target.

Dismount is idempotent. Repeated calls return the existing officer IDs and cannot duplicate police.

The release-candidate stress harness reports:

```text
footPolice      active police NPCs
reservedPolice  officers still inside response cruisers
police          effective total pressure
```

This preserves the historic 5/7 pressure contract while accurately representing crews travelling inside vehicles.

## Abandoned suspect vehicle memory

While the player drives at wanted level 2–3, the system records vehicle ID, position, angle and expiry. After exit, cruisers target that remembered vehicle for four seconds before returning to player focus.

This creates a short window to abandon the car and escape by rooftop or sewer while foot officers continue through normal police AI.

## Collision and disablement

The motorized system extends the public `VehicleSystem.canOccupy()` chain after civilian traffic hooks.

Visible cruisers:

- block player-vehicle occupancy;
- remain obstacles after crew deployment;
- take high-speed impact damage;
- damage and slow the player vehicle;
- add exposure and local police heat;
- use a per-unit cooldown.

A disabled cruiser:

- stops route progression;
- uses wreck presentation;
- remains a local obstacle while visible;
- immediately deploys any officers still inside.

Cruiser health is transient wanted-response state and is discarded when the response retires.

## Runtime order

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

The macro graph and civilian road state are current before cruisers move. Newly dismounted officers are then consumed by the normal police/NPC frame.

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

Snapshots expose wanted level, desired units, reserved officers, suspect memory, unit routes/progress, visibility, health, dismounts, disabled units and officer IDs.

## Automated coverage

Unit tests cover:

- wanted-level counts and roles;
- shortest district routing and lane direction;
- multi-leg progression and partial roadblock stop;
- officer reservation transitions;
- distant macro movement versus local blockers;
- roadblock arrival/trapped dismount rules.

Chromium verifies:

- level-two pursuit deployment and bounded foot target;
- two-officer pursuit dismount;
- level-three partial roadblock arrival and cross-lane angle;
- vehicle occupancy blocking;
- disablement without duplicate officers;
- rooftop hiding without deleting response state;
- abandoned suspect-car memory;
- historic level-three stress using effective police pressure;
- no page errors or runtime ownership conflicts.

## Deliberately deferred

- freeform intra-district lane selection;
- multiple simultaneous roadblocks;
- spike strips and drive-by weapons;
- police cruiser campaign persistence;
- impound/retrieval and prisoner transport;
- helicopter/cruiser tactical coordination;
- full damage VFX;
- faction-specific response fleets.

## Acceptance record

Milestone 13.6 was accepted through PR #31.

Implementation head `f657785d234330311d7aa198a2f566471acff267` passed workflow run `29980266182`:

```text
unit-tests         success
browser-boot       success
browser-systems    success
browser-campaign   success
```

Acceptance proves one pursuit cruiser at wanted 2, pursuit plus partial roadblock at wanted 3, bounded 5/7 effective police pressure, deterministic lane routing, exact-once officer transfer, disablement, rooftop escape visibility and short abandoned-car memory.

## Graph-derived city response

City Topology V2 uses longer macro routes than the original authored district. Motorized response therefore applies an emergency route multiplier scaled by wanted level. Pursuit cruisers must still reach and materialize near the player within the accepted response window. Roadblock cruisers deploy their reserved officers immediately after reaching the assigned block position; they do not wait for the player to enter a second proximity radius.
