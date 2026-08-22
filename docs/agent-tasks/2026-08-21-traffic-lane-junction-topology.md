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
- `phaser/src/streaming/TrafficJunctionReservationRegistry.js` — deterministic conservative junction ownership/yielding.
- `phaser/src/streaming/TrafficRouteMaterializationPolicy.js` + route-aware lifecycle policy — materialization metadata and crossing retention.
- `phaser/src/streaming/TrafficControlledRouteActivationPolicy.js` — proven controlled visible route traversal; still default-off.

Macro traffic remains population/load/compatibility authority only. Macro graph centres and legacy phase never become local driving coordinates.

## Validated milestone boundary

M0 through M7 are complete.

Key final evidence:

- M1 compiler topology/safety — Tests #2083 / run `32485801858`.
- M2 route cursor/projection — Tests #2087 and #2101.
- M3 shadow bridge — Tests #2109.
- M4 traversal harness — Tests #2113.
- M5 lifecycle/materialization retention — Tests #2125.
- M6 controlled browser route activation — Tests #2135 / run `32495071190`.
- M7 deterministic junction reservation — implementation head `dcb08288ea797e7016bcdb3858299a85549a7259`, Tests #2153 / run `32549761928`, all required jobs green.

M7 guarantees that conflicting controlled route tokens reserve before connector entry, wait on the incoming lane, normally clear once inside, release on exit/forced teardown and recover stale ownership without deadlocking. Default civilian movement remains `authored-local-lanes`.

## Current task

The status JSON is authoritative. Current task:

`M8.1-multi-agent-route-runtime-substrate`

Purpose: generalize the already-proven pure route, reservation, lifecycle and materialization contracts to a deterministic multi-agent civilian route runtime substrate **without flipping production default movement yet**.

### Required shape

- Reuse/extract deterministic macro-population-to-local-route seeding from the shadow bridge where appropriate.
- Macro provenance may seed stable route identity, but ongoing local x/y and continuation must use compiler lane/connector geometry only.
- Advance multiple stable route agents through one shared M7 junction reservation registry.
- Expose route materialization tokens without growing the fixed visual pool or changing token identity.
- Keep waiting before connector entry; cars already inside normally clear the connector.
- Prevent legacy behavior/steering from overwriting `routeActive` x/y.
- Do not mutate live macro traffic phases/load as the new physical movement authority in M8.1; compatibility projection remains diagnostic/output-only in this slice.
- Keep normal production civilian traffic on `authored-local-lanes` throughout M8.1.

### Acceptance

- seeded + explicitly unseeded records conserve macro population;
- stable identity survives multi-agent lane/connector/lane progression;
- conflicting agents cannot simultaneously enter the same conservative junction authority;
- waiting agents remain at the incoming lane endpoint;
- teardown releases reservations and route state;
- materialization pool remains bounded/fixed;
- route-active x/y comes only from compiler lane/connector geometry;
- legacy behavior/steering cannot overwrite route-active movement;
- default civilian movement remains unchanged;
- focused tests and full CI pass.

## Non-negotiable architecture

- Macro graph node/district centres are never local driving coordinates.
- Macro `edgeId + phase` is aggregate compatibility state, not physical route identity.
- No free-form drive-toward-next-lane steering.
- No snap/teleport between route stages.
- Only compiler-node-owned lanes and activation-safe compiler connectors may become local route stages.
- Missing geometry blocks safely instead of falling back to arbitrary movement.
- Stable `tokenId` and later materialized slot identity survive route stage changes.
- Lifecycle owns spawn/despawn/pool retention, not route geometry.
- Junction conflict handling may delay connector entry but does not invent geometry.
- A car already inside a connector normally clears it rather than voluntarily stopping mid-junction.
- Stale reservation recovery is mandatory.
- `MacroTrafficRouteContinuityPolicy` and `TrafficIntentDrivingPolicy` must not be re-enabled wholesale.
- Generated topology is fixed in its owning compiler; never hand-edit generated output as a workaround.

## Remaining activation ladder

1. M8.1 — multi-agent route runtime substrate, still non-default.
2. Later M8 bounded task(s) — controlled default activation + macro accounting migration only after soak evidence.
3. M9 — superseded legacy cleanup + documentation + explicit user gameplay validation.

## Final gate

PR #73 remains draft during autonomous implementation and must not auto-merge.

At `final-validation-pending` autonomous work stops. The user receives a gameplay validation checklist/preview and merge requires explicit user approval.
