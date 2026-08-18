# ViceBlood city simulation polish backlog

_Last updated: 2026-08-19_

This document records the city-simulation polish requested during PR #55. Work remains incremental: one independently testable traffic/police behavior change at a time, with the final browser performance capture retained as the evidence gate before any further density increase.

## 1. Civilian traffic must collide with other civilian traffic

**State: implemented on PR #55; pending grouped in-game validation.**

Materialized civilian cars now behave as physical road users relative to one another rather than visual proxies that can overlap.

### Requirements

- Local civilian vehicles expose a stable physical footprint to other materialized traffic vehicles.
- Two civilian cars cannot occupy or pass through the same physical space during ordinary driving.
- Following cars brake for slower/stopped traffic ahead instead of clipping through it.
- Side-by-side or crossing paths resolve through movement constraints rather than visual overlap.
- Collision avoidance must not create permanent gridlock when one car is temporarily blocked.
- Real accidental car-to-car impacts may still occur when avoidance is insufficient, but ordinary route following should try to prevent them.
- Vehicle separation/collision work must use a bounded local-neighbour query rather than an all-pairs scan across the full traffic population.

### Implementation

- Existing same-lane following remains the first-line behavior: `TrafficLocalBehaviorSystem.nearestLead()` slows the rear car before contact, while existing junction yielding handles ordinary crossing conflicts.
- A new hard separation guard runs after each local traffic behavior step. It builds a **96-unit spatial grid** from materialized civilian slots and queries only neighboring cells rather than scanning every traffic pair.
- If two civilian footprints still overlap, the guard resolves the pair immediately before the frame completes. On the same lane, the follower retreats; at crossing conflicts an existing `junction-yield` or explicit `junction-reserved` participant remains subordinate; true unresolved ties use a stable token key.
- The corrected vehicle is moved backward along its own lane rather than pushed sideways through geometry, is stopped for that update, and records `traffic-separation` plus the blocking token. Two bounded correction passes allow a newly corrected pair to settle without creating an unbounded recovery loop.
- Runtime snapshots expose `trafficNeighborChecks` and `trafficSeparationCorrections` so local-query cost and real corrections can be observed during the grouped playtest.

### Regression coverage

`tests/traffic-local-separation.test.js` verifies that the spatial query stays local with a 100-vehicle synthetic layout, that footprint overlap includes the safety pad, that same-lane corrections retreat the follower, and that junction-yield traffic loses a crossing separation conflict.

### Acceptance

- No visible civilian-car overlap during normal following, turns or junction traversal.
- A stopped car causes following traffic to queue with spacing instead of stacking into it.
- Cars can recover and continue after the obstruction clears.
- The feature does not reintroduce a quadratic per-frame traffic hotspot.

## 2. Junction priority and deadlock resolution

**State: implemented on PR #55; pending grouped in-game validation.**

Civilian cars approaching an intersection now negotiate a bounded explicit reservation instead of relying only on reciprocal proximity heuristics.

### Requirements

- Intersections have an explicit conflict/reservation model for the local materialized simulation.
- A vehicle that is already inside the junction keeps priority to clear it.
- Approaching vehicles yield to conflicting reserved paths rather than entering the same conflict space.
- When multiple vehicles arrive together, a deterministic tie-break selects one movement to proceed. Arrival order should normally win; a stable vehicle/route key breaks true ties.
- Once granted, a vehicle receives a short commitment window to cross so another approach cannot continuously steal priority.
- Reservations expire if the owner cannot enter, preventing a broken/stuck vehicle from locking the junction forever.
- Add bounded deadlock detection: if a junction has remained blocked beyond a sensible wait, release/re-evaluate reservations rather than leaving every participant stopped permanently.
- Do not require full real-world traffic-law simulation for P0; the goal is readable, deterministic flow without overlap or indefinite four-way hesitation.

### Implementation

