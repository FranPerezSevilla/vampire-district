# Traffic lane / junction topology roadmap

Canonical phase roadmap for PR #73 (`codex/traffic-junction-topology`).

> **Live execution state:** read `docs/progress/traffic-lane-junction-topology-status.json` first. It owns the exact task, validated implementation head and continuation gate.

## Mission

Civilian traffic uses:

`compiler-owned directed lane -> activation-safe junction connector -> compiler-owned directed lane`

with stable vehicle identity, stable materialized slot, right-hand lane discipline, deterministic junction yielding and no coordinate snap/free-form cross-block steering.

## Final authority stack after M8

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

## Non-negotiable invariants

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

**Final validation pending.** Autonomous implementation is complete and stopped at the explicit user gate.

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

**Current gate. No autonomous implementation may advance past this point.**

The user validates normal gameplay for:

- continuous lane-bound traffic through multiple junctions with no visible snap/teleport;
- straight/right/left crossings and no obvious deadlock pattern;
- braking/wait/recovery around parked or blocking actors while cars remain on compiler geometry;
- traffic-vehicle hijack with no duplicate/ghost vehicle or slot/lifecycle corruption;
- police response and cross-district pursuit remaining functional;
- camera/stream transitions without traffic pop/jump continuity regressions.

**No automatic merge. Explicit user gameplay approval is required before any ready/merge decision.**

---

## Milestone execution rule

At every bounded task/milestone boundary:

1. fetch live PR #73 and live `main`;
2. execute only machine-readable `nextTask`;
3. classify ownership before removing compatibility/legacy-looking code;
4. preserve hard authority invariants;
5. add/update focused tests for changed contracts;
6. inspect exact red CI before modifying code;
7. update status + append-only progress with exact evidence;
8. never merge or bypass the explicit final user gate.
