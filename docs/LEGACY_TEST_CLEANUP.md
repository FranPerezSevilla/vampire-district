# Legacy test authority cleanup

_Last updated: 2026-08-18_

This document tracks the final test-authority cleanup after the active ViceBlood playtest systems were implemented and performance-reviewed on PR #55. Runtime behavior is not to be changed merely to satisfy assertions that still encode superseded implementation details or tuning values.

## Baseline before cleanup

At commit `9b3d2c8a6dfc996dfa13f61f15872662ff24cea9`, the unit suite executed **478 tests: 469 passed and 9 failed**. The recently added civilian-traffic camera-guard regressions passed; the remaining failures were older assertions grouped into three areas:

1. one audio regression still expected the pre-ballistic direct hitscan `candidate` damage path;
2. three urban witness/network assertions still encoded the previous pedestrian-route/surface wording and population assumptions;
3. five vehicle exit/impact-buffer assertions still encoded earlier Heat tuning and pre-topology exit geometry.

Each group must be reviewed against current runtime authority before its tests are changed. Useful coverage must be preserved; no test may be deleted merely to reduce the failure count.

## Increment 1 — ballistic `bulletHitBody` authority

**State: updated on PR #55.**

The `bulletHitBody` audio regression was legitimately stale. Player pistol fire no longer resolves an instantaneous direct `candidate` hit. `CombatSystem` now creates a travelling ballistic projectile and resolves the first actual impact in `completeProjectileImpact()`.

The regression now verifies the current contract:

- a confirmed projectile impact on an NPC routes through `applyHit(impact.npc, projectile.config, projectile.attackId)`;
- prop impacts remain on the prop-damage path rather than emitting the human-NPC hit event;
- `combat:hit` remains the single human-NPC hit event consumed by `WeaponSystem`;
- `WeaponSystem` still gates `bulletHitBody` playback to hitscan weapons.

No runtime or audio behavior was changed by this cleanup.

## Remaining cleanup

The urban witness/network and vehicle exit/impact-buffer failures remain deliberately untouched in this increment. They should be handled as separate evidence-backed cleanup increments so current gameplay semantics are not silently rewritten to match old tests.
