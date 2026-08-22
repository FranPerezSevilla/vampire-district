# Traffic lane / junction topology roadmap

Canonical phase roadmap for PR #73 (`codex/traffic-junction-topology`).

> **Live execution state:** always read `docs/progress/traffic-lane-junction-topology-status.json` first. This roadmap defines milestone contracts; the status JSON owns the exact completed-task list, validated implementation head and `nextTask`.

## Mission

Make civilian traffic cross intersections continuously and legally while preserving compiler-owned road geometry and right-hand lane discipline.

Target behaviour:

`compiler-owned directed lane -> activation-safe junction connector -> compiler-owned directed lane`

with one stable vehicle identity, one stable materialized pool slot, no coordinate snap and no free-form shortcut across sidewalks/buildings.

## Canonical authority stack

1. `tools/city-compiler/district-streaming.js` — physical road/network authority.
2. `tools/city-compiler/traffic-lane-topology.js` — directed right-hand lanes and legal compiler-node transitions.
3. `tools/city-compiler/traffic-junction-connectors.js` — activation-safe road-surface/tangent-validated connector geometry.
4. generated traffic pack v6 `localTopology` — runtime topology payload; legacy edges/junctions remain compatibility data during migration.
5. `TrafficRouteCursor.js` — stable route identity and elapsed-time progression.
6. `TrafficRoutePopulationSeed.js` — bootstrap macro population provenance onto compiler lanes only.
7. `TrafficJunctionReservationRegistry.js` — deterministic conservative junction ownership/yielding.
8. route materialization + lifecycle — visible pose and retention, never route choice.
9. `TrafficMultiAgentRouteRuntimePolicy.js` — production-shaped multi-agent compiler-route runtime.
10. macro traffic — population/load/accounting compatibility only; macro centres/phases never become local route geometry.

## Non-negotiable invariants

- Cars use the right-hand directed lane for travel direction.
- Physical transitions use compiler-owned directed lanes and activation-safe connectors/direct handoffs at the exact shared compiler node.
- Macro graph/district centres are never valid local driving coordinates.
- No runtime system steers directly between streets across arbitrary world space.
- Stable `tokenId` survives every route stage and visible crossing.
- Route transitions do not teleport x/y.
- Missing route geometry blocks explicitly; no arbitrary fallback.
- Visible crossing is protected from normal despawn/eviction.
- U-turns are avoided when another preferred legal continuation exists.
- Junction conflicts wait before connector entry; cars already inside normally clear.
- Reservation ownership releases on exit/forced teardown and stale ownership recovers.
- Materialization pool growth is not a continuity workaround.
- Compatibility projection never guesses ambiguous macro ownership or drops population.
- Generated topology is fixed in its compiler, never hand-edited.
- `MacroTrafficRouteContinuityPolicy` and `TrafficIntentDrivingPolicy` are not re-enabled wholesale.

---

# Milestones

## M0 — Read-only topology foundation

**State: complete.**

Established initial directed-lane/connector diagnostics without changing visible traffic. Subsequent production audit intentionally superseded the provisional legacy endpoint-inference model.

Key evidence: Tests #2046 / run `32472690729`.

## M1 — Compiler-owned topology and hard safety contract

**State: complete.**

Production audit proved legacy district-pair traffic edges are compatibility routes, not physical lane segments. The compiler now emits right-hand directed lanes with explicit node ownership, legal preferred transitions and road-surface/tangent-safe connectors; runtime legacy endpoint inference was retired.

Key evidence: Tests #2083 / run `32485801858`.

## M2 — Stable route-agent model and conservative projection

**State: complete.**

Added immutable stable route cursor, deterministic preferred continuation, safe blocking on missing geometry and output-only conservative compatibility projection with explicit ambiguous/unmatched handling.

Key evidence: Tests #2087 and #2101.

## M3 — Shadow macro continuity bridge

**State: complete.**

Ran deterministic local route agents beside legacy macro traffic for comparison/projection without visible movement authority.

Key evidence: Tests #2109.

