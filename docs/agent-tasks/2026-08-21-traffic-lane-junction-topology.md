# Traffic lane / junction topology

## Canonical continuation package

This initiative is designed to continue across independent conversations/agents without relying on chat history.

PR: **#73 — Traffic lane/junction topology foundation**  
Branch: `codex/traffic-junction-topology`

Before changing code, a continuation agent must read, in order:

1. `docs/progress/traffic-lane-junction-topology-status.json` — machine-readable current milestone and exact `nextTask`.
2. `docs/roadmaps/TRAFFIC_LANE_JUNCTION_TOPOLOGY_ROADMAP.md` — M0–M9 implementation sequence and gates.
3. `docs/agents/TRAFFIC_LANE_JUNCTION_TOPOLOGY_AGENT.md` — authority boundaries, forbidden shortcuts and execution protocol.
4. This task boundary.
5. `docs/progress/TRAFFIC_LANE_JUNCTION_TOPOLOGY_PROGRESS.md` — append-only implementation/evidence history.

A new conversation should not ask the user to restate the architecture. Fetch PR #73 live, read the canonical files and execute the machine-readable `nextTask`.

## Current state

M0, the read-only topology foundation, is complete and validated.

Implementation head `f481add4c79d6705de017e67e08810de35a24347` passed GitHub Tests #2046 / run `32472690729`:

- unit tests — green;
- browser boot — green;
- browser campaign — green;
- browser systems shards 1/3, 2/3, 3/3 — green.

No connector currently controls visible traffic movement. The next milestone is **M1: production topology audit and hard safety contract**. The exact first task is `M1.1-production-manifest-audit` in the status JSON.

## Problem

Civilian traffic currently has two incompatible abstractions:

- the macro district graph advances cheap traffic flow but only knows street-to-street connectivity;
- the local traffic system knows the actual directed lane polylines used to keep cars on the correct side of the road.

Treating the macro graph as local driving geometry caused cars to cut across sidewalks/buildings, shortcut intersections and enter the wrong side of a street. Returning to edge-local macro tokens fixed those illegal paths, but leaves a continuity problem at junctions because a token still wraps from phase 1 back to phase 0 on one edge.

## Goal

Create one explicit **directed lane-to-lane junction topology** that safely becomes the handoff contract between stable route identity and local physical movement.

Final target:

`incoming directed authored lane -> validated junction connector micro-lane -> outgoing directed authored lane`

with stable vehicle identity and no coordinate discontinuity.

M0 only creates and validates that topology. It does **not** make it movement authority.

## Authority rules

1. `traffic-lanes.json` remains the authored source of local road-side geometry.
2. Compiler-owned road/junction geometry remains the upstream authority for generated roads and junctions.
3. Every `edgeId + direction` is a distinct directed lane.
4. Lane starts/ends attach only to an existing authored traffic junction inside its geometric envelope.
5. An incoming lane may continue only into a directed lane whose **start** belongs to the same junction.
6. Immediate U-turns are excluded whenever another valid continuation exists.
7. A turn is represented by an explicit sampled connector from the incoming lane endpoint to the outgoing lane start.
8. Connector geometry must remain inside validated authored junction authority rather than drawing a macro-level shortcut across a block.
9. Unsafe connectors are never exposed as activatable runtime micro-lanes.
10. Current civilian movement remains owned by existing local lane-following behaviour until the roadmap's controlled activation milestones.
11. Route identity may choose legal segments but never invent local world coordinates.
12. Macro traffic may later own stable route population/load state, but never local driving geometry.

## Explicitly forbidden architecture

Do not solve continuity by:

- re-enabling `MacroTrafficRouteContinuityPolicy` wholesale;
- re-enabling `TrafficIntentDrivingPolicy` wholesale;
- steering freely in world space toward the next road/lane;
- snapping a car to a remote outgoing-lane sample;
- treating district/node centres as drivable points;
- increasing camera retention margins instead of preserving stable identity;
- deriving a route from building facades or presentation-only pavement;
- hand-editing generated topology instead of fixing its owning generator/contract.

These rules exist because the previous implementation produced the exact playtest failures this initiative is meant to remove.

## Runtime representation

`TrafficLaneJunctionTopology` currently derives:

- directed lanes;
- start/end junction ownership;
- lane-level continuation candidates;
- deterministic continuation choice for a stable traffic token;
- turn classification (`straight`, `left`, `right`, `u-turn`);
- sampled connector geometry;
- connector safety/envelope metrics.

Validated connectors are exposed in the loaded lane manifest as read-only `traffic-connector:*` micro-lanes. No traffic token is assigned to them in M0, so introducing the topology cannot alter current driving behaviour.

## Why micro-lanes

The existing local behaviour system already follows lane polylines correctly. Representing a junction traversal as a short lane means the eventual route sequence can be:

`incoming authored lane -> connector micro-lane -> outgoing authored lane`

This avoids a second steering implementation and gives every stage exact endpoint continuity. A stable token can change route segment without its local position jumping.

## Stable identity target

