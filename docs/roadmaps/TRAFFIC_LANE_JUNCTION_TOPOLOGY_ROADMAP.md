# Traffic lane / junction topology roadmap

Canonical implementation roadmap for PR #73 (`codex/traffic-junction-topology`).

## Mission

Make civilian traffic cross intersections continuously and legally while preserving the lane/road geometry that keeps cars on the correct side of the road.

The target behaviour is:

`authored lane -> explicit junction connector -> authored lane`

with one stable vehicle identity, one stable materialized pool slot, no coordinate snap and no free-form shortcut across sidewalks/buildings.

This initiative exists because the previous experiment made the macro district graph a local movement authority. That graph knows connectivity but not lane geometry, so cars could cut across blocks, use sidewalks, cross buildings and enter the wrong side of a road. That architecture must not return.

## Canonical authority stack

Authority is deliberately one-way. Lower layers may consume higher-layer intent, but must not invent geometry owned elsewhere.

1. **Compiler-owned road/junction geometry**
   - `tools/city-compiler/generate-road-topology.js`
   - generated road/junction topology
2. **Authored traffic lane manifest**
   - `phaser/assets/city/packs/traffic-lanes.json`
   - exact forward/reverse lane polylines and authored junction envelopes
3. **Derived lane/junction topology**
   - `phaser/src/streaming/TrafficLaneJunctionTopology.js`
   - directed lanes, lane endpoint ownership, legal lane-to-lane choices and connector micro-lanes
4. **Route identity / route cursor**
   - planned in this roadmap
   - decides which directed lane/connector comes next for a stable traffic token
   - never supplies arbitrary world coordinates
5. **Local lane follower / local traffic behaviour**
   - existing local traffic behaviour remains the physical movement authority
   - samples the current authored lane or validated connector micro-lane
6. **Lifecycle/materialization**
   - `TrafficLifecyclePolicy` + materialization/local assignment
   - owns spawn/despawn/pool retention, not route geometry
7. **Macro traffic simulation**
   - owns cheap city-scale population/load progression
   - may consume route identity after migration, but never becomes local geometry authority

## Non-negotiable invariants

Every milestone must preserve all of these.

- Cars drive on the authored right-side lane for their direction.
- A vehicle can change streets only through a connector derived from exact lane endpoints at the same authored junction.
- Macro graph node centres, district centres and straight-line target points are never valid local driving geometry.
- No runtime system may lerp/steer directly from one road to another across arbitrary world space.
- Connector first point equals the incoming lane endpoint exactly.
- Connector last point equals the outgoing lane start exactly.
- Active connectors stay within their validated junction envelope.
- A materialized vehicle keeps the same `tokenId` and pool slot through a junction.
- No normal despawn or pool eviction while a vehicle is approaching/crossing a junction.
- Forced lifecycle exits remain legal: layer switch, hijack/ownership transfer, destruction and explicit teardown.
- A route segment transition never teleports x/y.
- New vehicles are born offscreen and ordinary vehicles die offscreen unless diegetically justified.
- U-turns are avoided when another legal continuation exists.
- Dead-end handling must use an explicit legal connector/reversal or terminate the route offscreen; never reverse/teleport visibly at the lane endpoint.
- Do not hand-edit generated city topology as a shortcut.
- Do not re-enable `MacroTrafficRouteContinuityPolicy` or `TrafficIntentDrivingPolicy` wholesale. Their earlier architecture is explicitly superseded.

## Definition of “continuous”

A junction traversal is continuous only when all of the following remain stable across `lane -> connector -> lane`:

- traffic identity;
- materialization slot;
- world position (no snap larger than normal per-frame movement);
- heading progression;
- route history/hop count;
- lifecycle state;
- archetype/vehicle presentation;
- occupancy/collision participation.

A car disappearing at the lane end and a visually identical car appearing on another street does **not** count as continuity.

---

# Milestones

## M0 — Read-only lane/junction topology foundation

**State:** complete on the implementation head that produced Tests #2046.

### Goal

Build a lane-level topology without changing current traffic movement.

### Scope

- Treat `edgeId + direction` as a directed lane.
- Attach lane starts/ends to authored junctions geometrically.
- Derive legal outgoing directed lanes at the same junction.
- Classify straight/left/right/U-turn choices.
- Generate sampled connector micro-lanes between exact endpoints.
- Measure connector confinement to the junction envelope.
- Inject only validated connector micro-lanes into the loaded lane manifest.
- Expose topology through diagnostics.
- Keep `TrafficLocalBehaviorSystem`/existing local lane behaviour authoritative.

### Required evidence

