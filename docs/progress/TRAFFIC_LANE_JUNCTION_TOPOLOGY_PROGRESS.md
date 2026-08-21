# Traffic lane / junction topology progress

Append-only execution log for PR #73 (`codex/traffic-junction-topology`).

Canonical current state lives in `docs/progress/traffic-lane-junction-topology-status.json`; this file records how that state was reached and why decisions were made.

---

## 2026-08-21 — M0 foundation implemented

### Problem carried from PR #71

An earlier continuity experiment used macro street connectivity as local driving authority. Manual playtest showed the abstraction was invalid: civilian cars could cross sidewalks/buildings, shortcut between intersections and enter the wrong side of roads.

The unsafe runtime activation was removed before PR #71 merged. #71 intentionally left authored local lanes as movement authority and established lifecycle retention/police behaviour independently.

### Decision

Create a new lane-level topology rather than trying to make the macro graph more geometric.

Target path:

`directed authored lane -> validated connector micro-lane -> directed authored lane`

The macro layer may later own stable route identity/load, but it will never own local path coordinates.

---

## 2026-08-21 — M0.1–M0.5 directed topology and connector geometry

### Implemented

Added `phaser/src/streaming/TrafficLaneJunctionTopology.js` with:

- directed lane identity (`edgeId + direction`);
- geometric lane start/end ownership by authored junction;
- incoming/outgoing lane indexing per junction;
- deterministic legal continuation selection;
- immediate U-turn avoidance when alternatives exist;
- straight/left/right/U-turn classification;
- sampled connector curves from exact incoming endpoint to exact outgoing start;
- junction-envelope safety measurement;
- connector IDs suitable for micro-lane injection.

### Key architectural choice

Connectors use exact lane endpoints and authored junction authority. They are not curves toward macro district/node centres. This guarantees that the eventual route stage change can occur without resetting the vehicle to a remote coordinate.

### Tests

Added `tests/traffic-lane-junction-topology.test.js` covering:

- directed endpoint ownership;
- legal outgoing choices;
- deterministic U-turn avoidance;
- exact connector endpoints;
- junction-envelope confinement;
- curve bending through junction authority rather than block-level shortcut geometry.

---

## 2026-08-21 — M0.6 read-only runtime installation

### Implemented

`TrafficLocalAssignmentPolicy` installs the lane/junction topology after lane-manifest initialization.

Validated connector micro-lanes are injected into the loaded lane manifest as `traffic-connector:*` edges for lookup/diagnostics.

### Safety boundary

No traffic token is assigned to connector micro-lanes yet.

Current movement remains owned by the pre-existing authored local lane path. This makes M0 safe to ship/test without altering driving behaviour.

Diagnostics explicitly report:

- topology readiness;
- lane/junction/connection counts;
- unsafe connector count;
- injected connector count;
- current lane authority remains `authored-local-lanes`.

---

## 2026-08-21 — M0.7/M0.8 validation complete

### CI evidence

Implementation head: `f481add4c79d6705de017e67e08810de35a24347`

GitHub Tests #2046 / run `32472690729`:

- `unit-tests` — success;
- `browser-boot` — success;
- `browser-campaign` — success;
- `browser-systems (shard 1/3)` — success;
- `browser-systems (shard 2/3)` — success;
- `browser-systems (shard 3/3)` — success;
- building visual review — skipped by workflow conditions.

### Result

M0 is complete: topology exists, is tested, is loaded read-only and does not change visible traffic movement.

---

## 2026-08-21 — Autonomous continuation package created

### Reason

PR #73 is expected to continue over multiple sessions/agents. Chat history must not be required to understand architecture, current state or the next safe task.

### Added canonical handoff files

- `docs/roadmaps/TRAFFIC_LANE_JUNCTION_TOPOLOGY_ROADMAP.md`
- `docs/agents/TRAFFIC_LANE_JUNCTION_TOPOLOGY_AGENT.md`
- `docs/progress/traffic-lane-junction-topology-status.json`
- this append-only progress log

The original task boundary remains:

- `docs/agent-tasks/2026-08-21-traffic-lane-junction-topology.md`

### Roadmap shape

