# Traffic lane / junction topology and continuity

Canonical task boundary for PR #73 (`codex/traffic-junction-topology`).

## Continuation protocol

This initiative is explicitly designed to survive new conversations/agents without chat history.

Before changing code, read in this order:

1. `docs/progress/traffic-lane-junction-topology-status.json` — machine-readable current milestone and exact `nextTask`.
2. `docs/roadmaps/TRAFFIC_LANE_JUNCTION_TOPOLOGY_ROADMAP.md` — M0–M9 sequence and activation gates.
3. `docs/agents/TRAFFIC_LANE_JUNCTION_TOPOLOGY_AGENT.md` — authority boundaries and forbidden shortcuts.
4. This task boundary.
5. `docs/progress/TRAFFIC_LANE_JUNCTION_TOPOLOGY_PROGRESS.md` — append-only history/evidence.

A sufficient fresh-session prompt is:

> Continue ViceBlood PR #73 from the canonical `nextTask`; keep status/progress updated and do not bypass milestone activation gates.

Always fetch live PR #73, live `main`, current head and CI before writing.

## Mission

Make civilian traffic cross intersections continuously and legally without allowing macro district connectivity to become local driving geometry.

Target physical path:

`compiler-owned directed lane -> activation-safe junction connector -> compiler-owned directed lane`

The same stable route identity must survive the transition. No teleport, free-form cross-block steering or nearest-junction guessing is a valid substitute.

## Root cause already proven

The old `traffic-lanes.json.edges` records are long compatibility routes between district anchors/portals. They can traverse multiple physical road-network nodes and are **not** physical lane-segment topology.

M1.1 proved that trying to infer physical junction ownership from those route endpoints creates large orphan/ambiguous/tangent-failure counts. Therefore legacy district-pair lanes remain compatibility data only.

## Current physical authority

Local topology is generated from the compiler road network:

- `tools/city-compiler/district-streaming.js` — physical network nodes/segments derived from the authoritative road graph;
- `tools/city-compiler/traffic-lane-topology.js` — two directed right-hand lanes per physical segment plus compiler-node-owned legal transitions;
- `tools/city-compiler/traffic-junction-connectors.js` — tangent-preserving connector geometry validated against compiler road surfaces;
- `tools/city-compiler/traffic-lane-topology-integration.js` — additive traffic pack v6 integration;
- `phaser/src/streaming/TrafficRouteCursor.js` — pure stable route-agent state and time advancement.

Legacy `edges`/`junctions` are retained only so current systems continue to work during migration.

## Completed milestones

### M0 — diagnostic/read-only foundation

Complete. It was useful to expose the mismatch between legacy macro-compatible lane routes and real physical junction topology.

### M1 — compiler-owned hard safety contract

Complete.

Guarantees:

- explicit compiler node ownership instead of nearest-junction inference;
- two directed right-hand lanes per physical network segment;
- deterministic preferred legal transitions;
- U-turn avoidance except explicit dead ends;
- cubic connector curves with exact lane endpoints;
- every preferred connector validated against compiler-owned road surfaces;
- zero rejected production preferred connectors;
- zero outside-road production connectors;
- zero production tangent-continuity failures;
- additive pack v6 `localTopology` while legacy compatibility data remains intact;
- provisional legacy endpoint-inference topology is no longer installed by runtime.

Final M1 runtime boundary: GitHub Tests #2083 / run `32485801858` — full success.

### M2.1/M2.2 — pure route cursor + deterministic continuation

Complete on head `9a7d45566b17c2a508e269c3d23b9f2d3b67ea1a`.

`TrafficRouteCursor` is pure: no Phaser, scene, materializer, camera, police or macro-district dependency.

A route agent retains stable `tokenId`, route hop, current stage (`lane|connector`), compiler lane, connector/next lane while crossing, previous lane, bounded stage progress and carried metadata.

`advanceTrafficRouteAgent(...)`:

- consumes elapsed seconds using real stage geometry length;
- may cross lane -> connector/direct handoff -> outgoing lane in one call using leftover time;
- preserves `tokenId` exactly;
- selects only compiler `preferred` transitions deterministically from token + route hop;
- consumes only activation-safe connectors or explicitly validated direct handoffs;
- blocks explicitly at stage end when continuation geometry is absent;
- never invents world-space coordinates;
- never mutates the input agent or topology.

GitHub Tests #2087 / run `32486691651` — full success: unit, boot, campaign and all three browser-system shards.

## Exact next task

The status JSON is authoritative. Current task:

`M2.3-compatibility-projection`

Build a pure **output-only** projection from stable local route agents into legacy macro traffic diagnostics/load.

Rules:

- district counts come from compiler lane `districtId` ownership;
- macro edge attribution may use explicit compatibility provenance if present;
- without provenance, local `sourceRoadEdgeId` may identify a macro edge only when membership is unique;
- zero matches => `unmatched`;
- multiple matches => `ambiguous`;
- never pick an arbitrary macro edge for an ambiguous road;
- projected + ambiguous + unmatched must conserve population;
- do not synthesize local route geometry or choices from macro centres/phases;
- do not invent a legacy phase from arbitrary world distance;
- do not install the projection into live `MacroTrafficPoliceSystem` until M3 shadow mode.

## Non-negotiable architecture

- Macro graph node/district centres are never local driving coordinates.
- Macro `edgeId + phase` is compatibility/load state, not physical route identity.
- No free-form drive-toward-next-lane steering.
- No snap/teleport between route stages.
- Only compiler-node-owned lanes and activation-safe compiler connectors may become local route stages.
- Missing geometry blocks safely instead of falling back to arbitrary movement.
- Same stable `tokenId` must survive pure route stages and later visible materialization.
- Lifecycle owns spawn/despawn/pool retention, not route geometry.
- `MacroTrafficRouteContinuityPolicy` and `TrafficIntentDrivingPolicy` must not be re-enabled wholesale.
- Generated topology is fixed in its owning compiler; never hand-edit generated output as a workaround.

## Runtime activation ladder

Do not skip stages:

1. M1 compiler topology/safety — complete.
2. M2 pure route identity/projection — in progress.
3. M3 shadow route agents beside existing macro traffic — no visible authority.
4. M4 isolated local traversal harness.
5. M5 lifecycle/materialization retention integration.
6. M6 controlled browser activation.
7. M7 connector occupancy/yield/conflict handling.
8. M8 default civilian traffic migration.
9. M9 cleanup + explicit user gameplay validation.

## Final gate

PR #73 remains draft during autonomous implementation and must not auto-merge.

At `final-validation-pending` autonomous work stops. The user receives a gameplay validation checklist/preview and merge requires explicit user approval.