- focused unit coverage;
- unit suite green;
- browser boot green;
- browser campaign green;
- browser systems shards 1/3, 2/3 and 3/3 green;
- no current traffic behaviour activation.

### Exit criteria

- [x] Directed lanes exist.
- [x] Lane endpoint junction ownership exists.
- [x] Legal continuations exist.
- [x] Deterministic U-turn avoidance exists.
- [x] Exact endpoint connector geometry exists.
- [x] Connector envelope validation exists.
- [x] Runtime topology is read-only with respect to driving.
- [x] Tests #2046 green on implementation head `f481add4c79d6705de017e67e08810de35a24347`.

---

## M1 — Production topology audit and hard safety contract

**State:** next.

### Goal

Prove that the production lane manifest is safe enough to become a future route authority before any vehicle consumes it.

### Tasks

#### M1.1 — Production manifest audit

Add focused production-data tests/diagnostics that report:

- directed lane count;
- junction count;
- connected lane count;
- orphan lane count;
- connector count by turn type;
- unsafe connector count;
- lane endpoints that attach to zero junctions;
- endpoints that ambiguously match multiple junction envelopes;
- connectors whose endpoint/tangent continuity exceeds tolerance.

No silent filtering: every rejected/unsafe production connector must be explainable in diagnostics.

#### M1.2 — Geometric safety checks

Strengthen validation so an active connector must satisfy:

- exact first/last endpoint equality;
- same-junction ownership for incoming end/outgoing start;
- every sampled point inside the allowed junction envelope;
- no pathological zero-length connector;
- tangent/heading change is finite;
- no outgoing lane starts in the wrong junction;
- no duplicate connector IDs or duplicate lane-pair routes.

Where practical, validate against compiler-owned road/junction geometry rather than only radial distance.

#### M1.3 — Production diagnostics contract

Expose compact snapshot fields suitable for browser assertions and future agents. Do not add player-facing debug UI unless needed; browser/API diagnostics are enough.

### Exit criteria

- production unsafe connector count is zero **for exposed/activatable connectors**;
- every unexplained orphan/ambiguity is either fixed or explicitly classified as non-routable;
- full CI green;
- movement still unchanged.

### Do not proceed to M2 if

- any activatable connector can leave road/junction authority;
- lane endpoint ownership is ambiguous in production;
- connector generation needs arbitrary building-aware shortcuts.

---

## M2 — Stable route-agent state model (pure data, no runtime driving)

### Goal

Replace “edge-local phase wraps from 1 back to 0” conceptually with a stable route identity, without feeding that state into local movement yet.

### Planned representation

A route agent should minimally retain:

- stable `tokenId` independent of current edge;
- `routeHop` / deterministic choice seed;
- current directed lane key;
- current route stage: `lane | connector`;
- current connector ID when crossing;
- next outgoing lane key when crossing;
- normalized or distance progress on the current stage;
- previous lane key for diagnostics/U-turn rules;
- archetype/traffic metadata required by materialization compatibility.

### Tasks

#### M2.1 — Pure route cursor

Implement a pure module that can advance:

`lane -> connector -> outgoing lane`

while consuming leftover simulation time and retaining the same token identity.

No scene, Phaser object, materializer or rendering dependency.

#### M2.2 — Deterministic continuation

Route choices must come from `TrafficLaneJunctionTopology.chooseContinuation(...)`, not from district-centre geometry.

Rules:

- non-U-turn continuation preferred;
- explicit U-turn permitted only when it is the only legal continuation;
- no connector means route cannot invent a path;
- deterministic token/hop input produces deterministic choice.

#### M2.3 — Compatibility projection

Define a projection from route agents back to existing per-edge traffic-load/flow diagnostics so macro population metrics can remain stable during migration.

Do **not** modify the live macro system in this task unless a pure adapter is proven first.

### Exit criteria

Unit tests prove:

- identity survives multiple junctions;
- remaining time is consumed across stage boundaries;
- no same-edge phase wrap masquerades as a trip;
- route choices use legal connector topology only;
- traffic count is conserved;
- compatibility projection preserves expected edge/district load semantics within documented tolerance.

---

## M3 — Shadow macro continuity bridge

### Goal

Run route-aware stable agents beside the existing macro traffic flow **without allowing them to control materialized cars**.

### Tasks

#### M3.1 — Initialize stable agents from current macro flows

Create deterministic stable identities from the current aggregate flow population once, then let route agents move across lane/connector/lane stages.

#### M3.2 — Shadow advance

Advance shadow agents on the same macro tick. Keep the existing live `trafficFlows` behaviour feeding current materialization until parity is proven.

#### M3.3 — Compare and instrument

Snapshot:

- stable agent count;
- route transitions;
- per-edge projected load;
- district projected load;
- dead-end events;
- U-turn fallback events;
- illegal/no-connector attempts (must remain zero for activatable paths).

### Exit criteria

- shadow mode does not change visible traffic;
- no identity loss;
- no unbounded agent creation/destruction;
- macro traffic count conserved over long simulated runs;
- projected density remains compatible enough that materialization budget/feel will not collapse when activated;
- full CI green.

---

## M4 — Local continuous traversal harness

### Goal

Prove a materialized test vehicle can physically follow `lane -> connector -> lane` using the existing lane-following authority, before connecting it to global macro identity.

### Tasks

#### M4.1 — Route-segment lane lookup

Allow the local behaviour layer to resolve both authored lane IDs and validated `traffic-connector:*` micro-lanes through one sampling interface.

Do not add a second steering implementation.

#### M4.2 — Exact handoff

At authored-lane completion:

1. retain current world x/y and heading;
2. switch route segment to connector whose first point equals current lane endpoint;
3. advance along connector;
4. at connector completion switch to outgoing authored lane whose first point equals connector endpoint;
5. continue without resetting position to a remote phase sample.

#### M4.3 — Turn-speed profile

Use bounded turn-speed intent by turn type if needed (straight > gentle turn > sharp/U-turn), but movement remains lane-following. No free-form “drive toward target lane” steering.

### Required tests

- straight connector traversal;
- right turn;
- left turn;
- legal U-turn fallback;
- exact position continuity at both handoffs;
- bounded heading change;
- connector path remains inside junction authority;
- no building/sidewalk shortcut.

### Exit criteria

Pure/integration harness can repeatedly cross representative intersections with no snap and no route escape.

---

## M5 — Lifecycle, materialization and pool-retention integration

### Goal

Make junction crossing safe from spawn/despawn churn while preserving forced-release semantics.

### Tasks

#### M5.1 — Route-aware lifecycle transition

Use actual route stage rather than only edge phase heuristics where possible:

- authored lane near end -> `APPROACH_JUNCTION`;
- connector active -> `CROSSING_JUNCTION`;
- outgoing lane established -> `CRUISING`/situational state.

#### M5.2 — Crossing retention

While `CROSSING_JUNCTION`:

- same `tokenId`;
- same pool slot;
- no normal release;
- no normal pool eviction;
- no archetype reset;
- no visual rematerialization.

#### M5.3 — Forced exits remain authoritative

Still permit explicit teardown for:

- leaving street layer;
- hijack/ownership transfer;
- destroyed/disabled entity flow where applicable;
- scene shutdown;
- explicit force release.

#### M5.4 — Orphan route handling

If route identity disappears or ends while the car is visible, never pop the car. Finish a safe visible stage or retain until offscreen according to the documented lifecycle contract.

### Exit criteria

Regression tests cover camera movement, pool pressure, layer switch and token disappearance while approaching/crossing.

---

## M6 — Opt-in browser activation at controlled junctions

### Goal

Activate the real route traversal only in a deterministic browser/test scenario before default free-roam traffic sees it.

### Activation rule

Use an explicit feature/test flag or scenario gate. Default gameplay traffic remains on the proven current path until this milestone passes.

### Required browser scenarios

At minimum:

- one straight crossing;
- one right turn;
- one left turn;
- repeated traversal through several connected intersections;
- camera follows the same `tokenId` across multiple route hops;
- camera pans away/back during approach/crossing;
- a route is followed near buildings/curbs that previously exposed shortcut bugs.

### Automated invariants

Capture/assert per-frame or sampled telemetry:

- stable token ID;
- stable slot ID/index;
- maximum position delta below teleport threshold;
- current lane/connector belongs to expected route;
- connector points remain in junction authority;
- outgoing side/direction is correct;
- no building/sidewalk overlap caused by route handoff.

### Exit criteria

Controlled browser activation is green and visually sane before any default traffic rollout.

---

## M7 — Junction occupancy, yielding and conflict handling

### Goal

Prevent otherwise-correct connector paths from producing intersection pile-ups/deadlocks.

### MVP traffic rule

Prefer a simple deterministic reservation/yield model over a simulated traffic-light system unless existing city data already owns signals.

- vehicle reserves its intended connector/conflict zone before entering;
- if reservation is unavailable, it waits on the incoming lane before the connector;
- once inside a connector, it should normally clear the junction rather than voluntarily stop in the middle;
- physically blocked vehicles may still enter `BLOCKED` and remain lifecycle-protected;
- reservations have expiry/recovery so a vanished/destroyed car cannot deadlock the junction.

### Tasks