- `TrafficJunctionReservationPolicy` layers one conservative conflict reservation per materialized junction over the existing local traffic authority. It reuses the current lane projections and never creates a second traffic simulation.
- A vehicle physically inside the junction wins immediately. Otherwise, the first recorded arrival owns the movement; exact arrival ties use the stable traffic token ID.
- A granted vehicle receives a **1.45 s commitment lease**. Meaningful approach progress renews that lease, while conflicting lanes receive `junction-reserved` and brake before the conflict area. Same-lane followers remain governed by the existing lead-car spacing logic.
- If the owner remains outside the junction without meaningful progress for **2.35 s** after its lease can expire, the reservation is released as a deadlock recovery. The stalled owner receives a short **0.9 s backoff**, allowing another waiting movement to take authority instead of immediately re-acquiring the same junction.
- Existing stronger blockers remain authoritative: a same-lane queue, parked/player vehicle or `junction-player` conflict is not bypassed merely because a civilian owns the reservation.
- The hard separation guard treats `junction-reserved` as subordinate to `junction-priority`, so the emergency anti-overlap correction preserves the same authority if two crossing cars still touch.
- Runtime traffic snapshots expose reservation count, priority/yield counts, grants, releases, deadlock recoveries and current reservation owners for grouped playtest diagnostics.

### Regression coverage

`tests/traffic-junction-reservation.test.js` verifies inside-junction priority, arrival-order ownership, stable token tie-breaking, commitment-window retention, stale-owner recovery/backoff and the interaction between `junction-reserved` traffic and the hard separation guard.

### Acceptance

- Four cars reaching a junction no longer all stop forever.
- One car visibly commits, clears the conflict area, and the next waiting movement receives priority.
- Vehicles do not drive through one another while crossing.
- Removing/blocking the current priority vehicle cannot permanently lock the intersection.

## 3. Contextual civilian horn use

**State: queued.**

The existing `vehicleHorn` family should become part of traffic behaviour rather than being exclusive to player input.

### Requirements

- Civilian drivers may produce a short horn after being blocked for a noticeable period by traffic ahead or by a stalled junction.
- Horns are reactions to local frustration/obstruction, not random ambient events.
- Use cooldowns and probability/driver variation so a queue does not become a continuous wall of horns.
- A horn does not grant right-of-way, create Heat, or force another vehicle to move.
- Playback remains spatial and uses the existing authentic `vehicleHorn` variants.

### Acceptance

- A genuine traffic jam can occasionally produce an audible horn from the blocked vehicle.
- Free-flowing traffic does not randomly honk without cause.
- Several blocked vehicles do not spam overlapping horns every update.

## 4. Foot police patrol only on pedestrian-valid routes

**State: queued.**

Normal police foot patrols must not wander longitudinally through vehicle lanes. Their patrol/navigation authority should use sidewalks and legitimate pedestrian crossings just like a believable foot patrol.

### Requirements

- Idle/patrol movement is restricted to sidewalk/pedestrian-valid navigation points and crossing links.
- Officers may cross a street through a valid crossing connection but must not select the roadway itself as a normal patrol route.
- Spawning/reacquisition must prefer pedestrian-valid positions rather than the centre of a traffic lane.
- Active pursuit/combat may temporarily leave the sidewalk when necessary to chase or engage the player; this is an escalation exception, not patrol behaviour.
- After losing the target, officers return to pedestrian-valid navigation instead of continuing to wander down the road.

### Acceptance

- With no active pursuit, observed officers patrol along pavements rather than along vehicle lanes.
- Officers can still cross streets where the pedestrian graph permits it.
- A chasing officer is not artificially prevented from pursuing the player across a road.
- Once the chase ends, normal sidewalk patrol behaviour is restored.

## Delivery order

1. **Done:** add bounded local civilian-traffic separation/collision avoidance.
2. **Done:** add explicit junction reservation/priority and deadlock recovery.
3. Add contextual civilian horn reactions to meaningful blockage.
4. Constrain non-alert foot-police patrol/navigation to pedestrian-valid routes.
5. Run the final browser `slowestSystems` capture in a hitch-prone area; optimize only the repeatable winner if necessary.
6. Run one grouped city-flow playtest covering traffic queues, four-way junctions, horns, police sidewalks and frame-time impact.