- M0 — read-only topology foundation — complete
- M1 — production topology audit and hard safety contract — next
- M2 — pure stable route-agent model
- M3 — shadow macro continuity bridge
- M4 — local continuous traversal harness
- M5 — lifecycle/materialization/pool retention
- M6 — opt-in browser activation
- M7 — junction occupancy/yielding/conflicts
- M8 — default runtime activation + macro migration
- M9 — legacy cleanup + user gameplay validation gate

### Locked rules

- macro graph does not provide local path geometry;
- no free-form drive-toward-next-lane steering;
- no position snap at route-stage boundaries;
- connector geometry must stay inside authored junction authority;
- current local lane follower is reused rather than replaced;
- stable token + pool slot survive crossing;
- no normal crossing despawn/eviction;
- `MacroTrafficRouteContinuityPolicy` and `TrafficIntentDrivingPolicy` are not re-enabled wholesale;
- final merge requires explicit user gameplay approval.

---

## 2026-08-21 — M1.1 production manifest audit complete

### Implementation

Head `6e098646c93aebfe1db58585a11e2b85dfba173e` added deterministic production diagnostics in `TrafficLaneJunctionTopology` and `tests/traffic-lane-junction-production-audit.test.js`.

The audit reports unmatched/ambiguous endpoints, orphan lanes, rejected connectors, duplicate identities, endpoint continuity, tangent continuity and turn-type distribution without changing visible traffic.

### CI evidence

GitHub Tests #2053 / run `32475274379` — full workflow success:

- unit-tests — success;
- browser-boot — success;
- browser-campaign — success;
- browser-systems 1/3 — success;
- browser-systems 2/3 — success;
- browser-systems 3/3 — success.

### Production findings

Legacy `traffic-lanes.json.edges` audit:

- 48 directed legacy lanes;
- 71 junction markers;
- 99 candidate connectors;
- 19 orphan directed lanes;
- 24 unmatched endpoints;
- 14 ambiguous endpoint/junction matches;
- 0 endpoint-position continuity failures;
- 96 tangent continuity failures;
- 71/99 candidate connectors classified as U-turns;
- 0 duplicate connector IDs;
- 0 duplicate lane-pair IDs.

### Architectural diagnosis

Inspection of `tools/city-compiler/district-streaming.js` showed that legacy traffic `edges` are built by `buildMacroAndLanes(...)` as long district-anchor/portal paths. A single edge can traverse multiple real road-network nodes. Therefore its start/end are not a physical lane segment's two junction endpoints.

The runtime M0 inference "legacy edge endpoint -> nearby junction envelope" is consequently not a valid production activation model. The large ambiguity/orphan/tangent counts are symptoms of the data-contract mismatch, not tuning values to hide with larger radii.

### Decision

Do not repair M0 activation by increasing endpoint tolerances or merely smoothing its quadratic curves.

The real local topology must be derived one-to-one from compiler `network.segments`, where `from` and `to` node IDs are explicit.

M2 is blocked until this M1 correction is complete.

---

## 2026-08-21 — M1.2 compiler-owned directed lane graph started

### Implemented

Added `tools/city-compiler/traffic-lane-topology.js`.

The pure compiler topology:

- emits exactly two directed lanes for each district-streaming `network.segment`;
- uses compiler `fromNodeId` / `toNodeId` ownership rather than nearest-junction geometry;
- offsets both directions to the right-hand side of travel;
- preserves source segment, road edge, district, width/class/kind metadata;
- builds legal outgoing lane IDs at the exact shared compiler node;
- marks same-source-segment reversal as U-turn;
- excludes immediate U-turns from preferred choices whenever another road segment exists;
- identifies explicit dead-end nodes where reversal may be the only preferred continuation;
- emits deterministic, serializable transition records;
- includes validation for node ownership, right-side lane offset and preferred-U-turn legality.

Added `tests/traffic-lane-topology-compiler.test.js` against the real production city compiler output.

### Focused evidence so far

Implementation head `6033d7983b1eb7ecebab53df783897940a139d01`:

- unit-tests in GitHub Tests #2062 / run `32477998686` — success;
- full browser jobs were still running when this checkpoint was written.

### Safety boundary

This compiler topology is not yet written into the production `traffic-lanes.json` pack and is not loaded by runtime vehicle movement.

Legacy `traffic-lanes.json.edges` remain untouched for compatibility. The next safe step after full CI is additive generated-pack integration, not replacement.

### Next sequence inside M1

