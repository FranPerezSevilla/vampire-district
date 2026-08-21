# Traffic lane / junction topology agent contract

Operational handoff contract for PR #73 (`codex/traffic-junction-topology`).

A new agent/conversation should be able to continue this initiative from the PR reference alone by following this file.

## Bootstrap: read these in order

Before changing code:

1. Read PR #73 live and record its current head SHA, base SHA, draft state and CI state.
2. Read `docs/progress/traffic-lane-junction-topology-status.json`.
3. Read `docs/roadmaps/TRAFFIC_LANE_JUNCTION_TOPOLOGY_ROADMAP.md`.
4. Read `docs/agent-tasks/2026-08-21-traffic-lane-junction-topology.md`.
5. Read the latest entries in `docs/progress/TRAFFIC_LANE_JUNCTION_TOPOLOGY_PROGRESS.md`.
6. Inspect the files named in `nextTask.readFirst` in the status JSON.
7. Compare the branch against current `main` before beginning a new milestone.

Do not rely on old chat context when these canonical files disagree with it. The branch + status JSON + roadmap are authoritative for continuation.

## Current architectural problem

The game needs stable civilian vehicle continuity through intersections.

A previous experiment routed cars from one macro street edge to another using macro graph connectivity and then steered locally toward the new edge. That was invalid because the macro graph does not encode drivable lane geometry. It caused cars to:

- cross sidewalks;
- pass through buildings;
- shortcut from one junction to another;
- turn into the wrong side of the road;
- produce visually implausible intersection handoffs.

The replacement architecture is:

`directed authored lane -> validated junction connector micro-lane -> directed authored lane`

Stable route identity decides **which** sequence to follow. Existing/local lane-following code decides **where the vehicle physically is**.

## Hard authority boundaries

### Geometry authority

The only legal local driving geometry is derived from:

- compiler-owned road/junction topology;
- `phaser/assets/city/packs/traffic-lanes.json`;
- validated connector micro-lanes derived by `TrafficLaneJunctionTopology`.

The following are **not** legal local driving geometry:

- macro district centres;
- macro graph node centres;
- straight lines between streets;
- a target point on another lane used by free-form steering;
- nearby building geometry used to guess a road path.

### Route authority

A route layer may choose a legal continuation returned by `TrafficLaneJunctionTopology`, retain token identity and track route stage/progress. It may not invent connector coordinates.

### Movement authority

Use the existing local lane-following/sampling path for authored lanes and connector micro-lanes. Do not reintroduce `TrafficIntentDrivingPolicy` as a second movement model.

### Lifecycle authority

Lifecycle/materialization controls retention and release. It does not choose where a car drives.

### Macro authority

Macro traffic owns cheap population/load simulation. It may later carry stable route identities, but local x/y must always come from lane/connector geometry.

## Forbidden shortcuts

Never do any of the following to make a test pass:

- re-enable `MacroTrafficRouteContinuityPolicy` wholesale;
- re-enable `TrafficIntentDrivingPolicy` wholesale;
- set a materialized car directly to the first sample of a remote outgoing lane;
- steer a car in open world space toward a future lane until it “finds” the road;
- increase camera/despawn margins as a substitute for stable route identity;
- suppress unsafe connectors without reporting/counting why they are unsafe;
- treat a macro graph edge as equivalent to a directed traffic lane without topology validation;
- hand-edit generated city topology instead of fixing the generator/authority;
- weaken an unrelated browser test before checking whether the branch is stale against `main`;
- let a presentation-only sidewalk/road rendering layer become navigation authority.

## Stable identity contract

Once route activation begins, a traffic identity must be independent of the edge it currently occupies.

A valid stable route agent should keep at least:

- `tokenId`;
- current directed lane key;
- current stage (`lane` or `connector`);
- connector ID if crossing;
- next outgoing lane key if crossing;
- route hop/seed;
- stage progress;
- previous lane key/history needed for diagnostics and U-turn rules.

Do not derive the identity from `${currentEdgeId}#${tokenIndex}` after the agent can move to another edge; that would make identity change at every junction.

## Junction handoff contract

For a visible vehicle:

1. follow incoming authored lane;
2. enter `APPROACH_JUNCTION` near its end;
3. choose a legal connector from topology;
4. retain token + pool slot;
5. switch route stage to connector at the exact incoming endpoint;
6. enter `CROSSING_JUNCTION`;
7. follow connector samples using lane-following authority;
8. switch to outgoing authored lane only at the connector's exact endpoint;
9. return to normal cruising/situational lifecycle;
10. never reset world position merely because the route stage changed.

## Coordinate continuity test rule

Any runtime activation must expose enough telemetry to detect a teleport.

At minimum track per stable token:

- previous x/y;
- current x/y;
- current route segment ID;
- previous route segment ID;
- transition type;
- expected movement distance based on speed/dt or a conservative transition threshold.

A route-stage transition is invalid if it causes a position jump that cannot be explained by normal movement in that frame.

Do not hide a snap by loosening the threshold dramatically. The exact connector endpoints are designed to make stage boundaries continuous.

## Road-side correctness

Each authored road edge has distinct forward/reverse lane polylines. Preserve the selected direction across route planning.

