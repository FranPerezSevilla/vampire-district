# Traffic lane / junction topology and continuity

Canonical task boundary for PR #73 (`codex/traffic-junction-topology`).

## Continuation protocol

This initiative must be continuable without chat history. Before changing code, read in this order:

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

## Current physical authority

- `tools/city-compiler/district-streaming.js` — authoritative physical road network.
- `tools/city-compiler/traffic-lane-topology.js` — two directed right-hand lanes per physical segment plus compiler-node-owned legal transitions.
- `tools/city-compiler/traffic-junction-connectors.js` — tangent-preserving connector geometry validated against compiler road surfaces.
- `tools/city-compiler/traffic-lane-topology-integration.js` — additive traffic pack v6 `localTopology` integration.
- `phaser/src/streaming/TrafficRouteCursor.js` — pure stable route identity/time advancement.
- `phaser/src/streaming/TrafficRoutePopulationSeed.js` — deterministic macro-provenance bootstrap into compiler lanes; bootstrap only.
- `phaser/src/streaming/TrafficRouteCompatibilityProjection.js` — conservative aggregate compatibility projection; never local geometry.
- `phaser/src/streaming/TrafficJunctionReservationRegistry.js` — deterministic conservative junction ownership/yielding.
- `phaser/src/streaming/TrafficRouteMaterializationPolicy.js` + route-aware lifecycle policy — materialization metadata and crossing retention.
- `phaser/src/streaming/TrafficControlledRouteActivationPolicy.js` — proven controlled visible route traversal; default-off regression harness.
- `phaser/src/streaming/TrafficMultiAgentRouteRuntimePolicy.js` — production-shaped multi-agent compiler-route runtime, validated under explicit M8.2 browser soak.

Macro traffic remains population/load/compatibility authority only at the current boundary. Macro graph centres and legacy phase never become local driving coordinates.

## Validated milestone boundary

M0 through M7 plus M8.1 and M8.2 are complete.

Key final evidence:

- M1 compiler topology/safety — Tests #2083 / run `32485801858`.
- M2 route cursor/projection — Tests #2087 and #2101.
- M3 shadow bridge — Tests #2109.
- M4 traversal harness — Tests #2113.
- M5 lifecycle/materialization retention — Tests #2125.
- M6 controlled browser route activation — Tests #2135 / run `32495071190`.
- M7 deterministic junction reservation — Tests #2153 / run `32549761928`.
- M8.1 multi-agent route runtime substrate — implementation head `9173732803b2b92b28cf26a784e2382169eacc63`, Tests #2166 / run `32551128095`.
- M8.2 production browser soak — validated head `e9593957fff711e5b606253049321475376cccf8`, Tests #2173 / run `32552262883`; unit, boot, campaign and all three browser-system shards green.

M8.2 proves explicit production-data activation preserves compiler geometry authority, bounded per-tick movement, stable token/slot identity, fixed materialization pool, camera/stream continuity, reservation cleanup, route-active pose guards and isolated macro-flow immutability. Stopping the test-only runtime restores authored-local traffic cleanly.

**Current production default civilian movement is still `authored-local-lanes`. M8.2 did not flip it.**

## Current task

The status JSON is authoritative. Current task:

`M8.3-default-compiler-route-activation-and-macro-accounting-migration`

Purpose: make the validated compiler-route runtime the normal civilian continuity path and migrate live aggregate civilian traffic accounting away from advancing legacy edge phases, while keeping macro compatibility data non-geometric.

### Required shape

- Audit every live consumer of `MacroTrafficPoliceSystem` civilian phases/load before changing ownership. Police macro travel remains independent and must not regress.
- Prove production bootstrap has **zero unseeded civilian tokens** before the default flip. Unseeded production population is a blocker, not something to drop silently.
- Integrate multi-agent route advancement with the normal production frame delta rather than the manual debug `step()` API.
- Once compiler routes own normal civilian movement, legacy macro edge phase must stop acting as physical continuity identity or local x/y authority.
- Feed live aggregate civilian load/count diagnostics from `TrafficRouteCompatibilityProjection`, conserving population and exposing ambiguous/unmatched projection explicitly instead of guessing.
- Update runtime diagnostics so normal startup truthfully reports compiler-route lane authority.
- Preserve fixed pool, stable token/slot, lifecycle retention, hijack/forced exits, junction reservation cleanup and route-active behavior/steering guards.
- Add default-startup browser coverage plus macro/police/vehicle regression coverage and require full CI green.

### Acceptance

- production bootstrap has zero unseeded civilian tokens before default activation;
- normal browser startup enables compiler-route civilian movement without manually calling the M8 debug start API;
- route agents advance from normal frame delta and stay on compiler lanes/connectors with zero visible teleport;
- `laneAuthority` reports compiler-route ownership;
- legacy civilian edge phases no longer compete with route identity for visible movement or local coordinates;
- aggregate macro civilian population/load is derived conservatively from route projection with population conservation and explicit ambiguity/unmatched diagnostics;
- macro police travel and police gameplay remain functional and independent;
- stable token/slot, fixed pool, lifecycle/hijack forced exits and reservation cleanup remain valid under normal activation;
- legacy behavior/steering cannot overwrite `routeActive` pose;
- unit, boot, campaign and all three browser-system shards pass.

## Non-negotiable architecture

- Macro graph node/district centres are never local driving coordinates.
- Macro `edgeId + phase` is compatibility/accounting state, not physical route identity.
- No free-form drive-toward-next-lane steering.
- No snap/teleport between route stages.
- Only compiler-node-owned lanes and activation-safe compiler connectors may become local route stages.
- Missing geometry blocks safely instead of falling back to arbitrary movement.
- Stable `tokenId` and materialized slot identity survive route stage changes.
- Lifecycle owns spawn/despawn/pool retention, not route geometry.
- Junction conflict handling may delay connector entry but does not invent geometry.
- A car already inside a connector normally clears it instead of voluntarily stopping mid-junction.
- Stale reservation recovery is mandatory.
- `MacroTrafficRouteContinuityPolicy` and `TrafficIntentDrivingPolicy` must not be re-enabled wholesale.
- Generated topology is fixed in its owning compiler; never hand-edit generated output as a workaround.
- M8.3 must not flip normal traffic with incomplete production seeding or a lossy/ambiguous accounting migration.

## Do not advance M8.3 if

- any production civilian token cannot be seeded onto compiler route authority;
- default activation needs macro centres/phases as ongoing local coordinates or route-choice authority;
- legacy phase progression continues to compete with compiler route identity;
- compatibility projection drops population or guesses ambiguous ownership;
- normal frame-loop integration introduces teleports, illegal exits, unstable token/slot assignment or pool growth;
- reservations leak/deadlock;
- police macro travel, vehicle dynamics, hijack/lifecycle forced exits or existing browser behavior regress;
- full CI is red or unexplained.

## Remaining activation ladder

1. M8.1 — multi-agent route runtime substrate — complete.
2. M8.2 — production browser soak — complete, explicit opt-in evidence only.
3. M8.3 — **current**: default compiler-route activation + macro accounting migration.
4. M9 — superseded legacy cleanup + documentation + explicit user gameplay validation.

## Final gate

PR #73 remains draft during autonomous implementation and must not auto-merge.

At `final-validation-pending` autonomous work stops. The user receives a gameplay validation checklist/preview and merge requires explicit user approval.