- define connector conflict/occupancy grouping;
- deterministic reservation ordering;
- following/yield behaviour at approach;
- release reservation on connector exit/forced teardown;
- deadlock timeout/recovery;
- multi-car tests from perpendicular approaches.

### Exit criteria

- no two cars are intentionally assigned conflicting connector occupancy at once;
- no indefinite mid-junction yield deadlock;
- FOLLOWING/AVOIDING/BLOCKED semantics remain compatible;
- browser contention tests green.

---

## M8 — Default runtime route activation and macro migration

### Goal

Make stable route agents + connector traversal the default civilian traffic path.

### Tasks

#### M8.1 — Feed materialization from stable route identity

Materializer consumes stable route tokens rather than edge-local ephemeral identity.

#### M8.2 — Retire edge-local wrap as route semantics

The macro system may retain aggregate flow views for diagnostics/load, but visible route identity must no longer wrap `phase 1 -> phase 0` on the same edge as its continuity mechanism.

#### M8.3 — Production browser soak

Add bounded soak coverage across normal free-roam traffic:

- multiple vehicles;
- many route hops;
- camera movement;
- player driving around/through traffic;
- police escalation present as regression coverage;
- rooftop/street layer switch;
- traffic pool remains bounded.

Track at least:

- illegal route transitions = 0;
- unsafe connector uses = 0;
- teleport events = 0;
- duplicate stable token IDs = 0;
- mid-crossing normal despawns = 0;
- pool budget violations = 0.

#### M8.4 — Performance

Ensure route identity/connector lookups do not materially regress browser performance. Pre-index topology; do not scan all junctions/lanes every frame.

### Exit criteria

Default runtime uses lane/junction topology and full CI is green.

---

## M9 — Legacy cleanup, documentation and user validation gate

### Goal

Remove obsolete architecture and stop for final gameplay validation.

### Tasks

- remove or clearly retire unused `MacroTrafficRouteContinuityPolicy` experiment;
- remove or clearly retire unused `TrafficIntentDrivingPolicy` experiment;
- remove compatibility code that no longer has a runtime consumer;
- ensure there is exactly one route-geometry authority;
- update traffic architecture docs/report;
- update status to `final-validation-pending`;
- provide a short manual playtest checklist and preview/deployment link if available.

### Final manual playtest checklist

The user should be able to observe:

1. Follow the same civilian car through 5+ intersections; it remains the same vehicle.
2. Straight/right/left turns stay on road and enter the correct side.
3. No car cuts across sidewalks/buildings between junctions.
4. No visible disappear/reappear at intersection boundaries.
5. Cars queue/yield before an occupied junction rather than freezing in its centre.
6. Camera movement does not recycle a crossing vehicle.
7. Rooftop/street switching still clears/rematerializes civilian traffic correctly.
8. Player traffic collisions/obstacle avoidance still work.
9. Wanted 2/3 police behaviour from #71 has not regressed.

### Final gate

- explicit user gameplay approval required;
- autonomous work stops at `final-validation-pending`;
- **no automatic merge** of #73 without that approval.

---

# Validation ladder

Every agent iteration should run/observe the smallest relevant level first, then escalate.

1. Focused unit test(s) for the changed module.
2. `npm run test:unit` / repository unit CI.
3. Affected browser/system test(s).
4. Full GitHub Tests workflow when the milestone changes runtime integration.
5. Browser soak/manual evidence only after prior layers are green.

Do not weaken unrelated tests merely to obtain green CI. If `main` introduces a changed invariant, first determine whether the branch is stale and synchronize it before modifying expectations.

# Main-branch synchronization rule

At the start of every new milestone and before final merge:

1. fetch live PR/head/main state;
2. compare the PR base/head with current `main`;
3. inspect changes touching:
   - `tools/city-compiler/generate-road-topology.js`;
   - `traffic-lanes.json` or its generator;
   - `phaser/src/streaming/` traffic/materialization/lifecycle;
   - road/junction collision authority;
4. integrate `main` first if those authorities changed;
5. rerun the relevant topology/traffic tests.

Presentation-only street/atmosphere changes should not become traffic geometry authority.

# Agent execution discipline

Work one bounded `nextTask` from `docs/progress/traffic-lane-junction-topology-status.json` at a time.

For every completed task:

- implement the smallest coherent change;
- add/update focused tests;
- update the machine-readable status JSON;
- append evidence to the progress log;
- update the roadmap only if the contract genuinely changes;
- update the PR summary if milestone state materially changes;
- do not silently start the next risky activation milestone while CI for the current one is red.

If a task reveals a deeper architectural issue, preserve the authority stack above and revise the roadmap/status explicitly rather than inserting a local shortcut.
