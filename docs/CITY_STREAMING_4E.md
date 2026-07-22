# City Streaming 4E — local traffic physical consequences

_Last updated: 2026-07-22_

## Status

**Accepted and implemented.**

City Streaming 4E adds bounded physical consequences when the player-driven vehicle reaches a pooled ambient traffic proxy. It extends the materialization and local-behaviour stages introduced in 4C and 4D without converting ambient traffic into persistent campaign vehicles.

The save schema, vehicle ownership, trunks, ambient traffic health, police heat and exposure rules remain unchanged.

## Goals

- distinguish ambient-traffic contact from a collision against buildings or street furniture;
- allow a clear ambient vehicle to receive a small physical displacement;
- reduce the player vehicle's speed after a successful soft push;
- block both vehicles when the ambient proxy cannot move safely;
- preserve token identity, pool-slot identity and macro traffic authority;
- retain local braking while a pushed or blocked proxy settles;
- recover the visual proxy gradually toward its authored lane;
- avoid damage, noise, exposure and police heat in this stage.

## Authority model

```text
MacroTrafficPoliceSystem
  owns token count, global phase and completed trips

TrafficMaterializationSystem
  owns local token-to-slot assignments

TrafficLocalBehaviorSystem
  owns lane progress, following and junction yielding

TrafficPhysicalConsequencesSystem
  owns temporary physical offset and contact hold

VehicleSystem
  owns the player-driven persistent vehicle
```

A physical contact never modifies the macro token. The proxy remains assigned to the same token and pool slot while its visible container is displaced temporarily from the lane.

## Driving integration

`TrafficPhysicalConsequencesSystem` wraps the public `VehicleSystem.updateDriving()` method.

Before the normal driving update it:

1. predicts the next player-vehicle kinematic state;
2. checks whether that state overlaps an active traffic proxy;
3. verifies that the predicted player position is otherwise valid against the normal world and authored-vehicle rules;
4. attempts a bounded push of the nearest traffic proxy;
5. either runs the normal driving frame after moving the proxy or neutralizes the frame when the proxy is blocked.

The wrapper is restored when 4E is destroyed.

## Soft push

A push direction points away from the predicted player-vehicle centre. The push distance combines:

```text
current overlap
impact-speed contribution
minimum contact response
maximum per-contact displacement
```

Default profile:

```text
maximum push per contact     16 px
maximum lane offset          44 px
offset recovery              24 px / second
player speed retention       0.78
collision padding             2 px
```

A successful push:

- moves only the ambient proxy container and its temporary 4E offset;
- retains the same token and slot;
- briefly stops the proxy through the 4D decision hook;
- lets the player vehicle complete the normal driving frame;
- reduces player speed and drift after contact;
- does not change either vehicle's health.

## Blocked contact

A proxy cannot be pushed when the candidate position would:

- leave the world boundary;
- overlap a streamed building;
- overlap an authored or player vehicle;
- overlap another materialized traffic proxy;
- exceed the maximum allowed lane offset.

When blocked:

- the proxy receives a longer local hold;
- the player vehicle is stopped before entering the proxy;
- the normal building-collision damage path is not executed;
- no crash audio, exposure or police heat is produced;
- the token-to-slot assignment remains unchanged.

Default contact holds:

```text
successful push hold         0.16 seconds
blocked contact hold         0.55 seconds
```

## Behaviour integration

4E wraps `TrafficLocalBehaviorSystem.decisionFor()`.

While a physical hold remains active, the local desired speed becomes zero with one of two reasons:

```text
physical-contact
physical-blocked
```

After the hold expires, 4D resumes its normal following, junction and bounded catch-up behaviour.

## Offset recovery

On each local frame after 4D samples the authored lane, 4E:

1. records the fresh lane position as the physical base;
2. decreases the contact hold;
3. moves the temporary offset toward zero;
4. validates the recovered candidate against world, persistent vehicles and other proxies;
5. reapplies the remaining offset to the visible container.

Recovery pauses rather than clipping through an obstacle. A dematerialized proxy discards its physical offset and returns from the current macro phase if materialized again.

## Runtime order

```text
ChunkStreamSystem
DistrictPackSystem
EntityStreamSystem
DistantSimulationSystem
MacroTrafficPoliceSystem
TrafficMaterializationSystem
TrafficLocalBehaviorSystem
TrafficPhysicalConsequencesSystem
PedestrianSystem
VehicleSystem driving frame
```

This order ensures that player collision checks use the final lane behaviour and physical displacement for the frame.

## Diagnostics

```js
window.NBD_TRAFFIC_PHYSICS.snapshot()
window.NBD_TRAFFIC_PHYSICS.step(seconds)
window.NBD_TRAFFIC_PHYSICS_READY
```

The snapshot exposes:

- active physical contacts;
- pushed and blocked proxy counts;
- cumulative contacts, pushes and blocks;
- configured push, offset and recovery limits;
- last contact vehicle, token, speed and outcome;
- per-token offset, hold, impact speed and contact history.

## Deliberately deferred

- ambient traffic health and damage;
- damage transfer to the player vehicle;
- crash audio and horns;
- traffic-generated exposure or police heat;
- pedestrian impacts or avoidance consequences;
- destructible-prop interaction;
- proxy rotation or free rigid-body movement after impact;
- lane changes, overtaking or dynamic rerouting;
- converting a displaced proxy into an enterable vehicle;
- persistence of offsets or contacts across dematerialization and save reload.

## Acceptance criteria

- a clear contact displaces the ambient proxy by a bounded amount;
- the player vehicle loses speed after a successful push;
- a blocked proxy stops the player without entering the world-collision damage path;
- health, exposure and police heat remain unchanged;
- the proxy retains token and slot identity during contact and recovery;
- 4D reports `physical-contact` or `physical-blocked` while the hold is active;
- physical offsets recover gradually and never exceed the configured maximum;
- recovery does not clip through buildings, persistent vehicles or traffic proxies;
- the fixed pool remains ten containers;
- ambient traffic remains outside ownership, trunks and persistence;
- unit, boot, system and campaign browser domains remain green;
- the save schema remains unchanged.

## Acceptance record

City Streaming 4E was accepted on 2026-07-22 through PR #27.

Validated on implementation head `13aa6e891f39daa4756b9ea00d701ce885d9612f`:

```text
unit-tests         success
browser-boot       success
browser-systems    success
browser-campaign   success
```

The first unit attempt exposed only a test precision issue: vector decay returned the expected floating-point value with normal binary rounding, while the test used strict structural equality. The accepted regression uses an epsilon comparison; product behaviour was unchanged.
