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

## Root architecture

A previous continuity experiment treated macro district/street connectivity as local driving geometry. That abstraction cannot encode legal right-hand lanes or turn curves and caused cross-block/sidewalk/building shortcuts.

The replacement architecture is:

`compiler-owned directed lane -> activation-safe compiler connector -> compiler-owned directed lane`

Stable route identity decides which legal stage comes next. Physical coordinates always come from compiler/local route geometry.

## Authority stack

### Physical topology

- `tools/city-compiler/district-streaming.js` owns the physical road network.
- `tools/city-compiler/traffic-lane-topology.js` emits directed right-hand lanes, compiler-node ownership and preferred legal transitions.
- `tools/city-compiler/traffic-junction-connectors.js` emits tangent-preserving connector geometry validated against compiler road surfaces.
- `tools/city-compiler/traffic-lane-topology-integration.js` attaches `localTopology` to generated traffic pack v6.

Legacy `traffic-lanes.json.edges` / `junctions` remain compatibility data during migration; they are not physical junction-routing authority.

### Route/population authority

- `phaser/src/streaming/TrafficRouteCursor.js` owns pure stable route-agent state/progression and never invents coordinates.
- `phaser/src/streaming/TrafficRoutePopulationSeed.js` deterministically bootstraps macro population provenance onto compiler lanes. Macro phase/source-road information may select initial lane/progress only.
- `phaser/src/streaming/TrafficRouteCompatibilityProjection.js` is conservative output/accounting projection only.
- `phaser/src/streaming/TrafficMultiAgentRouteRuntimePolicy.js` advances production-shaped stable route agents through compiler geometry and one shared junction registry.

### Junction/materialization authority

- `TrafficJunctionReservationRegistry.js` reserves deterministic compiler-junction authority before connector entry; conflicts wait at the incoming lane endpoint; stale ownership expires; teardown releases ownership.
- `TrafficRouteMaterializationPolicy.js` derives visible pose only from current compiler route geometry.
- route-aware `TrafficLifecyclePolicy.js` owns retention/spawn/despawn semantics, not route geometry.
- `TrafficControlledRouteActivationPolicy.js` remains a default-off regression harness for isolated crossings.

### Macro authority

`MacroTrafficPoliceSystem` currently owns aggregate civilian population/load compatibility and independent macro police travel. Macro centres and legacy civilian phases must never become ongoing local route coordinates or route-choice authority.

M8.3 may migrate aggregate civilian accounting, but it must not couple civilian local route movement to police macro travel or turn compatibility state back into geometry.

## Current validated boundary

M0 through M7 plus M8.1 and M8.2 are complete.

Latest validated implementation/evidence boundary: `e9593957fff711e5b606253049321475376cccf8`, GitHub Tests #2173 / run `32552262883`.

All required jobs were successful:

- unit-tests;
- browser-boot;
- browser-campaign;
- browser-systems 1/3;
- browser-systems 2/3;
- browser-systems 3/3.

M8.2 production browser evidence proves explicit multi-agent activation conserves production population, stays on compiler lanes/connectors, keeps per-tick movement bounded, preserves token/slot and fixed-pool identity through camera/stream movement, prevents legacy pose overwrite, uses valid reservation ownership, releases reservations on stop and does not mutate isolated live macro flows.

**Normal production startup is still `authored-local-lanes` at this boundary.** M8.2 did not authorize a default flip.

The current machine-readable task is:

`M8.3-default-compiler-route-activation-and-macro-accounting-migration`

## M8.3 discipline

Before changing the default:

- audit all live consumers of civilian macro phases/load;
- keep macro police travel independent;
- prove production route bootstrap has zero unseeded civilian tokens;
- treat any unseeded production token as a blocker, never silently drop it;
- integrate route advancement with normal frame delta rather than the manual debug step API;
- make compiler routes the sole physical civilian continuity identity if/when the gate flips;
- stop legacy civilian edge phase from acting as a competing movement identity/local coordinate source;
- drive aggregate civilian district/load diagnostics from conservative route compatibility projection;
- conserve total population and expose ambiguous/unmatched projection rather than guessing;
- truthfully update `laneAuthority`/diagnostics after the default flip;
- preserve fixed pool, token/slot continuity, lifecycle retention, hijack/forced release, reservations and behavior/steering guards;
- add normal-startup browser evidence plus macro/police/vehicle regression coverage and require full CI green.

