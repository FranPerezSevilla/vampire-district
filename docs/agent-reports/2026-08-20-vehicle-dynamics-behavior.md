# Vehicle dynamics and traffic behavior slice

## Base

This work is stacked on `codex/vehicle-roster-foundation` at `5e13b7d64fd02b66203fb37453d80b53963761d9`.

The foundation PR is intentionally kept separate. This slice should not be merged independently before the roster foundation it depends on.

## Goal

Turn the expanded vehicle roster into more visibly differentiated and believable street behavior without replacing existing traffic, collision or police authorities.

## Implemented

### Visible obstacle steering

`TrafficSteeringPresentationSystem` wraps local traffic decisions rather than replacing lane authority.

- parked vehicles can trigger a deterministic left/right passing maneuver;
- a player vehicle can be passed only while nearly stopped; moving traffic remains a follow/brake target;
- lateral movement ramps over time instead of snapping sideways;
- the vehicle visibly rotates into the maneuver, settles while passing and counter-steers back to the lane;
- candidate paths reuse the existing vehicle occupancy authority for world/building clearance;
- active ambient traffic and intact dumpsters are also checked before committing to a side;
- the maneuver remains subordinate to `TrafficPhysicalConsequencesSystem`, which can still impose a hard physical stop/contact.

### Mass-aware traffic contact

`TrafficMassCollisionPolicy` consumes the `mass` and `collisionPush` metadata introduced by the roster foundation.

- heavy vehicles such as pickups and SUVs push light ambient cars farther;
- heavy vehicles retain more momentum after a successful push;
- light vehicles lose more momentum against heavy traffic;
- the response is deliberately bounded so no catalogue extreme bypasses the existing physical contact limits;
- archetypes without the new metadata resolve to neutral `1.0` values, preserving old fixtures and compatibility.

The policy wraps the existing traffic-contact authority rather than duplicating collision detection, damage or Heat consequences.

### More aggressive motorized police

`MotorizedPoliceAggressionPolicy` layers pressure on the existing pursuit tactics.

- local tactical engagement begins farther away;
- rear-quarter pressure and intercept movement close faster and turn more decisively;
- PIT commit speed increases while preserving its lower committed turn rate;
- PIT and ram telegraphs remain present but are shorter;
- PIT and ram cooldowns are reduced so Wanted 2 produces sustained pressure instead of isolated attempts;
- damage, roadblock authority, officer deployment and Heat remain owned by their existing systems.

The roster foundation already guarantees two motorized units at Wanted 2 and adds the SUV roadblock unit at Wanted 3.

## Runtime ownership order

Traffic composition:

1. `TrafficLocalBehaviorSystem`
2. `TrafficSteeringPresentationSystem`
3. `TrafficPhysicalConsequencesSystem`
4. `TrafficMassCollisionPolicy` wraps physical push/momentum behavior
5. `TrafficImpactConsequencesSystem`

Police composition:

1. `MotorizedPoliceSystem`
2. `MotorizedPoliceLocalPolicy`
3. `MotorizedPoliceAggressionPolicy`

Destroy order reverses policy ownership so wrapped methods are restored before their underlying systems are destroyed.

## Tests added

- `tests/traffic-steering-presentation.test.js`
  - stable distributed avoidance side;
  - no lateral teleport;
  - visible steer and counter-steer recovery;
  - close-obstacle gating until lateral clearance exists;
  - stopped-player behavior while moving traffic remains follow-only;
  - source contract for world/traffic/street-furniture clearance;
  - runtime update/destroy ordering.
- `tests/traffic-mass-collision-policy.test.js`
  - neutral compatibility defaults;
  - pickup/compact heavy-vs-light response;
  - sports-vs-SUV distinction;
  - bounded extremes;
  - runtime policy ownership order.
- `tests/motorized-police-aggression-policy.test.js`
  - faster rear-quarter/PIT pressure;
  - readable but shorter telegraphs;
  - shorter cooldowns;
  - install/destroy restoration;
  - runtime policy ownership order.

## Validation status

The foundation branch and PR #70 are fully green, including its final documentation-only workflow run `32362619320`.

This stacked branch has source and regression coverage committed, but has not received repository CI yet. The repository workflow supports `workflow_dispatch`, however the GitHub connector available in this session does not expose the dispatch action. No temporary workflow or second PR was created merely to force a run.

Before delivery of this slice:

1. run the normal `Tests` workflow against `codex/vehicle-dynamics-behavior` or open its dedicated PR after the foundation lands;
2. visually verify a traffic car steering around a parked car and returning to lane without clipping a building/dumpster;
3. stop the player car in a lane and confirm ambient traffic can pass it, while moving traffic does not attempt unsafe overtakes;
4. compare compact/sports versus SUV/pickup traffic contacts;
5. validate Wanted 2 with two units: sustained opposite rear-quarter pressure and recurring but readable PIT attempts;
6. validate Wanted 3 SUV roadblock behavior remains readable under the aggression policy.

## Non-goals

- no lane-changing traffic simulation or overtaking of moving civilian traffic;
- no destruction of street furniture as part of an avoidance maneuver;
- no increased police collision damage in this slice;
- no changes to Heat thresholds or Wanted escalation;
- no second pull request until the roster foundation is ready to land or the user requests one explicitly.