When choosing an outgoing continuation, use the directed lane key from topology. Do not choose an undirected road and then infer a lane later from proximity.

This rule exists specifically to prevent cars turning into the oncoming lane.

## Dead ends / U-turns

Default policy:

1. prefer non-U-turn legal continuations;
2. if none exist, an explicit validated U-turn connector may be used;
3. if no legal connector exists, the route may end and be retired offscreen through lifecycle/materialization;
4. never teleport/reverse visibly at the endpoint as a fallback.

If production topology reveals a special dead-end shape that cannot satisfy this, document it and add a focused fixture before changing the rule.

## Junction conflict MVP

When milestone M7 begins, use a simple deterministic reservation/yield model unless existing authored data already owns traffic signals.

Expected behaviour:

- reserve intended connector/conflict zone before entering;
- wait on incoming lane when unavailable;
- do not voluntarily stop in the middle of a connector after entry;
- release reservation on exit and forced teardown;
- recover expired reservations if an entity disappears/dies;
- allow physical `BLOCKED` state if another object actually prevents exit.

Do not build a traffic-light simulation as incidental scope.

## Milestone execution protocol

The status JSON contains one `nextTask`. Work only that task unless it explicitly bundles substeps.

For each task:

1. verify PR/head/main live;
2. synchronize with `main` if relevant authorities changed;
3. read `nextTask.readFirst`;
4. implement the smallest coherent change;
5. add focused tests before/beside runtime activation;
6. run/observe focused and unit validation;
7. if runtime changed, require relevant browser coverage;
8. if CI fails, diagnose logs/artifacts rather than guessing;
9. update status JSON in the same iteration;
10. append one progress entry with commit/head, tests and architectural decisions;
11. update PR body only when milestone/current task state materially changes.

Do not automatically begin the next risky runtime milestone while the current head has unresolved CI failures.

## Main synchronization protocol

At the beginning of every milestone, compare current branch with live `main`.

Pay special attention if `main` changed any of:

- `tools/city-compiler/generate-road-topology.js`;
- generated topology inputs;
- `phaser/assets/city/packs/traffic-lanes.json`;
- `phaser/src/streaming/TrafficMaterializationSystem.js`;
- `TrafficLocalBehaviorSystem` or related lane follower;
- `TrafficLifecyclePolicy.js`;
- `TrafficLocalAssignmentPolicy.js`;
- collision/road/junction gameplay authority.

If one changed, integrate `main` before advancing the milestone, then rerun topology/traffic tests.

Presentation changes may be integrated normally but must not be treated as new gameplay geometry unless their owning PR explicitly changes the gameplay contract.

## CI policy

Use the smallest useful validation first, then full CI at milestone/runtime boundaries.

Expected ladder:

1. focused `node --test` file(s);
2. unit suite;
3. affected browser test(s);
4. full Tests workflow for runtime integration;
5. browser soak/telemetry for default activation.

If a previously unrelated test fails:

- check whether it fails on current `main` or came from a newly merged invariant;
- inspect the failing assertion/log;
- do not change game code merely to satisfy a stale assertion;
- do not merge a red head.

## Documentation update contract

Canonical files:

- roadmap: `docs/roadmaps/TRAFFIC_LANE_JUNCTION_TOPOLOGY_ROADMAP.md`;
- agent contract: this file;
- machine state: `docs/progress/traffic-lane-junction-topology-status.json`;
- append-only progress: `docs/progress/TRAFFIC_LANE_JUNCTION_TOPOLOGY_PROGRESS.md`;
- task boundary: `docs/agent-tasks/2026-08-21-traffic-lane-junction-topology.md`;
- PR: #73.

### Status JSON

Update at every meaningful task boundary:

- `updatedAt`;
- `head` when known;
- `state`;
- `currentMilestone`;
- `currentTask`;
- `completedTasks`;
- milestone state;
- validation evidence;
- `nextTask`.

`nextTask` must be concrete enough that another agent can start without asking what to do.

### Progress log

Append only. Each entry should contain:

- date/time if useful;
- task/milestone;
- what changed;
- decision/why;
- validation evidence;
- exact next step.

Do not rewrite history just because the plan changed; add a correction entry and update the roadmap/status.

## Autonomous vs user-gated work

The agent may autonomously continue M1 through M8 while the roadmap gives an unambiguous safe implementation path and CI remains diagnosable.

Stop and ask for user input only when:

- a choice changes visible traffic rules/design beyond the roadmap (for example introducing signals/one-way rules not already authored);
- current city data makes the hard invariants mutually incompatible and no deterministic technical fix exists;
- final gameplay validation is reached.

Do **not** stop merely because implementation is difficult. Make bounded progress, document it and continue to the next safe subtask when possible.

## Final gate

At M9:

- set status to `final-validation-pending`;
- keep PR draft or otherwise unmerged;
- provide user with preview/deployment path if available;
- provide the manual checklist from the roadmap;
- wait for explicit user gameplay approval;
- **never auto-merge #73**.

## Fast continuation prompt for a future conversation

A user message such as:

> Continue ViceBlood PR #73 following its canonical traffic lane/junction roadmap. Work from the machine-readable next task and keep the PR/docs updated.

should be sufficient. The agent must retrieve the live PR and canonical files above rather than asking the user to restate prior context.
