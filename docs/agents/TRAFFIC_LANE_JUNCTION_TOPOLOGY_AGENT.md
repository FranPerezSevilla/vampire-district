# Traffic lane / junction topology agent contract

Operational handoff contract for PR #73 (`codex/traffic-junction-topology`).

## Bootstrap

A fresh agent/session must:

1. fetch live PR #73 and live `main`;
2. read `docs/progress/traffic-lane-junction-topology-status.json` first;
3. execute only its exact `nextTask` unless the user explicitly broadens scope;
4. read the roadmap, task boundary and latest progress entries;
5. inspect every file named by `nextTask.readFirst` before writing when such a list exists.

Do not ask the user to reconstruct chat history when the repository contract answers the question.

## Architecture now in production

Civilian physical continuity is:

`compiler-owned directed lane -> activation-safe compiler connector -> compiler-owned directed lane`

### Physical authority

- `tools/city-compiler/district-streaming.js` — physical network.
- `tools/city-compiler/traffic-lane-topology.js` — right-hand directed lanes and legal transitions.
- `tools/city-compiler/traffic-junction-connectors.js` — activation-safe connector geometry.
- generated pack v6 `localTopology` — runtime payload.

### Runtime route authority

- `TrafficRouteCursor.js` — stable route identity and elapsed-time advancement.
- `TrafficMultiAgentRouteRuntimePolicy.js` — normal civilian route runtime; default enabled fail-closed.
- `TrafficJunctionReservationRegistry.js` — deterministic junction ownership/yielding.
- `TrafficRouteMaterializationPolicy.js` + route-aware lifecycle — visible pose/retention.
- `TrafficRouteBehaviorPolicy.js` — route-aware braking/following by scalar speed factor only.

`TrafficRouteBehaviorPolicy` has **no x/y, lateral-steering or free-form geometry authority**. A route-active vehicle remains exactly on compiler lane/connector geometry even while braking for traffic, parked vehicles, player vehicle or player on foot.

### Compatibility/accounting authority

- `TrafficRoutePopulationSeed.js` may consume macro provenance/phase only to bootstrap the initial compiler lane/progress.
- `TrafficRouteCompatibilityProjection.js` owns conservative aggregate civilian accounting after activation.
- `MacroTrafficPoliceSystem` retains bootstrap population records plus independent police macro travel.
- legacy civilian phase advancement is disabled while compiler-route civilian authority is active.

Macro graph/district centres are never civilian local coordinates.

## Validated boundary

M0 through M9.1 are complete.

Latest validated implementation head:
`763d6a12824d3d83d3fea92f549c56d1b1a04202`

GitHub Tests #2220 / run `32577687431` passed:

- unit-tests;
- browser-boot;
- browser-campaign;
- browser-world;
- browser-traffic;
- browser-police;
- browser-gameplay;
- browser-performance.

Building visual review was skipped by its normal workflow condition.

The M9.1 audit established:

- production-required compatibility remains limited to bootstrap/accounting, route lifecycle/materialization and independent macro police responsibilities;
- `TrafficControlledRouteActivationPolicy` and `TrafficRouteTraversalHarness` remain useful regression proof;
- `TrafficShadowRoutePolicy` may remain as isolated M3 historical source/test evidence but is no longer installed by production;
- `MacroTrafficRouteContinuityPolicy`, `TrafficIntentDrivingPolicy` and Shadow have no live production references outside their isolated legacy modules;
- the only proven redundant live production path was the Shadow wrapper/population installed from `TrafficLocalAssignmentPolicy`, and it has been removed;
- `tests/traffic-lifecycle-integration.test.js` recursively guards against reactivation of those superseded production paths.

The semantic CI split also requires `browser-world` to compile `city:streaming` before Playwright. It intentionally does not run full `city:topology`, because regenerating roads would mutate road/sidewalk geometry while world tests are validating it.

## Current machine-readable task

`M9.2-explicit-user-gameplay-validation`

**Autonomous implementation is stopped. Do not make further production or cleanup changes unless the user reports a concrete validation failure or explicitly broadens scope.**

The user validation covers:

- continuous lane-bound civilian movement through multiple junctions without visible snap/teleport;
- straight/right/left crossings with no obvious deadlock pattern;
- braking/wait/recovery around parked or blocking actors while remaining on compiler geometry;
- traffic-vehicle hijack without duplicate/ghost cars or slot/lifecycle corruption;
- police response and cross-district pursuit remaining functional;
- camera/stream transitions without visible traffic pop/jump continuity regressions.

## Forbidden shortcuts

Never:

- re-enable `MacroTrafficRouteContinuityPolicy` wholesale;
- re-enable `TrafficIntentDrivingPolicy` wholesale;
- use macro/district centres as civilian drive targets;
- steer freely in world space toward a future lane;
- snap a car to an outgoing lane sample;
- infer physical junction ownership from nearest legacy endpoints;
- hand-edit generated topology;
- grow the materialization pool to hide continuity problems;
- drop unseeded/ambiguous population silently;
- stop a car voluntarily inside a connector to resolve a conflict;
- let a stale reservation deadlock a junction;
- restore lateral legacy steering to route-active cars as an obstacle-avoidance shortcut;
- resume speculative cleanup after M9.1 merely because a module name looks legacy;
- merge PR #73 or bypass the explicit user gameplay gate.

## Validation discipline

If the user reports a concrete playtest failure:

- reproduce/inspect the exact failure before changing code;
- preserve compiler geometry as physical authority;
- add/update focused regression coverage for the reported issue;
- treat unexplained red CI as a blocker;
- rerun the full semantic CI matrix after any fix;
- return to `final-validation-pending` until the user explicitly approves gameplay.

## Documentation discipline

Keep synchronized:

- machine-readable status JSON;
- append-only progress log;
- roadmap/task/agent docs when phase state changes;
- PR body at milestone boundaries.

## Final gate

PR #73 remains draft.

At M9 `final-validation-pending`, autonomous work is stopped. **No automatic merge; explicit user approval is required.**
