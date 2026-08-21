# Traffic lane / junction topology roadmap

Canonical implementation roadmap for PR #73 (`codex/traffic-junction-topology`).

> **Live execution state:** always read `docs/progress/traffic-lane-junction-topology-status.json` first. This roadmap defines phase contracts; the status JSON owns the exact completed task list and `nextTask`.

## Mission

Make civilian traffic cross intersections continuously and legally while preserving compiler-owned road geometry and right-hand lane discipline.

The target behaviour is:

`compiler-owned directed lane -> activation-safe junction connector -> compiler-owned directed lane`

with one stable vehicle identity, one stable materialized pool slot, no coordinate snap and no free-form shortcut across sidewalks/buildings.

This initiative exists because a previous experiment made the macro district graph a local movement authority. That graph knows aggregate connectivity but not physical lane geometry, so cars could cut across blocks, use sidewalks, cross buildings and enter the wrong side of a road. That architecture must not return.

## Canonical authority stack

1. **Compiler-owned road/network geometry**
   - `tools/city-compiler/district-streaming.js`
   - authoritative physical network nodes/segments derived from the city road graph
2. **Compiler-owned local lane topology**
   - `tools/city-compiler/traffic-lane-topology.js`
   - two directed right-hand lanes per physical network segment; explicit compiler-node ownership
3. **Compiler-owned junction connectors**
   - `tools/city-compiler/traffic-junction-connectors.js`
   - tangent-preserving, road-surface-validated connector micro-lanes
4. **Generated traffic pack**
   - `tools/city-compiler/traffic-lane-topology-integration.js`
   - additive pack v6 `localTopology`; legacy `edges`/`junctions` remain compatibility data during migration
5. **Pure route identity / route cursor**
   - `phaser/src/streaming/TrafficRouteCursor.js`
   - decides/advances only legal compiler lane/connector stages; never supplies arbitrary world coordinates
6. **Local lane follower / visible movement**
   - existing authored-local-lane behaviour remains authoritative until controlled activation milestones
7. **Lifecycle/materialization**
   - owns spawn/despawn/pool retention, not route geometry
8. **Macro traffic simulation**
   - aggregate population/load compatibility only; macro centres/phases never become local geometry authority

## Non-negotiable invariants

- Cars use the right-hand directed lane for travel direction.
- A physical route transition uses compiler-owned directed lanes and an activation-safe connector/direct handoff at the exact shared compiler node.
- Macro graph node centres, district centres and straight-line targets are never valid local driving geometry.
- No runtime system may steer directly from one street to another across arbitrary world space.
- Connector first/last points equal exact lane endpoints.
- Production preferred connectors remain inside compiler-owned road surfaces and pass tangent continuity.
- Stable `tokenId` survives every route stage and later every visible junction crossing.
- A route transition never teleports x/y.
- Missing route geometry produces an explicit blocked state; it never triggers a free-form fallback.
- Once visible crossing is activated, normal despawn/pool eviction is forbidden during crossing.
- U-turns are avoided whenever another preferred legal continuation exists; dead-end reversal is explicit.
- Do not hand-edit generated city topology.
- Do not re-enable `MacroTrafficRouteContinuityPolicy` or `TrafficIntentDrivingPolicy` wholesale.

---

# Milestones

## M0 — Read-only topology foundation

**State:** complete.

Purpose: create the initial directed-lane/connector diagnostic model without changing visible movement. Its production audit later proved that legacy district-pair lanes were the wrong physical topology source.

Key evidence: GitHub Tests #2046 / run `32472690729` — full success.

---

## M1 — Production topology audit and compiler-owned hard safety contract

**State:** complete.

### M1.1 — Production audit

Proved legacy `traffic-lanes.json.edges` are district-anchor/portal compatibility paths, not physical lane segments. The large orphan/ambiguous/tangent-failure counts explicitly blocked activation of the M0 endpoint-inference model.

### M1.2 — Compiler-owned directed lane graph

Generate two directed right-hand lanes per `district-streaming network.segment`, with explicit `fromNodeId/toNodeId` ownership and deterministic legal transitions.

Key evidence: Tests #2065 — full success.

### M1.3 — Additive pack integration

Add local compiler topology to generated traffic pack schema v6 while preserving legacy compatibility edges/junctions.

Key evidence: Tests #2068 — full success.

### M1.4 — Tangent-safe production connectors

Generate cubic connectors from trimmed lane approaches; validate exact endpoints, compiler-node ownership, road-surface confinement and tangent continuity. Unsafe connectors are hard rejected.

Key evidence: Tests #2071 and #2073 — full success, including zero rejected/outside-road/tangent-failing preferred production connectors.

### M1.5 — Retire provisional runtime endpoint inference

Runtime no longer installs the legacy nearest-junction topology. Compiler `localTopology` is diagnostic/read-only and visible movement remains unchanged.

