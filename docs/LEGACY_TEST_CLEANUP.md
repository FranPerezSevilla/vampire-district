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

**State: updated and CI-verified on PR #55.**

The `bulletHitBody` audio regression was legitimately stale. Player pistol fire no longer resolves an instantaneous direct `candidate` hit. `CombatSystem` now creates a travelling ballistic projectile and resolves the first actual impact in `completeProjectileImpact()`.

The regression now verifies the current contract:

- a confirmed projectile impact on an NPC routes through `applyHit(impact.npc, projectile.config, projectile.attackId)`;
- prop impacts remain on the prop-damage path rather than emitting the human-NPC hit event;
- `combat:hit` remains the single human-NPC hit event consumed by `WeaponSystem`;
- `WeaponSystem` still gates `bulletHitBody` playback to hitscan weapons.

No runtime or audio behavior was changed by this cleanup.

## Increment 2 — urban pedestrian/witness authority

**State: updated and CI-verified on PR #55.**

The three `urban-witness-network` failures were legitimately stale after the citywide pedestrian-route expansion and generalized pedestrian-surface work. The runtime already had matching focused coverage in `pedestrian-route-expansion.test.js`; the older network test was still asserting the previous sidewalk-only vocabulary and a pre-capacity population formula.

The regression now verifies the current contract:

- routed civilian population is checked against each route's actual capacity, `min(AMBIENT_PEDESTRIANS_PER_ROUTE, route.points.length)`, including authored routed civilians that reserve a route point before ambient fill;
- each route still receives its full capacity without two routed civilians sharing the same origin and every start remains on valid pedestrian geometry;
- foot-police patrol routes use the generalized `pedestrian` surface authority rather than the retired `sidewalk` label;
- ordinary witness flight still follows pedestrian space monotonically and reports exactly once, while its presentation assertion matches the current pedestrian-space wording.

No runtime, population density, police routing or witness behavior was changed by this cleanup.

## Increment 3 — vehicle impact Heat and exit-corridor authority

**State: updated and CI-verified on PR #55.**

The remaining five failures were legitimately stale rather than evidence of five runtime regressions. Four assertions still hard-coded an older vehicle-pedestrian Heat curve and older threshold ceilings, while the vehicle-exit fixture only provided a 16-unit usable corridor after an anchor even though the current safety authority requires an 18-unit sampled escape corridor.

The regressions now verify the current contracts rather than obsolete tuning literals:

- lethal and non-lethal impact sequences derive their expected steps from `vehiclePedestrianImpactBaseHeat()` and still prove that Heat diminishes across a burst;
- a burst is checked against `vehiclePedestrianBurstCeiling()` rather than old absolute ceiling values, preserving the rule that one rapid incident cannot skip more than one Wanted band;
- a genuinely separate later incident begins only after the previous impact timestamp plus `PEDESTRIAN_IMPACT_BURST_WINDOW_MS`, resets the chain and can escalate the next response band;
- non-lethal impacts remain strictly lower than corresponding lethal impacts without freezing yesterday's tuning values into the regression;
- vehicle exit selection must find a standable anchor plus the full current escape corridor, return a standable endpoint and publish a normalized escape direction; a pixel-sized isolated landing point remains rejected.

No runtime, Heat tuning, vehicle geometry or exit behavior was changed by this cleanup.

## Increment 4 — civilian traffic collision Heat authority

**State: updated and CI-verified on PR #55.**

The browser regression for a hard collision between the player's car and materialized civilian traffic still expected the collision to raise local police Heat. That expectation conflicts with the accepted target-aware vehicle consequence rule: ordinary transient/systemic civilian car-to-car contact is mundane, while contact with a police vehicle is the explicit Heat-producing exception.

The regression keeps the useful collision coverage and now verifies the current contract:

- a hard civilian traffic collision damages the active vehicle exactly once;
- the impact remains outside Exposure and does not increase local Heat;
- the traffic-impact authority reports the `hard` tier and applies its suppression cooldown;
- an immediate repeated overlap is suppressed and cannot stack another vehicle-damage application;
- the materialized traffic token remains assigned to the same pooled slot through the collision.

No runtime collision, Heat, damage, pooling or police behavior was changed by this cleanup.

## Increment 5 — predator-power Vitality and evidence authority

**State: updated and fully CI-verified on PR #55.**

The last known browser-system regression mixed two superseded assumptions into `predator-powers.spec.js`.

First, the critical-pressure fixture still treated enemy damage as a Hunger increase. The current combat authority deliberately separates those resources: incoming enemy damage reduces `PlayerDamageSystem` Vitality, while Hunger remains the Beast-pressure/vulnerability resource. The regression now starts at Hunger 99 and Vitality 100, applies a controlled five-point melee strike through `damagePlayer()`, and verifies Vitality 95, Hunger still 99, normal hit stun, and no mission failure.

Second, the Give In assertion assumed that any witnessed supernatural display immediately created institutional Exposure evidence. `WitnessSystem.onSuspiciousPower()` instead creates visible-power evidence through the actual observer authority. A civilian who sees the act creates latent evidence; it becomes institutional immediately only when an eligible police/hunter observer actually sees it, or later through the normal reporting path. The deterministic fixture has a civilian witness, so the regression now requires the correct latent record while still proving that the witness alarms and Give In's combat/movement modifiers activate.

No predator-power, damage, Hunger, Exposure, witness, police or mission runtime behavior changed in this increment.

## Final automated regression state

The cleanup is complete for every known stale authority cluster on the current PR #55 head. CI run `32128631484` on code head `e9483f424f41cba22de7c02a7f447dffb097418b` is fully green:

- **479/479 unit tests pass**;
- browser boot passes;
- browser campaign passes;
- browser systems shards 1/3, 2/3 and 3/3 all pass;
- City Compiler validation passes with **0 errors / 0 warnings** and score **87.9 / A**.

The final rule remains unchanged: a future failing regression must be investigated against current runtime authority. A green baseline is not permission to rewrite a legitimate new failure as “legacy.”
