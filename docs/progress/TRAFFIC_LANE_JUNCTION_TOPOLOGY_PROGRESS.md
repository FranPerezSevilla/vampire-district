# Traffic lane / junction topology progress

Append-only execution log for PR #73 (`codex/traffic-junction-topology`).

Canonical current state lives in `docs/progress/traffic-lane-junction-topology-status.json`; this file records how that state was reached and why decisions were made.

---

## 2026-08-21 — M0 foundation implemented

### Problem carried from PR #71

An earlier continuity experiment used macro street connectivity as local driving authority. Manual playtest showed the abstraction was invalid: civilian cars could cross sidewalks/buildings, shortcut between intersections and enter the wrong side of roads.

The unsafe runtime activation was removed before PR #71 merged. #71 intentionally left authored local lanes as movement authority and established lifecycle retention/police behaviour independently.

### Decision

Create a new lane-level topology rather than trying to make the macro graph more geometric.

Target path:

`directed authored lane -> validated connector micro-lane -> directed authored lane`

The macro layer may later own stable route identity/load, but it will never own local path coordinates.

---

## 2026-08-21 — M0.1–M0.5 directed topology and connector geometry

### Implemented

Added `phaser/src/streaming/TrafficLaneJunctionTopology.js` with:

- directed lane identity (`edgeId + direction`);
- geometric lane start/end ownership by authored junction;
- incoming/outgoing lane indexing per junction;
- deterministic legal continuation selection;
- immediate U-turn avoidance when alternatives exist;
- straight/left/right/U-turn classification;
- sampled connector curves from exact incoming endpoint to exact outgoing start;
- junction-envelope safety measurement;
- connector IDs suitable for micro-lane injection.

### Key architectural choice

Connectors use exact lane endpoints and authored junction authority. They are not curves toward macro district/node centres. This guarantees that the eventual route stage change can occur without resetting the vehicle to a remote coordinate.

### Tests

Added `tests/traffic-lane-junction-topology.test.js` covering:

- directed endpoint ownership;
- legal outgoing choices;
- deterministic U-turn avoidance;
- exact connector endpoints;
- junction-envelope confinement;
- curve bending through junction authority rather than block-level shortcut geometry.

---

## 2026-08-21 — M0.6 read-only runtime installation

### Implemented

`TrafficLocalAssignmentPolicy` installs the lane/junction topology after lane-manifest initialization.

Validated connector micro-lanes are injected into the loaded lane manifest as `traffic-connector:*` edges for lookup/diagnostics.

### Safety boundary

No traffic token is assigned to connector micro-lanes yet.

Current movement remains owned by the pre-existing authored local lane path. This makes M0 safe to ship/test without altering driving behaviour.

Diagnostics explicitly report:

- topology readiness;
- lane/junction/connection counts;
- unsafe connector count;
- injected connector count;
- current lane authority remains `authored-local-lanes`.

---

## 2026-08-21 — M0.7/M0.8 validation complete

### CI evidence

Implementation head: `f481add4c79d6705de017e67e08810de35a24347`

GitHub Tests #2046 / run `32472690729`:

- `unit-tests` — success;
- `browser-boot` — success;
- `browser-campaign` — success;
- `browser-systems (shard 1/3)` — success;
- `browser-systems (shard 2/3)` — success;
- `browser-systems (shard 3/3)` — success;
- building visual review — skipped by workflow conditions.

### Result

M0 is complete: topology exists, is tested, is loaded read-only and does not change visible traffic movement.

---

## 2026-08-21 — Autonomous continuation package created

### Reason

PR #73 is expected to continue over multiple sessions/agents. Chat history must not be required to understand architecture, current state or the next safe task.

### Added canonical handoff files

- `docs/roadmaps/TRAFFIC_LANE_JUNCTION_TOPOLOGY_ROADMAP.md`
- `docs/agents/TRAFFIC_LANE_JUNCTION_TOPOLOGY_AGENT.md`
- `docs/progress/traffic-lane-junction-topology-status.json`
- this append-only progress log

The original task boundary remains:

- `docs/agent-tasks/2026-08-21-traffic-lane-junction-topology.md`

### Roadmap shape

- M0 — read-only topology foundation — complete
- M1 — production topology audit and hard safety contract — next
- M2 — pure stable route-agent model
- M3 — shadow macro continuity bridge
- M4 — local continuous traversal harness
- M5 — lifecycle/materialization/pool retention
- M6 — opt-in browser activation
- M7 — junction occupancy/yielding/conflicts
- M8 — default runtime activation + macro migration
- M9 — legacy cleanup + user gameplay validation gate

### Locked rules

- macro graph does not provide local path geometry;
- no free-form drive-toward-next-lane steering;
- no position snap at route-stage boundaries;
- connector geometry must stay inside authored junction authority;
- current local lane follower is reused rather than replaced;
- stable token + pool slot survive crossing;
- no normal crossing despawn/eviction;
- `MacroTrafficRouteContinuityPolicy` and `TrafficIntentDrivingPolicy` are not re-enabled wholesale;
- final merge requires explicit user gameplay approval.

### Exact next step

Execute `M1.1-production-manifest-audit` from the machine-readable status JSON. Do not activate connector movement yet.
