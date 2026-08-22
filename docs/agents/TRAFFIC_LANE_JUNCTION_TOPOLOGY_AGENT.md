# Traffic lane / junction topology agent contract

Operational handoff contract for PR #73 (`codex/traffic-junction-topology`).

## Bootstrap

A fresh agent/session must:

1. fetch live PR #73 and live `main`;
2. read `docs/progress/traffic-lane-junction-topology-status.json` first;
3. execute only its exact `nextTask` unless the user explicitly broadens scope;
4. read the roadmap, task boundary and latest progress entries;
5. inspect every file named by `nextTask.readFirst` before writing.

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

M0 through M8 are complete.

Latest validated implementation head:
`0c25c8c7d324b027bd4fd0363483884e8da2f937`

GitHub Tests #2199 / run `32554733530` passed unit, boot, campaign and all three browser-system shards.

M8.3 validation includes:

- zero unseeded production civilian tokens;
- default compiler-route startup from normal frame delta;
- stable token/slot and fixed materialization pool;
- compiler-only pose with bounded movement/no teleport;
- conservative projection accounting/population conservation;
- frozen legacy civilian phase advancement while route authority is active;
- independent macro police travel;
- junction reservation cleanup;
- lifecycle/hijack forced exits;
- route-safe braking without restoring legacy lateral/world-space steering.

A real M8.3 browser regression was found and resolved: guarding `routeActive` x/y initially also bypassed braking behavior. The accepted solution is the dedicated scalar-speed route behavior controller, not returning pose authority to the legacy steering system.

## Current machine-readable task

`M9.1-legacy-cleanup-audit-and-final-validation-prep`

M9 must remove only code proven superseded after the M8 migration, synchronize documentation/diagnostics, run final CI and then stop at `final-validation-pending` for user gameplay approval.

### Cleanup discipline

Before deleting anything, classify it as one of:

1. still-required production bootstrap/accounting compatibility;
2. useful regression harness/evidence;
3. genuinely superseded/dead experiment.

Only category 3 is eligible for removal by default.

Do not delete a compatibility-looking field merely because normal movement no longer uses it. `trafficFlows`, macro edge provenance or controlled-route proof may still have legitimate bootstrap/accounting/regression roles.

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
- merge PR #73 or bypass the explicit user gameplay gate.

## Validation discipline

For every bounded task:

- add/update focused tests for changed contracts;
- inspect exact failures before changing code;
- treat unexplained red CI as a blocker;
- run full CI after M9 cleanup;
- verify normal startup still reports `compiler-route-lanes` and zero unseeded population;
- verify macro police, vehicle dynamics, hijack/lifecycle, reservations and route-safe braking remain intact.

## Documentation discipline

Keep synchronized:

- machine-readable status JSON;
- append-only progress log;
- roadmap/task/agent docs when phase state changes;
- PR body at milestone boundaries.

## Final gate

PR #73 remains draft.

At M9 `final-validation-pending`, autonomous work stops. Provide the user a concise gameplay validation checklist/preview. **No automatic merge; explicit user approval is required.**