Do not declare M8 complete merely because M8.2 passed. Default activation is a separate authority migration gate.

## Forbidden shortcuts

Never solve a task by:

- re-enabling `MacroTrafficRouteContinuityPolicy` wholesale;
- re-enabling `TrafficIntentDrivingPolicy` wholesale;
- steering freely in world space toward a future lane;
- snapping a vehicle to an outgoing-lane sample;
- using macro/district centres as drivable points;
- assigning a legacy route endpoint to the nearest junction as physical ownership;
- increasing geometric tolerances to hide ambiguous ownership;
- activating a connector that failed compiler safety validation;
- hand-editing generated topology instead of fixing the compiler;
- growing the visible materialization pool as a continuity workaround;
- letting a waiting car enter before reservation is granted;
- voluntarily stopping a car mid-connector to resolve a conflict;
- allowing a vanished token to hold a junction indefinitely;
- silently dropping production tokens that cannot be seeded;
- keeping legacy phase movement active as a competing physical identity after the default flip;
- guessing one macro owner when route projection is ambiguous;
- mutating macro compatibility state merely to make browser evidence pass;
- coupling civilian compiler-route progression to macro police travel;
- treating M8.2 success as permission to bypass M8.3 acceptance gates.

## Stable route identity contract

A route agent identity is independent of its current lane/stage. It retains stable `tokenId`, route hop, stage, current compiler lane, connector/next lane while crossing, previous lane, bounded stage progress and optional compatibility metadata that cannot control local geometry.

`advanceTrafficRouteAgent(...)` must consume real elapsed time using stage geometry length, preserve `tokenId`, be deterministic for the same token/hop/topology, never mutate input state and return an explicit blocked reason when continuation is unavailable or connector entry is denied.

## Compatibility/accounting rule

Compatibility is output/accounting data, not local route geometry.

Allowed:

- derive district counts from compiler lane `districtId`;
- preserve/use explicit macro-edge provenance as metadata;
- use local `sourceRoadEdgeId` to infer a macro edge only when membership is unique;
- report unmatched and ambiguous agents explicitly;
- project aggregate counts/load during migration.

Forbidden:

- let projected macro edge/phase pick the next compiler lane;
- choose one of multiple macro matches arbitrarily;
- convert macro centre/progress to local driving coordinates;
- silently drop agents from totals.

Population must be conserved across projected + ambiguous + unmatched/unseeded buckets.

## Do not advance M8.3 if

- any production civilian token cannot be seeded onto compiler routes;
- normal activation needs macro centres/phases as local coordinates or route choice;
- legacy phase progression competes with compiler route identity;
- compatibility projection loses population or guesses ambiguous ownership;
- normal frame-loop integration introduces illegal exits, teleport, assignment churn or pool growth;
- junction ownership leaks/deadlocks;
- police macro travel or police gameplay regress;
- vehicle dynamics, lifecycle/hijack forced exits or existing browser behavior regress;
- full CI is red or unexplained.

## Remaining activation ladder

- M0–M7 — complete.
- M8.1 — multi-agent route runtime substrate — complete.
- M8.2 — production browser soak — complete, explicit opt-in evidence.
- M8.3 — **current**: default civilian compiler-route activation + macro accounting migration.
- M9 — legacy cleanup, documentation and explicit user gameplay approval.

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

Every bounded task updates machine-readable status JSON, append-only progress and focused validation evidence. Update roadmap/task/agent docs whenever architecture or phase contracts change materially. Keep the PR body synchronized enough that a reviewer can see the current checkpoint; status JSON remains authoritative.

A sufficient fresh-session instruction is:

> Continue ViceBlood PR #73 from `docs/progress/traffic-lane-junction-topology-status.json`; execute only `nextTask`, preserve architecture gates, and update status/progress with exact CI evidence.

## Final gate

Keep PR #73 draft during autonomous implementation. Do not auto-merge.

At M9 `final-validation-pending`, autonomous work stops. Provide the user a gameplay validation checklist/preview; merge requires explicit user approval.
