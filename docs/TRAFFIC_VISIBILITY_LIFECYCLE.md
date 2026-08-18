# Civilian traffic visibility lifecycle

_Last updated: 2026-08-18_

**State: implemented on PR #55; regression coverage added.**

This increment closes the civilian-traffic pop-in/pop-out requirement without introducing a second traffic authority. The existing macro traffic remains continuous; only its local visual/physical representation is materialized near the player.

## Runtime contract

- A new civilian traffic slot cannot materialize inside the current camera view or its **54 px spawn guard**. The local car therefore enters from outside the visible viewport rather than appearing in front of the player.
- Materialized traffic uses a wider removal envelope than its spawn envelope. `TrafficMaterializationSystem` keeps the base **300 px camera despawn margin**, while `TrafficLocalAssignmentPolicy` retains active local cars through a **360 px camera retention margin** and a **120 px viewport guard**. These different thresholds provide explicit hysteresis rather than allowing a car to oscillate in and out at one boundary.
- Once a car is locally materialized, retention decisions use the **local slot position** rather than the macro token position. A temporary chunk-readiness change cannot delete a car that is still in or near the camera.
- A normal release is refused while the local vehicle still intersects the guarded viewport. Forced release remains available for explicit state transitions such as the player hijacking that traffic vehicle.
- Local traffic uses a fixed object pool. Despawn deactivates and hides a slot; it does not destroy its Phaser container. A later eligible macro token reuses that slot and its existing visual objects.
- The traffic snapshot exposes spawn/despawn/retention margins plus prevented-visible-despawn counters so a playtest or browser diagnostic can verify the lifecycle without guessing from visuals.

## Regression coverage

`tests/traffic-visibility-lifecycle.test.js` now verifies the complete boundary contract:

1. a macro token inside the camera or spawn guard is not materialized;
2. a token beyond the spawn guard can materialize while still close enough to the simulation focus;
3. a visible local car cannot be released, including during a transient streaming-readiness loss;
4. a car outside both the retention envelope and follow radius can be released; and
5. the same pooled slot/container is reused when traffic later becomes eligible again.

## Acceptance

- No civilian vehicle may appear inside the visible camera during ordinary traffic simulation.
- No civilian vehicle may disappear while it is still in or near the guarded viewport.
- Crossing a boundary back and forth must not cause rapid materialize/despawn churn.
- Ordinary traffic lifecycle changes reuse pooled objects rather than creating/destroying a new visual on every transition.
- Explicit narrative/player-owned transitions may still force a release when that transition itself explains the disappearance.

With pedestrian-route expansion, hospital recovery, accidental civilian impacts and this visibility lifecycle already implemented, the next ordered development item is the measured vehicle-speed review and regression benchmark.
