# City Streaming 4C — local traffic materialization

_Last updated: 2026-07-22_

## Status

**Implementation candidate.**

City Streaming 4C converts a bounded subset of the abstract traffic tokens introduced in 4B into pooled Phaser vehicles near the player. The macro simulation remains the authority for traffic quantity and progress; the local system owns only presentation and nearby collision occupancy.

The campaign vehicle service, save schema and authored parked vehicles remain unchanged.

## Goals

- make the streamed city feel inhabited by moving traffic without simulating the whole city;
- allocate a fixed number of local vehicle containers once and reuse them;
- materialize only tokens near the current street-level render focus;
- keep token identity and pool-slot identity stable while a vehicle remains local;
- dematerialize safely when a token leaves resident streamed space, exceeds the hysteresis radius or the player changes layer;
- prevent the player-driven vehicle from occupying the same local space as materialized traffic;
- avoid creating ownership, trunk, health or persistence state for ephemeral traffic.

## Lane manifest

Runtime lane data:

```text
phaser/assets/city/packs/traffic-lanes.json
```

Each of the twelve macro graph edges has two explicit road-center polylines:

```text
forward
reverse
```

Even-numbered tokens use the forward lane and odd-numbered tokens use the reverse lane. The lane manifest deliberately follows the authored avenue centres rather than interpolating between district centres, because district centres may lie inside blocks or buildings.

## Authority model

```text
MacroTrafficPoliceSystem
  owns token count, phase and completed trips

TrafficMaterializationSystem
  maps nearby token phases onto lane polylines
  owns pooled Phaser containers and local occupancy

VehicleSystem
  retains ownership of player-enterable and persistent vehicles
```

A traffic proxy is not added to `VehicleSystem.vehicles`. It therefore cannot be entered, stolen, damaged, inspected or persisted accidentally.

## Pooling

The default pool contains ten containers:

```text
maximum local traffic       10
materialize radius          620 px
despawn radius              760 px
```

Containers are created once using the existing `paintVehicle()` presentation path. Compact, sedan and van shapes are distributed across the pool. Labels are hidden for ordinary traffic.

When a token becomes eligible:

1. it must be on the street layer;
2. its point must be inside an active, resident chunk;
3. it must be within the materialize radius;
4. it must not overlap an authored vehicle, the on-foot player or another traffic proxy;
5. a free pool slot must exist.

An assigned token may remain visible until it exceeds the larger despawn radius or leaves resident streamed space. This hysteresis avoids rapid spawn/despawn oscillation at chunk boundaries.

## Smooth movement

Macro traffic advances at a coarse interval. Local traffic adds the current macro accumulator fraction to the authoritative token phase before sampling the lane polyline.

This keeps the local proxy moving every render frame without changing macro state or creating a second traffic clock. A macro tick and the local interpolation join continuously.

## Collision boundary

`TrafficMaterializationSystem` decorates `VehicleSystem.canOccupy()` while installed.

The original world, building and authored-vehicle checks run first. A candidate driven-vehicle position is then rejected when its radius overlaps a materialized traffic proxy. The original method is restored when the local traffic system is destroyed.

Traffic proxies do not yet:

- push or damage one another;
- run over pedestrians;
- produce crash heat or exposure;
- stop at junctions or traffic lights;
- react to the player;
- become enterable vehicles.

Those behaviours require a dedicated local traffic AI stage rather than hidden side effects inside streaming.

## Runtime order

```text
ChunkStreamSystem
DistrictPackSystem
EntityStreamSystem
DistantSimulationSystem
MacroTrafficPoliceSystem
TrafficMaterializationSystem
PedestrianSystem
```

Local proxy positions are refreshed after macro advancement and before the player-driving frame, so collision occupancy uses the latest visible traffic positions.

## Diagnostics

```js
window.NBD_TRAFFIC.snapshot()
window.NBD_TRAFFIC.resync()
window.NBD_TRAFFIC.tokens()
window.NBD_TRAFFIC.blocks(x, y, radius)
window.NBD_TRAFFIC_READY
```

The snapshot exposes:

- pool size and configured cap;
- materialize and despawn radii;
- total macro token count;
- eligible and blocked candidates;
- materialized token ids;
- stable pool-slot indices;
- edge, direction, phase, position and archetype for each local proxy;
- initialization errors.

## Deliberately deferred

- autonomous braking and car-following;
- junction priority, lane changes and traffic lights;
- traffic collisions with pedestrians or props;
- traffic damage, ownership, theft and trunks;
- converting a traffic proxy into a persistent vehicle;
- audio, horns and traffic-related police heat;
- save persistence for local proxy assignments;
- district schedules and time-of-night density changes.

## Acceptance criteria

- every macro edge has an explicit forward and reverse road lane;
- a fixed-size pool is allocated once and reused;
- nearby active tokens materialize without increasing the pool;
- token and slot identity remain stable during local movement;
- coarse macro phases render smoothly between ticks;
- traffic disappears outside the street layer;
- authored vehicles and the player are protected from spawn overlap;
- the driven vehicle cannot occupy a materialized traffic proxy;
- traffic proxies never enter campaign vehicle persistence;
- unit, boot, system and campaign browser domains remain green;
- the campaign and save schema remain unchanged.
