# Vehicle dynamics and traffic behavior slice

## Integration base

This clean integration is based directly on `main` after PR #70 (`Vehicle roster foundation: 15 civilian types + police escalation`) landed as commit `7a5ffde6f8834231bc829d8b43a971abd7a8414f`.

The implementation was extracted from the earlier stacked branch `codex/vehicle-dynamics-behavior`. The clean branch contains only the dynamics slice and does not replay the foundation history.

## Goal

Turn the expanded vehicle roster into more visibly differentiated and believable street behavior without replacing existing traffic, collision, road, Heat or police authority.

## Implemented

### Visible obstacle steering

`TrafficSteeringPresentationSystem` wraps local traffic decisions rather than replacing lane authority.

- Parked vehicles can trigger a deterministic left/right passing maneuver.
- A player vehicle can be passed only while nearly stopped; moving traffic remains a follow/brake target.
- Lateral movement ramps over time instead of snapping sideways.
- Vehicles visibly rotate into the maneuver, settle while passing and counter-steer back to the lane.
- Candidate paths reuse existing vehicle occupancy authority for world and building clearance.
- Active ambient traffic and intact dumpsters are checked before committing to a side.
- `TrafficPhysicalConsequencesSystem` remains the hard physical-stop and contact authority.

### Mass-aware traffic contact

`TrafficMassCollisionPolicy` consumes the `mass` and `collisionPush` metadata introduced by PR #70.

- Heavy vehicles such as pickups and SUVs push light ambient cars farther.
- Heavy vehicles retain more momentum after a successful push.
- Light vehicles lose more momentum against heavy traffic.
- Responses are bounded so catalogue extremes cannot bypass existing physical-contact limits.
- Archetypes without the new metadata resolve to neutral `1.0` values for compatibility.

The policy wraps existing traffic-contact behavior; it does not duplicate collision detection, damage or Heat consequences.

### More aggressive motorized police

`MotorizedPoliceAggressionPolicy` layers pressure on the existing pursuit tactics.

- Local tactical engagement begins farther away.
- Rear-quarter pressure and intercept movement close faster and turn more decisively.
- PIT commit speed increases while preserving its lower committed turn rate.
- PIT and ram telegraphs remain readable but are shorter.
- PIT and ram cooldowns are reduced so Wanted 2 produces sustained pressure instead of isolated attempts.
- Damage, roadblocks, officer deployment and Heat remain owned by their existing systems.

PR #70 already guarantees two motorized units at Wanted 2 and adds the SUV roadblock unit at Wanted 3.

## Runtime ownership order

Traffic composition:

1. `TrafficLocalBehaviorSystem`
2. `TrafficSteeringPresentationSystem`
3. `TrafficPhysicalConsequencesSystem`
4. `TrafficMassCollisionPolicy` wraps physical push and momentum behavior
5. `TrafficImpactConsequencesSystem`

Police composition:

1. `MotorizedPoliceSystem`
2. `MotorizedPoliceLocalPolicy`
3. `MotorizedPoliceAggressionPolicy`

Destroy order reverses policy ownership so wrapped methods are restored before their underlying systems are destroyed.

## Coverage

- `tests/traffic-steering-presentation.test.js`
  - stable distributed avoidance side;
  - no lateral teleport;
  - visible steer and counter-steer recovery;
  - close-obstacle gating until lateral clearance exists;
  - stopped-player behavior while moving traffic remains follow-only;
  - source contract for world, traffic and street-furniture clearance;
  - runtime update and destroy ordering.
- `tests/traffic-mass-collision-policy.test.js`
  - neutral compatibility defaults;
  - pickup/compact heavy-versus-light response;
  - sports-versus-SUV distinction;
  - bounded extremes;
  - runtime policy ownership order.
- `tests/motorized-police-aggression-policy.test.js`
  - faster rear-quarter and PIT pressure;
  - readable but shorter telegraphs;
  - shorter cooldowns;
  - install and destroy restoration;
  - runtime policy ownership order.
- Browser coverage extends traffic behavior, traffic physics and motorized police scenarios.

## Validation

Repository CI is triggered by the dedicated pull request for the clean branch. Manual review should verify:

1. traffic steering around a parked vehicle and returning to lane without clipping buildings or dumpsters;
2. ambient traffic passing a stopped player vehicle while refusing unsafe overtakes of a moving one;
3. visibly different compact/sports versus SUV/pickup contact responses;
4. Wanted 2 pressure from two motorized units with recurring but readable PIT attempts;
5. Wanted 3 SUV roadblock readability under the aggression policy.

## Non-goals

- No lane-changing traffic simulation or overtaking of moving civilian traffic.
- No destruction of street furniture as part of avoidance.
- No increased police collision damage.
- No changes to Heat thresholds or Wanted escalation.
