# Traffic lane / junction topology and continuity

Canonical task boundary for PR #73 (`codex/traffic-junction-topology`).

## Continuation protocol

This initiative must be continuable without chat history.

Before changing code, read in this order:

1. `docs/progress/traffic-lane-junction-topology-status.json` — authoritative current milestone and exact `nextTask`.
2. `docs/roadmaps/TRAFFIC_LANE_JUNCTION_TOPOLOGY_ROADMAP.md` — M0–M9 sequence and activation gates.
3. `docs/agents/TRAFFIC_LANE_JUNCTION_TOPOLOGY_AGENT.md` — authority boundaries and forbidden shortcuts.
4. This task boundary.
5. `docs/progress/TRAFFIC_LANE_JUNCTION_TOPOLOGY_PROGRESS.md` — append-only history/evidence.

Always fetch live PR #73, live `main`, current head and CI before writing. Execute only the current machine-readable `nextTask` unless the user explicitly grants a wider batch.

## Mission

Make civilian traffic cross intersections continuously and legally without allowing macro district connectivity to become local driving geometry.

Target physical path:

`compiler-owned directed lane -> activation-safe junction connector -> compiler-owned directed lane`

The same stable route identity must survive the transition. No teleport, free-form cross-block steering or nearest-junction guessing is a valid substitute.

## Root cause already proven

The old `traffic-lanes.json.edges` records are long compatibility routes between district anchors/portals. They can traverse multiple physical road-network nodes and are not physical lane-segment topology.

M1.1 proved that endpoint-to-nearest-junction inference over those routes creates large orphan/ambiguous/tangent-failure counts. Legacy district-pair lanes therefore remain compatibility data only during migration.

## Current physical authority

- `tools/city-compiler/district-streaming.js` — authoritative physical road network.
- `tools/city-compiler/traffic-lane-topology.js` — two directed right-hand lanes per physical segment plus compiler-node-owned legal transitions.
- `tools/city-compiler/traffic-junction-connectors.js` — tangent-preserving connector geometry validated against compiler road surfaces.
- `tools/city-compiler/traffic-lane-topology-integration.js` — additive traffic pack v6 `localTopology` integration.
- `phaser/src/streaming/TrafficRouteCursor.js` — pure stable route identity/time advancement.
- `phaser/src/streaming/TrafficRoutePopulationSeed.js` — deterministic macro-provenance bootstrap into compiler lanes; bootstrap only.
- `phaser/src/streaming/TrafficJunctionReservationRegistry.js` — deterministic conservative junction ownership/yielding.
- `phaser/src/streaming/TrafficRouteMaterializationPolicy.js` + route-aware lifecycle policy — materialization metadata and crossing retention.
- `phaser/src/streaming/TrafficControlledRouteActivationPolicy.js` — proven controlled visible route traversal; default-off.
- `phaser/src/streaming/TrafficMultiAgentRouteRuntimePolicy.js` — proven deterministic multi-agent route substrate; default-off.

Macro traffic remains population/load/compatibility authority only. Macro graph centres and legacy phase never become local driving coordinates.

## Validated milestone boundary

M0 through M7 plus M8.1 are complete.

Key final evidence:

- M1 compiler topology/safety — Tests #2083 / run `32485801858`.
- M2 route cursor/projection — Tests #2087 and #2101.
- M3 shadow bridge — Tests #2109.
- M4 traversal harness — Tests #2113.
- M5 lifecycle/materialization retention — Tests #2125.
- M6 controlled browser route activation — Tests #2135 / run `32495071190`.
- M7 deterministic junction reservation — Tests #2153 / run `32549761928`.
- M8.1 deterministic multi-agent route runtime substrate — implementation head `9173732803b2b92b28cf26a784e2382169eacc63`, Tests #2166 / run `32551128095`, unit + boot + campaign + all three browser-system shards green.

M8.1 conserves macro population through seeded + explicit unseeded records, preserves stable production-compatible token identity, drives only from compiler lane/connector geometry, shares one M7 reservation registry, protects `routeActive` pose from legacy behavior/steering, keeps the materialization pool bounded and does not mutate live macro traffic state.

Default civilian movement remains `authored-local-lanes`.

## Current task

The status JSON is authoritative. Current task:

`M8.2-opt-in-multi-agent-browser-soak`

Purpose: exercise the complete M8.1 substrate against production browser data before any later M8 task is allowed to make compiler-route traffic the normal civilian authority.

### Required shape

- Add a dedicated production-browser scenario that proves M8 is disabled on normal startup.
- Explicitly start M8 only inside the scenario through the public policy/debug API.
- Capture baseline macro traffic state, materialization pool identity/size and stable token IDs before the soak.
- Advance the route runtime for a bounded production soak while moving/following the camera.
- Track route-active world pose and reject visible teleports or non-compiler route-stage geometry.
- Keep reservation/yield state bounded and require complete cleanup on stop/teardown.
- Verify legacy behavior/steering cannot overwrite route-active pose while M8 is enabled.
- Verify live `MacroTrafficPoliceSystem` traffic flows/phases/counts are unchanged throughout the soak.
- Stop M8 and prove authored-local traffic is restored cleanly.
- Keep M8 default-off outside the explicit test scenario.

### Acceptance

- normal browser startup reports M8 disabled and `laneAuthority: authored-local-lanes`;
- explicit M8 activation conserves production population, including explicit unseeded records;
- stable token and materialization slot identity survive the bounded soak;
- pool identity/size does not grow;
- no visible route teleport or compiler-geometry authority violation is observed;
- reservation state remains bounded and is empty after stop/teardown;
- legacy behavior/steering cannot overwrite route-active x/y;
- live macro traffic state is unchanged;
- stop restores legacy authored-local traffic cleanly;
- focused browser evidence and full CI pass.

## Non-negotiable architecture

- Macro graph node/district centres are never local driving coordinates.
- Macro `edgeId + phase` is aggregate compatibility state, not physical route identity.
- No free-form drive-toward-next-lane steering.
- No snap/teleport between route stages.
- Only compiler-node-owned lanes and activation-safe compiler connectors may become local route stages.
- Missing geometry blocks safely instead of falling back to arbitrary movement.
- Stable `tokenId` and materialized slot identity survive route stage changes.
- Lifecycle owns spawn/despawn/pool retention, not route geometry.
- Junction conflict handling may delay connector entry but does not invent geometry.
- A car already inside a connector normally clears it rather than voluntarily stopping mid-junction.
- Stale reservation recovery is mandatory.
- `MacroTrafficRouteContinuityPolicy` and `TrafficIntentDrivingPolicy` must not be re-enabled wholesale.
- Generated topology is fixed in its owning compiler; never hand-edit generated output as a workaround.
- M8.2 is evidence only: it must not silently become default activation.

## Remaining activation ladder

1. M8.1 — multi-agent route runtime substrate — complete, default-off.
2. M8.2 — production browser soak — current, explicit opt-in only.
3. Later M8 bounded task(s) — default activation + macro accounting migration only after M8.2 evidence is green.
4. M9 — superseded legacy cleanup + documentation + explicit user gameplay validation.

## Final gate

PR #73 remains draft during autonomous implementation and must not auto-merge.

At `final-validation-pending` autonomous work stops. The user receives a gameplay validation checklist/preview and merge requires explicit user approval.
