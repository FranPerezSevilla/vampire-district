# Traffic lane / junction topology

## Problem

Civilian traffic currently has two incompatible abstractions:

- the macro district graph advances cheap traffic flow but only knows street-to-street connectivity;
- the local traffic system knows the actual directed lane polylines used to keep cars on the correct side of the road.

Treating the macro graph as local driving geometry caused cars to cut across sidewalks/buildings, shortcut intersections and enter the wrong side of a street. Returning to edge-local macro tokens fixed those illegal paths, but leaves a continuity problem at junctions because a token still wraps from phase 1 back to phase 0 on one edge.

## Goal

Create one explicit **directed lane-to-lane junction topology** that can safely become the handoff contract between macro route identity and local physical movement.

This slice creates and validates that topology. It does **not** yet make it movement authority.

## Authority rules

1. `traffic-lanes.json` remains the authored source of local road-side geometry.
2. Every `edgeId + direction` is a distinct directed lane.
3. Lane starts/ends attach only to an existing authored traffic junction inside its geometric envelope.
4. An incoming lane may continue only into a directed lane whose **start** belongs to the same junction.
5. Immediate U-turns are excluded whenever another valid continuation exists.
6. A turn is represented by an explicit sampled connector from the incoming lane endpoint to the outgoing lane start.
7. Connector control geometry is the authored junction centre, so the curve remains inside the convex junction envelope rather than drawing a macro-level shortcut across a block.
8. Unsafe connectors are never exposed as runtime micro-lanes.
9. Current civilian movement remains owned by `TrafficLocalBehaviorSystem` and the authored edge lanes until a later activation slice consumes these connectors.

## Runtime representation

`TrafficLaneJunctionTopology` derives:

- directed lanes;
- start/end junction ownership;
- all lane-level continuation candidates;
- deterministic continuation choice for a stable traffic token;
- turn classification (`straight`, `left`, `right`, `u-turn`);
- sampled connector geometry;
- connector safety/envelope metrics.

Validated connectors are exposed in the loaded lane manifest as read-only `traffic-connector:*` micro-lanes. No traffic token is assigned to them in this slice, so introducing the topology cannot alter current driving behaviour.

## Why micro-lanes

The existing local behaviour system already follows lane polylines correctly. Representing a junction traversal as a short lane means the eventual route sequence can be:

`incoming authored lane -> connector micro-lane -> outgoing authored lane`

That avoids a second steering implementation and, crucially, gives every stage exact endpoint continuity. A stable token can change route segment without its local position jumping.

## Lifecycle integration target

When this topology becomes movement authority, a materialized car should follow:

`SPAWNING -> CRUISING -> APPROACH_JUNCTION -> CROSSING_JUNCTION -> CRUISING -> RECENTLY_VISIBLE -> LEAVING_VIEW -> DESPAWN`

During `CROSSING_JUNCTION`:

- token identity is stable;
- pool slot is stable;
- despawn/eviction is forbidden;
- the token cannot wrap to phase 0 on its old street;
- movement samples the connector micro-lane;
- edge handoff occurs only after reaching the connector endpoint.

Situational `FOLLOWING`, `AVOIDING` and `BLOCKED` states remain legal and protected.

## Activation gate

Do not re-enable `MacroTrafficRouteContinuityPolicy` or `TrafficIntentDrivingPolicy` merely because this topology exists.

Before route activation, tests must prove:

- a chosen continuation begins at the same junction where the incoming lane ends;
- U-turns are avoided when alternatives exist;
- connector first/last points equal the exact lane endpoints;
- every active connector stays inside the junction envelope;
- stable identity can traverse `lane -> connector -> lane` without coordinate discontinuity;
- crossing traffic cannot be despawned or pool-evicted;
- junction occupancy/yielding does not stop a vehicle indefinitely in the middle of a connector;
- production browser traffic remains on the correct side of roads and never crosses buildings/sidewalks.

## Current acceptance criteria

- [x] Directed lane topology is derived from the authored manifest.
- [x] Lane endpoints attach to authored junctions geometrically.
- [x] Legal outgoing lane candidates are explicit.
- [x] U-turn avoidance is deterministic.
- [x] Connector curves begin/end on exact lane endpoints.
- [x] Connector envelope safety is measurable.
- [x] Validated connectors are available as runtime micro-lanes.
- [x] Existing local lane movement remains authoritative.
- [x] Focused unit coverage exists.
- [ ] Route identity consumes connector micro-lanes (next activation step after CI/manual geometry review).
