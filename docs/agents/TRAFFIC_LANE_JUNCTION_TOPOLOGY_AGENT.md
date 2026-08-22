# Traffic lane / junction topology agent contract

Operational handoff contract for PR #73 (`codex/traffic-junction-topology`).

A new agent/conversation must be able to continue this initiative from the PR reference alone.

## Bootstrap — read these in order

Before changing code:

1. Fetch PR #73 live and record head SHA, base SHA, draft/mergeability and current CI.
2. Read `docs/progress/traffic-lane-junction-topology-status.json` — authoritative current milestone and exact `nextTask`.
3. Read `docs/roadmaps/TRAFFIC_LANE_JUNCTION_TOPOLOGY_ROADMAP.md`.
4. Read `docs/agent-tasks/2026-08-21-traffic-lane-junction-topology.md`.
5. Read the latest entries in `docs/progress/TRAFFIC_LANE_JUNCTION_TOPOLOGY_PROGRESS.md`.
6. Inspect every file named by `nextTask.readFirst`.
7. Compare the branch against live `main` before beginning a new milestone.

Do not ask the user to reconstruct old chat context when the canonical files answer the question. Execute only the machine-readable `nextTask` unless the user explicitly grants a wider batch.

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

`tools/city-compiler/traffic-lane-topology.js` emits two directed right-hand lanes per physical network segment, explicit compiler node ownership and deterministic preferred legal transitions with U-turn avoidance except dead ends.

### Junction connector authority

`tools/city-compiler/traffic-junction-connectors.js` emits tangent-preserving connector geometry from trimmed lane approaches and validates it against compiler-owned road surfaces.

Only `activationSafe` connectors with no rejection reasons may become route stages.

### Generated pack authority

`tools/city-compiler/traffic-lane-topology-integration.js` attaches compiler `localTopology` to traffic pack schema v6.

Legacy `traffic-lanes.json.edges` / `junctions` remain compatibility data during migration. They are not physical junction-routing authority.

### Pure route authority

`phaser/src/streaming/TrafficRouteCursor.js` owns pure stable route-agent state and elapsed-time progression. It may choose only compiler `preferred` transitions and activation-safe connectors/direct handoffs. It never invents coordinates.

### Junction conflict authority

`phaser/src/streaming/TrafficJunctionReservationRegistry.js` owns deterministic conservative reservation state keyed by compiler junction authority.

A route token reserves before connector entry. A conflict leaves the waiter on the incoming lane endpoint. Once inside, a route normally clears the connector. Ownership releases on exit/forced teardown and stale ownership expires within a bounded timeout.

### Materialization/lifecycle authority

`phaser/src/streaming/TrafficRouteMaterializationPolicy.js` converts current compiler route geometry into visible token pose/metadata. Route-aware lifecycle policy preserves the same slot during protected crossing states. Lifecycle owns retention/spawn/despawn, never route geometry.

### Controlled visible proof

`phaser/src/streaming/TrafficControlledRouteActivationPolicy.js` has validated visible straight/right/left compiler-route traversal, reservation/yielding, stable token/slot, fixed pool and zero-teleport telemetry. It remains explicitly default-off.

### Macro authority

`MacroTrafficPoliceSystem` remains aggregate traffic population/load compatibility authority during M8 migration. Macro edge IDs/phases and district centres must never become ongoing local x/y or route-choice authority.

## Current validated boundary

M0 through M7 are complete.

Latest implementation boundary: `dcb08288ea797e7016bcdb3858299a85549a7259` passed GitHub Tests #2153 / run `32549761928` with unit, browser boot, browser campaign and all three browser-system shards successful.

Default civilian movement is still `authored-local-lanes`.

The current machine-readable task is M8.1: build a deterministic multi-agent route runtime substrate using the proven route/materialization/lifecycle/reservation contracts while keeping it non-default until a later M8 activation gate has dedicated soak evidence.

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
- choosing one macro edge arbitrarily when compatibility mapping is ambiguous;
- synthesizing local geometry from legacy phase/world distance;
- growing the visible materialization pool as a continuity workaround;
- letting a waiting car enter a connector before reservation is granted;
- voluntarily stopping a car mid-connector to resolve a conflict;
- allowing a vanished token to hold a junction indefinitely;
- flipping default civilian movement during M8.1 before its substrate evidence is green.

## Stable route identity contract

A route agent identity is independent of its current lane/stage.

It retains stable `tokenId`, route hop, stage, current compiler lane, connector/next lane while crossing, previous lane, bounded stage progress and optional compatibility metadata that cannot control local geometry.

`advanceTrafficRouteAgent(...)` must consume real elapsed time using stage geometry length, preserve `tokenId`, be deterministic for the same token/hop/topology, never mutate input state and return an explicit blocked reason when continuation is unavailable or connector entry is denied.

## Compatibility projection rule

Compatibility is output/accounting data, not local route geometry.

Allowed:

- derive district counts from compiler lane `districtId`;
- preserve/use explicit legacy macro-edge provenance as metadata;
- use local `sourceRoadEdgeId` to infer a macro edge only when membership is unique;
- report unmatched and ambiguous agents explicitly;
- compare/project aggregate counts during migration.

Forbidden:

- let projected macro edge/phase pick the next compiler lane;
- choose one of multiple macro matches arbitrarily;
- convert macro centre/progress to local driving coordinates;
- silently drop agents from totals.

Population must be conserved across projected + ambiguous + unmatched/unseeded buckets.

## Remaining activation ladder

- M0–M7 — complete.
- M8.1 — current: multi-agent route runtime substrate, non-default.
- Later M8 task(s) — default civilian activation and macro accounting migration only after focused/browser soak evidence.
- M9 — cleanup, documentation and explicit user gameplay approval.

Do not collapse M8.1 into default activation just because the substrate is convenient to enable.

## Validation discipline

For every bounded task:

- add focused tests for the new contract;
- run unit/focused validation;
- run full CI whenever runtime/compiler loading changes or the milestone gate requires it;
- inspect the exact failing assertion/log before modifying code;
- treat unexplained red CI as a blocker;
- avoid patching unrelated systems to make the branch green.

At milestone boundaries compare with live `main`. Integrate/revalidate first if `main` changed compiler road geometry, traffic generation, local lane following, materialization/lifecycle or road/junction collision/navigation authority.

## Documentation discipline

Every bounded task updates:

- machine-readable status JSON;
- append-only progress log;
- focused tests/evidence.

Update roadmap/task/agent docs whenever the architecture or phase contract changes materially. Keep the PR body synchronized enough that a human reviewer can see the current checkpoint, but status JSON remains authoritative.

A sufficient fresh-session instruction is:

> Continue ViceBlood PR #73 from `docs/progress/traffic-lane-junction-topology-status.json`; execute only `nextTask`, preserve architecture gates, and update status/progress with exact CI evidence.

## Final gate

Keep PR #73 draft during autonomous implementation. Do not auto-merge.

At M9 `final-validation-pending`, autonomous work stops. Provide the user a gameplay validation checklist/preview; merge requires explicit user approval.