1. M1.2 — finish full CI validation of compiler-owned directed lanes.
2. M1.3 — add the compiler topology to generated streaming output/validation without deleting legacy edges.
3. M1.4 — generate tangent-preserving connector geometry from compiler lanes; tangent discontinuity becomes a hard rejection reason.
4. M1.5 — retire legacy nearest-junction endpoint inference from the future activation path while retaining compatibility data until M8.

Canonical details: `docs/agent-tasks/2026-08-21-traffic-lane-junction-m1-compiler-contract.md`.

---

## 2026-08-21 — M1.2–M1.5 compiler-owned topology completed

### M1.2 — directed local lane graph

The compiler-owned graph was completed and validated in GitHub Tests #2065 / run `32478211117`.

Physical route ownership is now based on `district-streaming network.segments`, with explicit compiler node IDs. The legacy district-pair traffic edges are no longer candidates for physical junction routing.

### M1.3 — additive generated-pack integration

`tools/city-compiler/traffic-lane-topology-integration.js` adds `localTopology` to traffic-lane pack schema v6 while preserving legacy `edges` and `junctions` for compatibility.

GitHub Tests #2068 / run `32478720212` passed the full workflow.

### M1.4 — production-safe junction connectors

`tools/city-compiler/traffic-junction-connectors.js` generates tangent-preserving cubic connectors from trimmed right-hand lanes and validates every sampled point against compiler-owned road surfaces.

Production hard gates require:

- exact incoming/outgoing endpoints;
- exact compiler-node ownership;
- zero sampled points outside road authority;
- zero tangent-continuity failures;
- zero rejected preferred connectors.

GitHub Tests #2071 / run `32479384583` passed all jobs with those production invariants enforced.

The connector bundle was then attached additively inside `localTopology`; GitHub Tests #2073 / run `32485167656` passed the full workflow.

### M1.5 — provisional runtime inference retired

`TrafficLocalAssignmentPolicy` no longer installs `TrafficLaneJunctionTopology` or injects connectors derived from legacy endpoint proximity.

Runtime diagnostics may observe compiler-owned `localTopology`, but `movementActive` remains false and current visible movement remains `authored-local-lanes`.

GitHub Tests #2083 / run `32485801858` passed unit, boot, campaign and all three browser-system shards.

### Result

M1 is complete. There is now one future physical route authority: compiler-owned directed lanes plus compiler-owned activation-safe junction connectors.

---

## 2026-08-21 — M2.1/M2.2 pure stable route cursor completed

### Implemented

Added `phaser/src/streaming/TrafficRouteCursor.js` and `tests/traffic-route-cursor.test.js`.

The route cursor is deliberately pure and has no Phaser, scene, materializer, camera, police or macro-district dependency.

A route agent retains:

- stable `tokenId`;
- `routeHop`;
- stage (`lane` or `connector`);
- current compiler lane ID;
- current connector and next lane while crossing;
- previous lane;
- bounded stage progress;
- archetype/traffic metadata carried without mutation.

### Continuity contract

`advanceTrafficRouteAgent(...)` consumes real elapsed seconds using stage geometry length and can cross multiple stage boundaries in one call.

A focused test proves that at speed 100, 1.5 seconds can consume a 100-unit lane, a 20-unit connector and continue 30% into the next 100-unit lane while preserving the exact same token identity.

Continuation is deterministic from stable token + route hop and consumes only compiler `preferred` transitions. A transition that requires geometry must have an activation-safe connector; a direct handoff must be explicitly validated by the compiler connector bundle.

Missing continuation/connector does not trigger fallback steering or a coordinate guess. The route cursor stops at stage end with an explicit blocked reason and preserves unconsumed time.

Input route agents and topology are never mutated.

### CI evidence

Implementation/test head: `9a7d45566b17c2a508e269c3d23b9f2d3b67ea1a`.

GitHub Tests #2087 / run `32486691651` — full workflow success:

- unit-tests — success;
- browser-boot — success;
- browser-campaign — success;
- browser-systems 1/3 — success;
- browser-systems 2/3 — success;
- browser-systems 3/3 — success.

### Safety boundary

The route cursor is not installed into `MacroTrafficPoliceSystem`, `TrafficMaterializationSystem`, `TrafficLocalAssignmentPolicy` or visible vehicle movement.

M2.3 is next: build a pure compatibility projection from these local route agents back into legacy macro load/count diagnostics. That projection is output-only; macro geometry/phases must not influence route selection.
