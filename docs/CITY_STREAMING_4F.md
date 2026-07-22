# City Streaming 4F — graduated traffic impact consequences

_Last updated: 2026-07-22_

## Status

**Implementation candidate.**

City Streaming 4F separates ordinary soft traffic contact from genuinely dangerous high-speed impacts. It observes the contact already resolved by 4E and applies damage, noise, exposure and police heat only when configured impact-speed thresholds are exceeded.

Ambient traffic remains pooled, non-enterable and non-persistent. Only the player-driven campaign vehicle receives hull damage.

## Goals

- preserve 4E soft pushes below the hard-impact threshold;
- classify contacts deterministically as soft, hard or severe;
- apply bounded hull damage to the player-driven vehicle on hard impacts;
- apply stronger damage and a temporary ambient-traffic stall on severe impacts;
- generate crash audio, exposure and local police heat only for hard or severe impacts;
- suppress repeated consequences while the same proxy remains in contact across frames;
- preserve macro-token and pool-slot identity;
- persist player-vehicle damage without adding ambient-traffic persistence.

## Authority model

```text
TrafficPhysicalConsequencesSystem
  owns contact geometry, push, block and physical offset

TrafficImpactConsequencesSystem
  observes completed contacts and owns graduated consequences

VehicleSystem
  owns player-vehicle health and campaign persistence

ExposureSystem / PoliceSystem
  own visibility consequences and local response
```

4F wraps the public `VehicleSystem.updateDriving()` method after 4E has installed its own wrapper. The wrapper records the contact count before the frame, runs 4E, and processes a consequence only when a new physical contact was reported.

The original 4E driving wrapper is restored when 4F is destroyed.

## Impact tiers

Default thresholds:

```text
soft contact      below 125 speed units
hard impact       125 through 209
severe impact     210 or more
```

These thresholds operate on the existing internal vehicle-speed scale. They do not alter acceleration, maximum speed or camera behaviour.

### Soft

Soft contact remains entirely within 4E:

- bounded proxy push or blocked contact;
- player speed damping;
- no hull damage;
- no exposure;
- no police heat;
- no crash consequence event.

### Hard

A hard impact adds:

- player-vehicle hull damage;
- a stronger post-contact speed reduction;
- crash audio;
- low exposure gain;
- local police heat;
- a short ambient-traffic hold.

### Severe

A severe impact adds:

- a higher minimum damage and damage multiplier;
- stronger player-speed loss;
- greater exposure and local heat;
- a temporary `impact-stalled` state for the ambient proxy;
- explicit player feedback that police were alerted.

The ambient proxy still has no health and cannot be permanently destroyed or disabled.

## Damage model

4F reuses `vehicleImpactDamage()` from the existing vehicle model.

Default profile:

```text
damage threshold             105
base damage scale            0.018
hard minimum damage          4
severe minimum damage        16
severe damage multiplier     1.35
```

Only the player-driven persistent vehicle receives damage. The updated condition is persisted through the existing campaign vehicle service with no save-schema change.

## Exposure and police response

Default profile:

```text
hard exposure                2
severe exposure              5
maximum exposure             7
hard local heat minimum      7
severe local heat minimum    15
maximum local heat           24
```

Exposure continues to use `ExposureSystem.add()`. Local heat additionally uses `PoliceSystem.addHeat()` so nearby patrols can investigate the collision location before a global wanted-level transition is necessarily reached.

## Cooldown and frame safety

A materialized proxy receives a consequence cooldown after a hard or severe impact:

```text
impact cooldown              0.90 seconds
```

Contacts reported during that cooldown still use 4E geometry and blocking but do not apply more damage, exposure, heat or audio. The diagnostic counter records these suppressed contacts.

The cooldown belongs to the local token. It is discarded if the proxy dematerializes.

## Traffic stall

Default holds:

```text
hard hold                    0.42 seconds
severe stall                 2.20 seconds
```

4F extends 4E's behaviour constraint while a severe stall is active:

```text
impact-stalled
```

The proxy retains the same macro token and pool slot. Once the stall expires, 4D following and catch-up rules resume, and 4E continues safe offset recovery.

## Speed retention

The player vehicle already receives the normal 4E contact damping. 4F then applies an additional tier-specific retention:

```text
hard retention               0.68
severe retention             0.35
```

This produces a noticeable collision response without adding a second vehicle-kinematics implementation.

## Runtime order

```text
TrafficMaterializationSystem
TrafficLocalBehaviorSystem
TrafficPhysicalConsequencesSystem
TrafficImpactConsequencesSystem
VehicleSystem driving frame
```

4F's update step decrements per-token cooldown and stall timers before the driving frame.

## Diagnostics

```js
window.NBD_TRAFFIC_IMPACTS.snapshot()
window.NBD_TRAFFIC_IMPACTS.classify(speed)
window.NBD_TRAFFIC_IMPACTS.damage(speed)
window.NBD_TRAFFIC_IMPACTS.exposure(speed)
window.NBD_TRAFFIC_IMPACTS.step(seconds)
window.NBD_TRAFFIC_IMPACTS_READY
```

The snapshot exposes:

- configured hard and severe thresholds;
- total soft, hard, severe and suppressed contacts;
- cumulative hull damage;
- active severe stalls;
- the last impact tier, speed, damage, exposure, heat and disabled result;
- per-token cooldown, stall and impact history.

## Deliberately deferred

- ambient-traffic health or permanent destruction;
- damage transferred from the player vehicle to the ambient proxy;
- rigid-body spin, debris or free collision trajectories;
- horns or varied crash sound sets;
- witness-specific reports for traffic accidents;
- pedestrian impacts;
- insurance, repair costs or vehicle recovery services;
- converting a crashed proxy into an enterable vehicle;
- persistence of ambient impact state across dematerialization or save reload.

## Acceptance criteria

- a soft contact produces no damage, exposure or heat;
- a hard impact damages the player vehicle and creates local response;
- a severe impact applies more damage and an `impact-stalled` proxy state;
- repeated frame contact during cooldown cannot stack damage or alerts;
- player-vehicle damage persists through the existing vehicle service;
- ambient traffic retains token and slot identity;
- no ambient health, ownership or save data is added;
- 4C, 4D and 4E regressions remain green;
- unit, boot, system and campaign browser domains remain green;
- the save schema remains unchanged.
