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

## Current production authority after M8

M0 through M8 are complete.

Normal civilian traffic now uses:

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

GitHub Tests #2199 / run `32554733530` passed:

- unit-tests — success;
- browser-boot — success;
- browser-campaign — success;
- browser-systems 1/3 — success;
- browser-systems 2/3 — success;
- browser-systems 3/3 — success.

M8.3 proves:

- zero unseeded production civilian tokens before default activation;
- fail-closed default activation from normal frame delta, not the debug step API;
- exact compiler lane/connector pose and stable token/slot/fixed pool;
- no legacy civilian phase competition for movement;
- conservative route-projection accounting with population conservation;
- independent macro police travel;
- route reservation cleanup and lifecycle/forced-exit preservation;
- route-safe braking for traffic, parked vehicles and the player without restoring legacy lateral/world-space steering.

During M8.3 validation, CI intentionally exposed and resolved a real behavior regression: the initial route-pose guards also suppressed legacy braking. The fix was not to restore legacy pose authority; `TrafficRouteBehaviorPolicy.js` now modulates only scalar route speed while compiler geometry remains sole pose authority.

## Current task

`M9.1-legacy-cleanup-audit-and-final-validation-prep`

M9 is cleanup and validation preparation, not another authority redesign.

### Required shape

- inventory remaining traffic experiments, adapters and compatibility data;
- classify each item before deletion as production-required bootstrap/accounting, regression harness, or genuinely superseded dead code;
- remove only proven superseded paths;
- keep compiler-route default behavior unchanged;
- keep population bootstrap/projection and macro police independence intact while still required;
- keep controlled route proof where it remains useful as regression coverage;
- prove no live code can re-enable macro-centre movement, legacy nearest-junction inference or free-form civilian intent steering;
- synchronize diagnostics/docs;
- run full CI after cleanup;
- then transition to `final-validation-pending` and stop autonomous work for user gameplay approval.

### Do not advance if

- ownership of a cleanup candidate is uncertain;
- cleanup changes gameplay rather than removing redundant code;
- default compiler routes, route-safe braking, accounting, reservations, lifecycle/hijack, physics or police regress;
- full CI is red or unexplained;
- the work would merge the PR or bypass explicit user gameplay approval.

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

At `final-validation-pending`, autonomous implementation stops. Provide the user a gameplay validation checklist/preview. Merge requires explicit user approval.
