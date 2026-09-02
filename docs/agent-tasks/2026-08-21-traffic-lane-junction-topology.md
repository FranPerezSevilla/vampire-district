# Traffic lane / junction topology and continuity

Canonical task boundary for PR #73 (`codex/traffic-junction-topology`).

## Continuation protocol

Before changing code, read in order:

1. `docs/progress/traffic-lane-junction-topology-status.json` — authoritative milestone and exact `nextTask`.
2. `docs/roadmaps/TRAFFIC_LANE_JUNCTION_TOPOLOGY_ROADMAP.md`.
3. `docs/agents/TRAFFIC_LANE_JUNCTION_TOPOLOGY_AGENT.md`.
4. This task boundary.
5. `docs/progress/TRAFFIC_LANE_JUNCTION_TOPOLOGY_PROGRESS.md`.

Execute only the machine-readable `nextTask` unless the user explicitly broadens scope. Fetch live PR #73, live `main` and current CI before writing.

## Mission

Civilian traffic must use:

`compiler-owned directed lane -> activation-safe compiler connector -> compiler-owned directed lane`

with stable vehicle identity, stable materialization slot, deterministic junction yielding and no teleport/free-form shortcut.

## Final production authority

M0 through M9.1 are complete.

Normal civilian traffic uses:

- `TrafficMultiAgentRouteRuntimePolicy.js` — default route runtime;
- `TrafficRouteCursor.js` — deterministic compiler-route progression;
- `TrafficRouteBehaviorPolicy.js` — braking/following via scalar speed only; it never owns x/y or lateral steering;
- `TrafficJunctionReservationRegistry.js` — conservative junction reservation/yielding;
- `TrafficRouteMaterializationPolicy.js` + lifecycle — visible pose/retention;
- `TrafficRouteCompatibilityProjection.js` — conservative aggregate civilian accounting.

`laneAuthority` is `compiler-route-lanes` during normal production traffic.

Macro traffic has three remaining legitimate roles:

1. deterministic bootstrap population provenance;
2. aggregate civilian accounting from the route projection;
3. independent macro police travel.

Legacy civilian phases are no longer the normal physical continuity identity and do not advance while compiler-route civilian authority is active. Macro/district centres are never civilian local driving coordinates.

## M8.3 validated boundary

Implementation head: `0c25c8c7d324b027bd4fd0363483884e8da2f937`.

GitHub Tests #2199 / run `32554733530` passed the pre-semantic-split workflow and proved:

- zero unseeded production civilian tokens before default activation;
- fail-closed default activation from normal frame delta, not the debug step API;
- exact compiler lane/connector pose and stable token/slot/fixed pool;
- no legacy civilian phase competition for movement;
- conservative route-projection accounting with population conservation;
- independent macro police travel;
- route reservation cleanup and lifecycle/forced-exit preservation;
- route-safe braking for traffic, parked vehicles and the player without restoring legacy lateral/world-space steering.

During M8.3 validation, CI intentionally exposed and resolved a real behavior regression: the initial route-pose guards also suppressed legacy braking. The fix was not to restore legacy pose authority; `TrafficRouteBehaviorPolicy.js` modulates only scalar route speed while compiler geometry remains sole pose authority.

## M9.1 cleanup audit — complete

The audit classified remaining traffic paths before deletion.

### Production-required compatibility

- legacy macro `trafficFlows` for bootstrap/accounting compatibility only;
- `TrafficRoutePopulationSeed`;
- `TrafficRouteCompatibilityProjection`;
- independent macro police graph travel;
- route-aware lifecycle/materialization plus forced hijack/layer/teardown release semantics.

### Regression/historical evidence retained

- `TrafficControlledRouteActivationPolicy` for controlled straight/right/left proof;
- `TrafficRouteTraversalHarness`;
- `TrafficShadowRoutePolicy` source/test as isolated M3 historical evidence;
- isolated legacy `MacroTrafficRouteContinuityPolicy` and `TrafficIntentDrivingPolicy` evidence.

### Superseded live production path removed

`TrafficLocalAssignmentPolicy` no longer installs `TrafficShadowRoutePolicy`, so production no longer wraps `macro.simulateTick` or maintains a duplicate shadow civilian route population beside the real M8 runtime.

`tests/traffic-lifecycle-integration.test.js` recursively scans production JS and fails if Shadow, `MacroTrafficRouteContinuityPolicy` or `TrafficIntentDrivingPolicy` gains a live reference outside its isolated legacy module. Legacy nearest-junction inference remains disabled.

### Final semantic CI evidence

Validated implementation head: `763d6a12824d3d83d3fea92f549c56d1b1a04202`.

GitHub Tests #2220 / run `32577687431` passed:

- unit-tests — success;
- browser-boot — success;
- browser-campaign — success;
- browser-world — success;
- browser-traffic — success;
- browser-police — success;
- browser-gameplay — success;
- browser-performance — success;
- browser-building-review — skipped by design.

The semantic CI split requires `browser-world` to run `city:streaming` before Playwright so M8 local topology is regenerated without rewriting road/sidewalk geometry that world tests are validating. `browser-traffic` continues to run the full `city:topology` prerequisite.

## Current task

`M9.2-explicit-user-gameplay-validation`

**This is a user gate, not an autonomous coding task. Autonomous implementation must stop here.**

The user should validate:

- civilian cars remain on lanes across multiple junctions with no visible snap/teleport;
- straight/right/left crossings do not show an obvious deadlock pattern;
- parked/blocking actors cause braking/wait/recovery without cars leaving compiler geometry;
- hijacking a traffic vehicle produces no duplicate/ghost vehicle and preserves normal lifecycle behavior;
- police response and cross-district pursuit still function;
- camera/stream transitions show no visible traffic pop/jump continuity regression.

Only explicit user approval satisfies M9.2. Any reported regression returns the PR to implementation mode for a focused fix plus regression coverage and full semantic CI.

## Non-negotiable architecture

- Macro/district centres are never civilian local driving coordinates.
- Macro `edgeId + phase` is compatibility/bootstrap state, not physical route identity.
- No free-form drive-toward-next-lane steering.
- No snap/teleport between route stages.
- Only compiler-owned lanes and activation-safe connectors/direct handoffs are physical route stages.
- Missing geometry blocks safely.
- Stable `tokenId` and slot identity survive route transitions.
- Route-aware behavior may alter speed, never arbitrary x/y/lateral pose.
- Junction conflicts wait before entry; cars already inside normally clear.
- Stale reservations recover.
- Do not re-enable `MacroTrafficRouteContinuityPolicy` or `TrafficIntentDrivingPolicy` wholesale.
- Never hand-edit generated topology as a workaround.

## Final gate

PR #73 remains draft and must not auto-merge.

At `final-validation-pending`, autonomous implementation is stopped. Merge or ready-for-review requires explicit user approval after gameplay validation.
