# Traffic lane / junction topology agent contract

Operational handoff contract for PR #73 (`codex/traffic-junction-topology`).

A new agent/conversation must be able to continue this initiative from the PR reference alone.

## Bootstrap — read these in order

Before changing code:

1. Fetch PR #73 live and record head SHA, base SHA, draft/mergeability and current CI.
2. Read `docs/progress/traffic-lane-junction-topology-status.json` — this is authoritative for current milestone and exact `nextTask`.
3. Read `docs/roadmaps/TRAFFIC_LANE_JUNCTION_TOPOLOGY_ROADMAP.md`.
4. Read `docs/agent-tasks/2026-08-21-traffic-lane-junction-topology.md`.
5. Read the latest entries in `docs/progress/TRAFFIC_LANE_JUNCTION_TOPOLOGY_PROGRESS.md`.
6. Inspect every file named by `nextTask.readFirst`.
7. Compare the branch against live `main` before beginning a new milestone.

Do not ask the user to reconstruct old chat context when the canonical files answer the question.

## Root cause already established

A previous continuity experiment treated macro district/street connectivity as local driving geometry. The macro graph does not encode physical right-hand lanes or legal turn curves, so cars could cross sidewalks/buildings, shortcut intersections and enter the wrong side of roads.

M1.1 then proved the old `traffic-lanes.json.edges` are long district-anchor/portal compatibility paths, not physical lane segments. Endpoint-to-nearest-junction inference on those paths is not a valid routing model.

The replacement architecture is:

`compiler-owned directed lane -> activation-safe compiler connector -> compiler-owned directed lane`

Stable route identity decides which legal stage comes next. Physical coordinates always come from compiler/local lane geometry.

## Current authority stack

### Physical network authority

`tools/city-compiler/district-streaming.js` builds the physical local network from the authoritative city road graph.

### Directed lane/transition authority

`tools/city-compiler/traffic-lane-topology.js` emits:

- two directed right-hand lanes per physical network segment;
- explicit compiler `fromNodeId/toNodeId` ownership;
- deterministic legal transitions at shared compiler nodes;
- preferred transitions that avoid U-turns except explicit dead ends.

### Junction connector authority

`tools/city-compiler/traffic-junction-connectors.js` emits tangent-preserving connector geometry from trimmed lane approaches and validates it against compiler-owned road surfaces.

Only `activationSafe` connectors with no rejection reasons can become route stages.

### Generated pack authority

`tools/city-compiler/traffic-lane-topology-integration.js` attaches compiler `localTopology` to traffic pack schema v6.

Legacy `traffic-lanes.json.edges` / `junctions` remain compatibility data during migration. They are not physical junction-routing authority.

### Pure route authority

`phaser/src/streaming/TrafficRouteCursor.js` owns pure stable route-agent state and elapsed-time progression.

It may choose only compiler `preferred` transitions and activation-safe connectors/direct handoffs. It never invents coordinates.

### Visible movement authority

Current authored-local-lane movement remains live until a later controlled activation milestone. The pure route cursor is not yet installed into visible traffic.

### Lifecycle authority

Lifecycle/materialization owns retention, spawn/despawn and pool state. It does not choose geometry.

### Macro authority

`MacroTrafficPoliceSystem` currently owns aggregate traffic population/load compatibility state. Macro edge IDs/phases and district centres must never become local x/y or route-choice authority.

## Forbidden shortcuts

Never solve a task by:

- re-enabling `MacroTrafficRouteContinuityPolicy` wholesale;
- re-enabling `TrafficIntentDrivingPolicy` wholesale;
- steering freely in world space toward a future lane;
- snapping a vehicle to an outgoing-lane sample;
- using macro/district centres as drivable points;
- assigning a legacy route endpoint to the nearest junction as physical ownership;
- increasing geometric tolerances to hide ambiguous ownership;
- activating a connector that failed endpoint, road-surface or tangent validation;
- hand-editing generated topology instead of fixing the compiler;
- increasing camera/despawn margins as a substitute for stable identity;
- weakening unrelated tests before checking live `main` invariants;
- choosing one macro edge arbitrarily when compatibility mapping is ambiguous;
- synthesizing a legacy phase from arbitrary world distance.

## Stable route identity contract

A route agent identity is independent of its current lane/stage.

It retains at least:

- stable `tokenId`;
- `routeHop`;
- `stage: lane|connector`;
- current compiler lane ID;
- connector ID / next lane while crossing;
- previous lane ID;
- bounded stage progress;
- optional archetype/compatibility metadata that cannot control geometry.

`advanceTrafficRouteAgent(...)` must:

- consume real elapsed time using stage geometry length;
- consume leftover time across multiple stage boundaries;
- preserve `tokenId` exactly;
- be deterministic for the same token/hop/topology;
- never mutate its input agent/topology;
- return an explicit blocked reason when continuation geometry is unavailable.

## Compatibility projection rule

Compatibility is output-only until a later milestone explicitly initializes provenance.

Allowed:

- derive district counts from compiler lane `districtId`;
- preserve/use explicit legacy macro-edge provenance as metadata;
- use local `sourceRoadEdgeId` to infer a macro edge only when membership is unique;
- report unmatched and ambiguous agents explicitly;
- compare projected counts/load with existing macro flow.

Forbidden:

- let a projected macro edge/phase pick the next compiler lane;
- choose one of multiple macro matches arbitrarily;
- convert macro centre/progress to local coordinates;
- silently drop agents from totals.

Population must be conserved across projected + ambiguous + unmatched buckets.

## Runtime activation ladder

Do not skip milestones:

- M1 compiler topology/safety — complete;
- M2 pure stable route state/projection — current;
- M3 shadow macro bridge — no visible authority;
- M4 isolated local traversal harness;
- M5 lifecycle/materialization retention;
- M6 controlled browser activation;
- M7 connector occupancy/yield/conflict handling;
- M8 default civilian migration;
- M9 cleanup + explicit user gameplay approval.

## Validation discipline

For every bounded task:

- add focused tests for the new contract;
- run unit/focused validation;
- run full CI whenever compiler/runtime loading changes or the milestone gate requires it;
- inspect the exact failing assertion/log before modifying code;
- treat unexplained red CI as a blocker;
- avoid patching unrelated systems to make the branch green.

At milestone boundaries compare with live `main`. Integrate/revalidate first if `main` changed compiler road geometry, traffic generation, local lane following, materialization/lifecycle or road/junction collision/navigation authority.

## Documentation discipline

Every bounded task updates:

- machine-readable status JSON;
- append-only progress log;
- focused tests/evidence.

Update roadmap/task/agent docs whenever the architecture or phase contract changes materially.

A sufficient fresh-session instruction is:

> Continue ViceBlood PR #73 from `docs/progress/traffic-lane-junction-topology-status.json`; execute only `nextTask`, preserve architecture gates, and update status/progress with exact CI evidence.

## Final gate

Keep PR #73 draft during autonomous implementation. Do not auto-merge.

At M9 `final-validation-pending`, autonomous work stops. Provide the user a gameplay validation checklist/preview; merge requires explicit user approval.
