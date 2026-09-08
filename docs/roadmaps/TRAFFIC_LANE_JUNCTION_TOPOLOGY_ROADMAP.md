# Traffic lane / junction topology roadmap

## Current status — 2026-09-08

**Implementation complete and user accepted.** PR #73 merged at `7ee3af6` after explicit approval. The user also accepted PR #82's wider roads and explicitly requested merging with updated documentation. The accepted gameplay implementation is `163e870`; its Tests and Pages deployment both passed. GitHub owns the live merge result for PR #82.

Production uses 600 civilian cars, six buses on three lines and a fixed 64-slot materializer. `TrafficDriverRuntime` / `TrafficDriverController` use shared player-vehicle kinematics; compiler lanes/connectors define navigation. Junction recovery may steer through safe opposing pavement or reverse and reassess. Geometry v5 widens avenues/local/service roads to 150/96/88 units. Radio and distant-simulation optimizations are integrated.

Read the [current technical architecture](../TECHNICAL_ARCHITECTURE.md#13-civilian-traffic-architecture), [machine-readable completion state](../progress/traffic-lane-junction-topology-status.json), and [widening record](../agent-tasks/2026-09-08-wider-city-roads.md). `nextTask` is null: do not restart an old publication gate or launch an unrequested milestone. Future work starts from fresh user feedback and live repository state.

The accepted road build passes 911 native tests and city validation with zero errors/warnings. Native queue waits are not eliminated (about 50 seconds maximum in the widened Blackwater fixture). No automated browser execution was performed for this continuation, as requested by the user. Pages remains sourced from `codex/traffic-junction-topology`; preserve that branch.

### Delivered continuation after M9

| Stage | Delivered change | Current interpretation |
| --- | --- | --- |
| M10–M11 | Physical driving, junction recovery, broad repeating circuits | Production movement authority |
| M12–M13 | Road-capacity distribution and higher visible density | Extended by later population tuning |
| M14 | Four-lane avenues, 1,000-car experiment, three bus lines | Bus service retained; car count superseded by M15 |
| M15 | 600 civilian cars and a measured performance plan | Current population |
| M16 | Distant scheduling, incremental accounting and cached geometry | Integrated; historical CPU timings retain their original layout/viewpoint |
| M17 | Existing radio sources enabled on the Pages project | Integrated through PR #73 |
| M18 | Wider roads, matched lanes, pedestrian/building clearance | User-accepted PR #82 implementation |

## Historical M0–M9 phase record

The August narrative below records the cursor-based implementation and its validation at the time. Its scalar route-speed pose authority, older pool sizes, browser evidence and pending user gates were superseded by the physical-driver continuation above. Historical evidence remains intact; it is not a current execution instruction.

## Mission

Civilian traffic uses:

`compiler-owned directed lane -> activation-safe junction connector -> compiler-owned directed lane`

with stable vehicle identity, stable materialized slot, right-hand lane discipline, deterministic junction yielding and no coordinate snap/free-form cross-block steering.

## Historical authority stack after M8

1. `district-streaming.js` — physical road/network authority.
2. `traffic-lane-topology.js` — compiler-owned directed right-hand lanes/transitions.
3. `traffic-junction-connectors.js` — road-surface/tangent-safe connectors.
4. generated traffic pack v6 `localTopology` — runtime topology payload.
5. `TrafficRouteCursor.js` — stable route identity/progression.
6. `TrafficRoutePopulationSeed.js` — bootstrap macro population provenance onto compiler routes.
7. `TrafficMultiAgentRouteRuntimePolicy.js` — normal civilian continuity runtime.
8. `TrafficRouteBehaviorPolicy.js` — braking/following through scalar route speed only.
9. `TrafficJunctionReservationRegistry.js` — deterministic junction ownership/yielding.
10. route materialization + lifecycle — visible pose/retention.
11. `TrafficRouteCompatibilityProjection.js` — conservative aggregate civilian accounting.
12. macro system — bootstrap population records + independent police travel; never civilian local geometry.

## Historical M8 invariants (current invariants live in status/architecture)

- Macro graph/district centres are never civilian local driving coordinates.
- Legacy `edgeId + phase` is not normal physical route identity.
- No free-form drive-toward-next-lane steering or position snap.
- Only compiler lanes and activation-safe connectors/direct handoffs are physical route stages.
- Stable `tokenId` and materialization slot survive route stages.
- Missing geometry blocks safely.
- Junction conflicts wait before connector entry; inside cars normally clear.
- Reservations release/recover deterministically.
- Route-aware behavior may modulate speed but has no lateral/world-space pose authority.
- Materialization pool growth is not a continuity workaround.
- Compatibility projection never drops population or guesses ambiguity.
- Generated topology is fixed in its compiler, never hand-edited.
- `MacroTrafficRouteContinuityPolicy` and `TrafficIntentDrivingPolicy` remain forbidden as normal civilian authority.

---

# Milestones

## M0 — Read-only topology foundation

**Complete.** Initial directed-lane/connector diagnostics with no visible movement change.

Evidence: Tests #2046 / run `32472690729`.

## M1 — Compiler-owned topology and hard safety contract

**Complete.** Production audit proved legacy district-pair traffic edges were compatibility paths, not physical lane segments. Compiler node-owned lanes and tangent/road-surface-safe connectors became the sole future physical authority.

Evidence: Tests #2083 / run `32485801858`.

## M2 — Stable route model + conservative projection

**Complete.** Immutable route cursor, deterministic legal continuation, safe block on missing geometry and conservative output-only compatibility projection.

Evidence: Tests #2087 and #2101.

## M3 — Shadow macro bridge

**Complete.** Compared deterministic route agents with legacy macro state without visible authority.

Evidence: Tests #2109.

## M4 — Continuous traversal harness

**Complete.** Isolated `lane -> connector -> lane` proof with stable identity and zero snap.

Evidence: Tests #2113.

## M5 — Lifecycle/materialization retention

**Complete.** Stable token/slot through protected crossing while preserving forced hijack/layer/teardown exits.

Evidence: Tests #2125.

## M6 — Controlled browser activation

**Complete.** Straight/right/left compiler-route browser proof, default-off regression harness.

Evidence: implementation `b23dfc0eb1eb07ad3fd85fe89399c7fb5e40c5c0`, Tests #2135.

## M7 — Junction reservation/yielding

**Complete.** Deterministic reserve-before-entry, wait-at-lane-end conflicts, inside-clear behavior and stale/forced cleanup.

Evidence: implementation `dcb08288ea797e7016bcdb3858299a85549a7259`, Tests #2153.

## M8 — Default runtime activation and macro migration

**Complete.**

### M8.1 — Multi-agent route runtime substrate

Deterministic production-compatible route population, shared reservations, compiler-only materialization, fixed pool and route-active pose guards behind explicit activation.

Evidence: implementation `9173732803b2b92b28cf26a784e2382169eacc63`, Tests #2166.

### M8.2 — Production browser soak

Explicit production-data soak proved compiler geometry, bounded movement, stable token/slot, camera/stream retention, fixed pool, reservation cleanup and zero route-runtime mutation of isolated macro state.

Evidence: implementation `e9593957fff711e5b606253049321475376cccf8`, Tests #2173 / run `32552262883`.

### M8.3 — Default compiler-route activation + macro accounting migration

Normal civilian startup now fail-closed activates compiler routes only with complete production seeding. Route agents advance from normal frame delta. Legacy civilian phases no longer advance as competing continuity state while route authority is active. Aggregate civilian district/load accounting comes from the conservative route projection. Macro police travel remains independent.

M8.3 CI also exposed a real behavior regression: guarding route-active pose initially suppressed legacy braking. The accepted architecture adds `TrafficRouteBehaviorPolicy.js`, which detects route-aligned blockers and modulates scalar speed while keeping compiler geometry as the sole pose authority. Legacy lateral steering stays disabled for route-active cars.

Final evidence: implementation `0c25c8c7d324b027bd4fd0363483884e8da2f937`, GitHub Tests #2199 / run `32554733530` — unit, boot, campaign and all three browser-system shards successful.

## M9 — Legacy cleanup, documentation and user validation gate

**Historical gate, subsequently superseded.** Later user feedback led to M10–M18; the user has now accepted the resulting gameplay and authorized integration.

### M9.1 — Legacy cleanup audit + final validation preparation

**Complete.** Remaining traffic paths were classified before deletion.

Production-required compatibility retained:

- legacy macro `trafficFlows` only for bootstrap/accounting compatibility;
- `TrafficRoutePopulationSeed` and `TrafficRouteCompatibilityProjection`;
- macro police graph travel;
- route-aware lifecycle/materialization and hijack forced-release semantics.

Regression/historical evidence retained:

- `TrafficControlledRouteActivationPolicy` for controlled straight/right/left proof;
- `TrafficRouteTraversalHarness`;
- `TrafficShadowRoutePolicy` source/test as isolated M3 historical evidence;
- isolated legacy `MacroTrafficRouteContinuityPolicy` / `TrafficIntentDrivingPolicy` evidence, with no live production activation path.

The proven superseded live path was removed: normal `TrafficLocalAssignmentPolicy` no longer installs Shadow or wraps `macro.simulateTick` with a duplicate civilian route population. A recursive production-source test now rejects any live reference that could reactivate Shadow, macro-route continuity or free-form intent driving.

After the semantic CI split merged from `main`, `browser-world` was corrected to regenerate only `city:streaming` before Playwright. This provides fresh compiler `localTopology` without rewriting the road/sidewalk geometry that world tests themselves validate.

Final cleanup/semantic-CI evidence: implementation head `763d6a12824d3d83d3fea92f549c56d1b1a04202`, GitHub Tests #2220 / run `32577687431` — unit, boot, campaign, world, traffic, police, gameplay and performance all successful; building review skipped by design.

### M9.2 — Explicit user gameplay validation

**Historical validation checklist.** The current user-acceptance result is recorded at the top of this document and in the status file.

The user validates normal gameplay for:

- continuous lane-bound traffic through multiple junctions with no visible snap/teleport;
- straight/right/left crossings and no obvious deadlock pattern;
- braking/wait/recovery around parked or blocking actors while cars remain on compiler geometry;
- traffic-vehicle hijack with no duplicate/ghost vehicle or slot/lifecycle corruption;
- police response and cross-district pursuit remaining functional;
- camera/stream transitions without traffic pop/jump continuity regressions.

**No automatic merge. Explicit user gameplay approval is required before any ready/merge decision.**

---

## Historical milestone execution rule

At every bounded task/milestone boundary:

1. fetch live PR #73 and live `main`;
2. execute only machine-readable `nextTask`;
3. classify ownership before removing compatibility/legacy-looking code;
4. preserve hard authority invariants;
5. add/update focused tests for changed contracts;
6. inspect exact red CI before modifying code;
7. update status + append-only progress with exact evidence;
8. never merge or bypass the explicit final user gate.
