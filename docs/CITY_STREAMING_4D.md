# City Streaming 4D — local traffic behavior

_Last updated: 2026-07-22_

## Status

**Accepted and implemented.**

City Streaming 4D adds bounded local driving behaviour to the pooled traffic proxies introduced in 4C. Nearby traffic can now follow another car, brake for the player vehicle and yield at shared junctions without changing the city-wide macro traffic simulation.

The campaign vehicle service, save schema, ownership rules and authored vehicle state remain unchanged.

## Goals

- preserve macro traffic as the authority for token quantity and global progress;
- allow a local proxy to lag behind its macro token when traffic conditions require braking;
- keep safe following distance between proxies travelling in the same lane;
- react to the player-driven vehicle and the on-foot player when they block a lane;
- yield deterministically when two local traffic paths approach the same junction;
- recover smoothly toward macro progress after a blocker clears;
- retain the fixed ten-container pool and stable token-to-slot assignments;
- expose deterministic diagnostics for braking, stopping, following and junction yielding.

## Authority model

```text
MacroTrafficPoliceSystem
  owns token count, global phase and completed trips

TrafficMaterializationSystem
  owns which tokens have a local pooled proxy

TrafficLocalBehaviorSystem
  owns local visual lag, speed factor and yield decisions

VehicleSystem
  owns player-enterable and persistent vehicles
```

A local proxy never advances beyond the authoritative macro token. It may only remain behind it while braking or waiting. When the lane clears, the proxy may use a small bounded catch-up multiplier until the visual lag is reduced.

If a proxy dematerializes, its local behaviour state is discarded. The next materialization starts from the current macro phase rather than persisting a local queue across the entire city.

## Local phase tracking

Each active proxy records:

```text
authoritative macro travel
visual local travel
visual phase
speed factor
desired speed factor
current blocker
current gap
junction reservation reason
stopped duration
```

Macro phases are modulo-one values. The local system converts consecutive phases into monotonic travel values so a normal phase wrap from `0.99` to `0.01` remains forward movement.

The render-frame advance is:

```text
available distance = macro travel - visual travel
local advance      = frame time / edge travel time * speed factor
applied advance    = min(available distance, local advance)
```

This guarantees that local traffic cannot run ahead of the city-wide simulation.

## Following behaviour

Vehicles on the same macro edge and direction are compared by visual phase along the lane polyline.

Default distances:

```text
following distance       78 px
hard-stop distance       34 px
player look-ahead       132 px
lane tolerance           38 px
```

When the nearest lead vehicle is:

- beyond the following distance, the proxy cruises normally;
- between the following and hard-stop distances, the target speed scales down continuously;
- inside the hard-stop distance, the target speed becomes zero;
- already overlapping the safety boundary, the speed factor is set to zero immediately.

The same lane-projection rule is used for persistent parked vehicles, the player-driven car and the on-foot player.

## Acceleration and braking

Default response profile:

```text
acceleration rate        1.35 speed-factor units / second
braking rate             5.80 speed-factor units / second
maximum catch-up speed   1.24x macro speed
```

Braking is deliberately much faster than acceleration. Catch-up is available only when no blocker is selected and the proxy remains behind its authoritative token.

This is not full vehicle physics. Local traffic proxies still follow authored lane paths and do not steer dynamically around obstacles.

## Junction yielding

The lane manifest now contains eleven explicit conflict points corresponding to major avenue crossings.

A proxy considers a junction only when:

1. its lane passes through the conflict radius;
2. the junction lies ahead of its current visual phase;
3. the remaining approach distance is inside the configured threshold.

It yields when:

- the player vehicle currently occupies the junction;
- another traffic proxy on a conflicting lane already occupies it;
- another conflicting proxy is closer to the junction;
- both approaches are effectively tied and the other token has stable lexical priority.

The lexical tie-break prevents frame-order randomness and keeps browser regressions deterministic.

This is yield-based crossing control, not a traffic-light system. There are no red/green cycles, lane changes or route reservations beyond the immediate local conflict.

## Materialization interaction

4C remains the spawn authority. Its anti-overlap rules apply when a token first requests a pool slot.

Once assigned, a reversible local assignment policy retains the proxy according to its visual local position, resident streamed space, street layer and despawn radius. Raw macro overlap no longer removes a vehicle that is waiting in a local queue. This is required because 4D, rather than the macro phase, owns the visible following gap after materialization.

Local behaviour runs after materialization on every frame:

```text
MacroTrafficPoliceSystem
TrafficMaterializationSystem
TrafficLocalAssignmentPolicy
TrafficLocalBehaviorSystem
VehicleSystem driving frame
```

The materializer first ensures the correct proxies exist. The behaviour system then replaces their raw macro positions with local visual positions before the player vehicle performs occupancy checks.

Stable token-to-slot identity is retained while braking and during recovery.

## Diagnostics

```js
window.NBD_TRAFFIC_BEHAVIOR.snapshot()
window.NBD_TRAFFIC_BEHAVIOR.step(seconds)
window.NBD_TRAFFIC_BEHAVIOR.point(tokenId, phase)
window.NBD_TRAFFIC_BEHAVIOR_READY
```

The snapshot exposes:

- active, braking and stopped vehicle counts;
- following, yielding and player-reactive counts;
- configured following and hard-stop distances;
- configured catch-up speed;
- visual and authoritative phase for every proxy;
- local lag and speed factors;
- current behaviour reason;
- blocker id, gap and junction id;
- stopped duration;
- initialization errors.

Behaviour reasons include:

```text
cruise
catch-up
traffic
player-vehicle
parked-vehicle
player-on-foot
junction-player
junction-yield
```

## Deliberately deferred

- dynamic steering and lane changing;
- traffic-light cycles;
- multi-junction route reservation;
- autonomous overtaking;
- collisions or damage between ambient vehicles;
- pedestrian impacts and avoidance animation;
- traffic interaction with destructible props;
- horns, engine audio and crash audio;
- traffic-generated police heat or exposure;
- converting a proxy into an enterable persistent car;
- persistence of local queues across dematerialization or save reload.

## Acceptance criteria

- a local proxy never advances beyond its authoritative macro token;
- same-lane rear traffic reduces speed when a lead proxy is too close;
- traffic stops inside the hard-stop boundary;
- the player-driven vehicle is detected as a lane blocker;
- an on-foot player may be treated as a soft lane blocker without an atropello system;
- conflicting junction approaches resolve deterministically;
- local speed recovers gradually when the blocker clears;
- catch-up remains bounded;
- token-to-slot assignments remain stable while braking and recovering;
- the pool remains fixed at ten containers;
- traffic remains outside campaign ownership and persistence;
- unit, boot, system and campaign browser domains remain green;
- the save schema remains unchanged.

## Acceptance record

City Streaming 4D was accepted on 2026-07-22 through PR #26.

Validated on implementation head `30aee2f6f467c6fad7b5c1dcc72735c0e2ad4dff`:

```text
unit-tests         success
browser-boot       success
browser-systems    success
browser-campaign   success
```

Validation exposed one architectural mismatch between 4C and 4D: the 4C assigned-vehicle eligibility check still used raw macro positions and spawn anti-overlap rules. That could remove a local proxy precisely when 4D needed it to form a queue. The accepted implementation installs a reversible local assignment policy: spawn safety remains in 4C, while assigned retention follows visual local position and streaming boundaries.

Earlier unit failures were fixture-only: exact floating-point comparison and an assertion tied to a transient behaviour label. Final tests assert observable outcomes—braking, bounded recovery, deterministic yielding and stable slot identity.