Once activation starts, traffic identity must not be derived from the current edge.

A route agent will retain at minimum:

- stable `tokenId`;
- current directed lane key;
- route stage (`lane` / `connector`);
- connector ID while crossing;
- outgoing lane key;
- route hop/deterministic seed;
- stage progress;
- previous lane/history needed by route rules.

The macro layer may project these agents back into aggregate edge/district traffic-load diagnostics for compatibility.

## Lifecycle integration target

When this topology becomes movement authority, a materialized car should follow:

`SPAWNING -> CRUISING -> APPROACH_JUNCTION -> CROSSING_JUNCTION -> CRUISING -> RECENTLY_VISIBLE -> LEAVING_VIEW -> DESPAWN`

During `CROSSING_JUNCTION`:

- token identity is stable;
- pool slot is stable;
- normal despawn/eviction is forbidden;
- the token cannot wrap to phase 0 on its old street;
- movement samples the connector micro-lane through existing lane-following authority;
- edge/lane handoff occurs only after reaching the connector endpoint.

Situational `FOLLOWING`, `AVOIDING` and `BLOCKED` states remain legal and protected.

Forced lifecycle exits remain legal for explicit layer switch, hijack/ownership transfer, teardown/destruction and scene shutdown.

## Activation ladder

The topology must not jump directly from M0 to default traffic activation.

The canonical roadmap requires:

1. **M1 production audit** — prove real lane/junction data is safe and diagnosable.
2. **M2 pure stable route agents** — preserve identity across lane/connector/lane with no runtime movement.
3. **M3 shadow macro bridge** — run stable routes beside existing macro flows without feeding visible traffic.
4. **M4 local traversal harness** — physically cross representative connectors in isolation using lane-following authority.
5. **M5 lifecycle/pool integration** — protect stable visible crossing identity.
6. **M6 opt-in browser activation** — activate only controlled browser scenarios first.
7. **M7 occupancy/yielding** — avoid connector conflicts/deadlocks.
8. **M8 default runtime activation** — migrate normal civilian traffic only after all earlier gates pass.
9. **M9 cleanup + user gate** — retire obsolete experiments and stop for explicit gameplay approval.

Full task definitions and exit criteria live in the roadmap.

## Junction conflict target

For the MVP, prefer a simple deterministic connector reservation/yield model rather than inventing traffic lights unless authored city data already owns them.

- reserve before entering;
- wait on incoming lane if conflict is occupied;
- once inside, normally clear the connector rather than voluntarily stopping in its middle;
- release on exit/forced teardown;
- recover stale reservations;
- preserve real physical `BLOCKED` handling when exit is obstructed.

## Production safety / activation gate

Before connector route activation, tests must prove:

- chosen continuation begins at the same junction where incoming lane ends;
- U-turns are avoided when alternatives exist;
- connector first/last points equal exact lane endpoints;
- every active connector stays inside junction authority;
- endpoint ownership is not ambiguous for activatable routes;
- stable identity traverses `lane -> connector -> lane` without coordinate discontinuity;
- crossing traffic cannot be normally despawned or pool-evicted;
- junction occupancy/yielding cannot deadlock vehicles indefinitely mid-connector;
- production browser traffic stays on the correct side of roads;
- no route transition crosses buildings/sidewalks as a shortcut;
- no visible teleport event occurs;
- traffic population/pool remains bounded.

## Main synchronization rule

At every milestone boundary and before final merge, compare PR #73 with live `main`.

Integrate/revalidate first if `main` changed:

- `tools/city-compiler/generate-road-topology.js`;
- traffic lane pack/generator;
- streaming/materialization/lifecycle traffic code;
- local lane-following behaviour;
- road/junction gameplay collision/navigation authority.

Do not change a red test expectation until confirming whether the branch is stale against a newly merged `main` invariant.

## Documentation discipline

Every bounded agent task must update:

- machine-readable status JSON;
- append-only progress log;
- focused tests/evidence.

Update this task/roadmap only if the architecture or milestone contract actually changes.

`nextTask` must always be concrete enough for another agent to start without chat context.

## Current M0 acceptance criteria

- [x] Directed lane topology is derived from the authored manifest.
- [x] Lane endpoints attach to authored junctions geometrically.
- [x] Legal outgoing lane candidates are explicit.
- [x] U-turn avoidance is deterministic.
- [x] Connector curves begin/end on exact lane endpoints.
- [x] Connector envelope safety is measurable.
- [x] Validated connectors are available as runtime micro-lanes.
- [x] Existing local lane movement remains authoritative.
- [x] Focused unit coverage exists.
- [x] Full Tests workflow #2046 is green.
- [ ] Production topology audit complete (M1).
- [ ] Stable route identity consumes legal connector sequences (M2+).
- [ ] Default traffic activation validated (M8).
- [ ] User gameplay approval received (M9).

## Final gate

PR #73 must not auto-merge.

At `final-validation-pending`, autonomous implementation stops and the user receives a gameplay validation checklist/preview. Merge requires explicit user approval.