## M4 — Continuous traversal harness

**State: complete.**

Proved isolated physical `lane -> connector -> lane` traversal with stable identity, continuous sampled pose and no teleport before production activation.

Key evidence: Tests #2113.

## M5 — Lifecycle/materialization retention

**State: complete.**

Route-aware lifecycle/materialization metadata preserves stable token/slot through protected crossing states while retaining forced hijack/layer/teardown exits.

Key evidence: Tests #2125.

## M6 — Controlled browser activation

**State: complete.**

Default-off controlled production crossings validate straight/right/left compiler routes, stable slot identity, fixed pool, camera retention and zero teleport telemetry.

Key evidence: implementation `b23dfc0eb1eb07ad3fd85fe89399c7fb5e40c5c0`, Tests #2135 / run `32495071190`.

## M7 — Junction reservation/yield/conflict handling

**State: complete.**

Deterministic conservative junction ownership reserves before connector entry, leaves conflicts waiting at the incoming lane endpoint, normally clears inside traffic and recovers stale/forced ownership.

Key evidence: implementation `dcb08288ea797e7016bcdb3858299a85549a7259`, Tests #2153 / run `32549761928`.

## M8 — Default runtime activation and macro migration

**State: in progress.**

### M8.1 — Multi-agent route runtime substrate

**Complete.** Added deterministic production-compatible population seeding, shared reservations, compiler-only materialization, route-active legacy-pose guards, fixed-pool semantics and explicit default-off `start/step/stop` runtime.

Key evidence: implementation `9173732803b2b92b28cf26a784e2382169eacc63`, Tests #2166 / run `32551128095`.

### M8.2 — Opt-in production browser soak

**Complete.** Added production `urban-explore` browser evidence to the official browser-system suite. Explicit activation proves population conservation, exact compiler geometry, bounded per-tick movement/no teleport, stable token/slot through camera/streaming, fixed pool identity/size, reservation cleanup, route-active presentation guards, zero isolated macro-flow mutation and clean stop back to authored-local traffic.

Validated implementation/evidence head: `e9593957fff711e5b606253049321475376cccf8`.

GitHub Tests #2173 / run `32552262883`: unit, boot, campaign and all three browser-system shards successful.

**Production startup remains `authored-local-lanes` after M8.2.**

### M8.3 — Default compiler-route activation + macro accounting migration

**Current task.**

Only this separate gate may make compiler routes the normal civilian continuity authority.

Required before default activation:

- production bootstrap has zero unseeded civilian tokens;
- normal frame delta advances route agents without the manual debug step path;
- compiler routes become sole physical continuity identity;
- legacy civilian edge phases stop acting as movement identity/local coordinates;
- aggregate civilian district/load diagnostics come from conservative route compatibility projection with population conservation and explicit ambiguity/unmatched reporting;
- macro police travel remains independent and functional;
- fixed pool, stable token/slot, lifecycle/hijack forced exits, reservations and route-active guards survive normal gameplay;
- default-startup browser, macro, police and vehicle regressions plus full CI are green.

M8.3 is blocked by any unseeded production token, lossy/guessed projection, teleport/illegal road exit, pool growth, reservation leak/deadlock or police/vehicle regression.

## M9 — Legacy cleanup, documentation and user validation gate

**State: planned.**

Remove superseded compatibility/experimental code only after M8 production migration is proven. Synchronize diagnostics/docs and prepare explicit gameplay validation.

Autonomous work stops at `final-validation-pending`. Provide the user a gameplay validation checklist/preview. **No automatic merge; explicit user approval is required.**

---

## Milestone execution rule

At every bounded task/milestone boundary:

1. fetch live PR #73 and live `main`;
2. integrate/revalidate if relevant compiler/traffic authority changed on `main`;
3. execute only the machine-readable `nextTask`;
4. add focused tests before increasing runtime authority;
5. preserve activation gates and fail safely;
6. update status + append-only progress with exact CI evidence;
7. do not advance on unexplained red CI.
