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

## Increment 2 — urban pedestrian/witness authority

**State: updated on PR #55.**

The three `urban-witness-network` failures were legitimately stale after the citywide pedestrian-route expansion and generalized pedestrian-surface work. The runtime already had matching focused coverage in `pedestrian-route-expansion.test.js`; the older network test was still asserting the previous sidewalk-only vocabulary and a pre-capacity population formula.

The regression now verifies the current contract:

- routed civilian population is checked against each route's actual capacity, `min(AMBIENT_PEDESTRIANS_PER_ROUTE, route.points.length)`, including authored routed civilians that reserve a route point before ambient fill;
- each route still receives its full capacity without two routed civilians sharing the same origin and every start remains on valid pedestrian geometry;
- foot-police patrol routes use the generalized `pedestrian` surface authority rather than the retired `sidewalk` label;
- ordinary witness flight still follows pedestrian space monotonically and reports exactly once, while its presentation assertion matches the current pedestrian-space wording.

No runtime, population density, police routing or witness behavior was changed by this cleanup.

## Increment 3 — vehicle impact Heat and exit-corridor authority

**State: updated on PR #55; final CI verification required.**

The remaining five failures were legitimately stale rather than evidence of five runtime regressions. Four assertions still hard-coded an older vehicle-pedestrian Heat curve and older threshold ceilings, while the vehicle-exit fixture only provided a 16-unit usable corridor after an anchor even though the current safety authority requires an 18-unit sampled escape corridor.

The regressions now verify the current contracts rather than obsolete tuning literals:

- lethal and non-lethal impact sequences derive their expected steps from `vehiclePedestrianImpactBaseHeat()` and still prove that Heat diminishes across a burst;
- a burst is checked against `vehiclePedestrianBurstCeiling()` rather than old absolute ceiling values, preserving the rule that one rapid incident cannot skip more than one Wanted band;
- a genuinely separate later incident begins only after the previous impact timestamp plus `PEDESTRIAN_IMPACT_BURST_WINDOW_MS`, resets the chain and can escalate the next response band;
- non-lethal impacts remain strictly lower than corresponding lethal impacts without freezing yesterday's tuning values into the regression;
- vehicle exit selection must find a standable anchor plus the full current escape corridor, return a standable endpoint and publish a normalized escape direction; a pixel-sized isolated landing point remains rejected.

No runtime, Heat tuning, vehicle geometry or exit behavior was changed by this cleanup.

## Remaining cleanup

No known legacy unit-test authority groups remain after this increment. If the branch-wide suite is green on the resulting head, the implementation/test-cleanup work for this task is complete and the remaining work is grouped in-game validation of the already implemented systems.
