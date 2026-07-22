# City Streaming 4A — district packs and distant simulation

_Last updated: 2026-07-22_

## Status

**Implementation candidate.**

City Streaming 4A builds on the accepted asynchronous chunk runtime without enlarging the visible city or changing campaign authority. It introduces two new boundaries:

1. district-level resource profiles loaded independently from chunk geometry;
2. low-frequency route progression for ordinary dormant pedestrians.

This stage intentionally uses metadata-only resource packs. It proves loading, prediction, ownership and diagnostics before real texture atlases or audio files are split into district bundles.

## Goals

- give each district an independently streamable visual, audio and simulation profile;
- prefetch the next district using nearby road orientation as well as vehicle velocity;
- preserve the current authored art and audio while the resource lifecycle is validated;
- allow ordinary dormant pedestrians to continue coarse route progression without local AI or rendering;
- keep mission targets, combatants, investigations and occupied vehicles under existing pinned/local authority;
- avoid changing campaign state, mission flow or the visible world layout.

## District pack manifest

Runtime manifest:

```text
phaser/assets/city/packs/manifest.json
```

Pack payloads:

```text
old-quarter.json
glasshouse.json
foundry.json
harbor-north.json
canal-west.json
canal-east.json
blackwater.json
harbor-south.json
```

Every manifest entry records:

```text
stable district id
world bounds
intersecting city chunk ids
selection priority
payload file
```

Every payload records:

```text
visual profile
audio profile
simulation density profile
identity tags
future texture/audio asset lists
```

Current asset lists are empty by design. `paletteFamily`, fog, light warmth, signage, reflection, ambient layers and population densities are data contracts for future render/audio systems, not claims that those assets already exist.

## Pack loading states

District packs use:

```text
unloaded
loading
queued
resident
error
```

The system:

- derives desired packs from nearby chunk authority;
- always includes the district containing the current render focus;
- adds one road-aware predictive district while driving quickly;
- cancels stale requests;
- retries transient failures;
- activates at most one pack per frame;
- retains up to six recent packs in an LRU cache;
- publishes the active profile through the Phaser registry as `districtPackProfile`.

## Road-aware prediction

Chunk prefetch already projects vehicle velocity. District pack prediction adds road orientation:

1. query nearby resident roads;
2. choose the closest road rectangle;
3. classify it as predominantly horizontal or vertical;
4. project the focus along that road axis using vehicle direction and speed;
5. request the district containing the projected point.

This prevents sideways velocity noise or drift from selecting an unrelated district when the car is travelling along a clear arterial road.

## Distant pedestrian simulation

`DistantSimulationSystem` runs independently from local `PedestrianSystem`.

Default policy:

```text
coarse interval       1 second
entity budget         16 pedestrians per tick
maximum catch-up      4 ticks per frame
```

Eligible actors are ordinary civilian pedestrians that:

- are currently `dormant` under `EntityStreamSystem`;
- have an authored pedestrian route;
- are alive and active in campaign state;
- are not hidden, dragged, intercepted, alarmed, chasing or attacking;
- are not stunned.

A macro tick advances only model state:

```text
x / y
route point index
completed route segments
coarse deterministic crosswalk wait
direction and velocity metadata
```

It deliberately does **not**:

- move or show a Phaser container;
- rebuild the local NPC spatial index;
- run witness, combat, collision or interaction logic;
- create noise, exposure or police heat;
- advance mission-critical actors;
- move distant vehicles or police between districts.

When a macro-progressed pedestrian enters an active chunk, the next entity-stream update wakes the existing object. Local pedestrian simulation then resumes from the updated route position.

## Macro population accounting

After each coarse tick the system reports dormant NPC and parked-vehicle counts per city chunk. This is diagnostic groundwork for later traffic and police macro simulation; vehicles are counted but not moved in 4A.

## Runtime order

The gameplay runtime updates streaming layers in this order:

```text
ChunkStreamSystem
DistrictPackSystem
EntityStreamSystem
DistantSimulationSystem
PedestrianSystem
```

This preserves the authority chain:

- chunk residency decides available local world data;
- district packs decide the active resource profile;
- entity streaming decides active, pinned or dormant state;
- distant simulation advances eligible dormant models;
- local pedestrian simulation advances only awake actors.

## Diagnostics

District packs:

```js
window.NBD_DISTRICT_PACKS.snapshot()
window.NBD_DISTRICT_PACKS.active()
window.NBD_DISTRICT_PACKS.forceUpdate()
```

Distant simulation:

```js
window.NBD_DISTANT_SIM.snapshot()
window.NBD_DISTANT_SIM.forceTick(seconds)
```

Readiness flags:

```js
window.NBD_DISTRICT_PACKS_READY
window.NBD_DISTANT_SIM_READY
```

Snapshots expose active and predictive pack IDs, load states, cache/request statistics, active profile metadata, macro tick counts, advanced actor IDs and dormant population by chunk.

## Deliberately deferred

- actual district texture atlases and audio binaries;
- cross-fading ambient audio between resident packs;
- render palette/fog transitions driven by pack profiles;
- generated crowd destruction/recreation pools;
- distant vehicle movement;
- abstract police travel and response timing;
- district schedules and time-of-night population changes;
- macro navigation graphs.

## Acceptance criteria

- eight deterministic district profiles load from a separate manifest;
- the focus district becomes resident and is published through the registry;
- road-aware prediction selects the district ahead of a moving vehicle;
- stale pack requests can be cancelled and packs obey activation/cache budgets;
- a remote routed pedestrian advances during a forced macro tick;
- the pedestrian model changes while its Phaser container remains untouched;
- macro progression never runs local witness, combat or collision systems;
- returning to an active chunk reuses the existing NPC object;
- all unit, boot, system and campaign browser domains remain green;
- the visible city, campaign and save schema remain unchanged.