Key evidence: Tests #2083 — full success.

### Exit criteria

- [x] Physical lanes are compiler-node-owned.
- [x] Right-hand lane topology is deterministic.
- [x] Production preferred connectors are activation-safe.
- [x] Generated pack integration preserves legacy compatibility data.
- [x] Provisional legacy endpoint inference is removed from the future runtime path.
- [x] Visible traffic behaviour remains unchanged.
- [x] Full CI green.

---

## M2 — Stable route-agent state model (pure data)

**State:** in progress. M2.1 and M2.2 complete; `status.json` owns the exact next task.

### M2.1 — Pure route cursor — complete

Implement immutable route-agent state that retains stable `tokenId`, route hop, current lane/stage, connector/next lane while crossing, previous lane and bounded stage progress.

`advanceTrafficRouteAgent(...)` consumes elapsed seconds by physical stage length and may cross multiple stage boundaries in one call while preserving identity.

### M2.2 — Deterministic legal continuation — complete

Only compiler `preferred` transitions may be selected. Selection is deterministic from stable token + route hop. Required geometry must be an activation-safe compiler connector or explicit validated direct handoff. Missing geometry blocks safely.

Key evidence for M2.1/M2.2: Tests #2087 / run `32486691651` — unit, boot, campaign and all system shards successful.

### M2.3 — Compatibility projection — next

Build a pure output-only adapter from local route agents to legacy macro traffic diagnostics/load.

Requirements:

- district counts use compiler lane `districtId`;
- explicit compatibility provenance may identify a legacy macro edge;
- absent provenance, `sourceRoadEdgeId` may identify a macro edge only if membership is unique;
- zero matches are unmatched, multiple matches are ambiguous;
- never guess an ambiguous macro edge;
- conserve total population across projected/ambiguous/unmatched buckets;
- do not invent legacy phase from world distance/macro centres;
- do not install into live macro traffic until M3.

### M2 exit criteria

- stable identity survives arbitrary pure lane/connector/lane progression;
- deterministic route selection uses local compiler topology only;
- compatibility projection is deterministic, conservative and output-only;
- no macro coordinates influence route choice;
- unit/focused validation is green;
- visible runtime remains unchanged.

---

## M3 — Shadow macro continuity bridge

**State:** planned.

Run stable route agents beside the existing macro flow without allowing them to control materialized cars.

- initialize deterministic route agents with explicit compatibility provenance where possible;
- shadow-advance local routes;
- project counts/load back for comparison;
- measure divergence and unmapped/ambiguous provenance;
- no visible movement authority.

---

## M4 — Local continuous traversal harness

**State:** planned.

Physically traverse representative `lane -> connector -> lane` paths in an isolated harness using existing lane-following movement. Prove position/heading continuity and same identity without enabling normal traffic.

---

## M5 — Lifecycle/materialization/pool-retention integration

**State:** planned.

Preserve the same route token/materialization slot through visible junction crossing. Protect crossing from normal despawn/eviction while retaining forced exits for hijack, destruction, layer switch and teardown.

---

## M6 — Opt-in browser activation

**State:** planned.

Activate compiler route traversal only in controlled browser scenarios/intersections. Add telemetry for illegal transition, teleport, route block and lifecycle violations.

---

## M7 — Junction occupancy, yielding and conflict handling

**State:** planned.

Add a lightweight deterministic connector reservation/yield model:

- reserve before entry;
- wait on incoming lane on conflict;
- normally clear once inside;
- release on exit/forced teardown;
- recover stale reservations;
- bound waiting/retry to avoid deadlocks.

Do not overbuild a full traffic-light simulator unless city data explicitly owns one.

---

## M8 — Default runtime activation and macro migration

**State:** planned.

Only after earlier gates pass, make compiler route identity the normal civilian continuity path, migrate macro population/load accounting to the compatibility projection and retire obsolete edge-phase identity behaviour.

Required soak/browser evidence includes zero illegal road exits, zero visible teleports, bounded population/pool and no regression to police/vehicle dynamics.

---

## M9 — Legacy cleanup, documentation and user validation gate

**State:** planned.

Remove superseded experiments/compatibility code only after production migration is proven. Synchronize docs and diagnostics.

Autonomous work stops at `final-validation-pending`. Provide the user a gameplay validation checklist/preview. **No automatic merge; explicit user approval is required.**

---

## Milestone execution rule

At every milestone boundary:

1. fetch live PR #73 and live `main`;
2. integrate/revalidate if relevant compiler/traffic files changed on `main`;
3. execute only the machine-readable `nextTask`;
4. add focused tests before activation;
5. keep unsafe/new authority behind the milestone gate;
6. update status + progress with exact commit/CI evidence;
7. do not advance on unexplained red CI.
