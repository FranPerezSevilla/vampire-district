# City Streaming 4B — macro traffic and police travel

_Last updated: 2026-07-22_

## Status

**Accepted and implemented.**

City Streaming 4B extends the low-frequency distant simulation introduced in 4A. It adds a district macro-navigation graph, abstract traffic flow and identity-preserving travel for ordinary dormant police patrols.

The visible city, campaign authority and save schema remain unchanged.

## Goals

- represent city-wide traffic pressure without creating remote colliding vehicles;
- allow quiet dormant police patrols to move between districts at low frequency;
- preserve existing police object identity and pinned safety rules;
- wake a travelling police NPC when its model enters an active chunk;
- keep awakened police on local district navigation rather than sending them back toward Old Quarter patrol coordinates;
- expose deterministic diagnostics before traffic pools or response-time gameplay are introduced.

## Macro graph

Runtime graph:

```text
phaser/assets/city/packs/macro-graph.json
```

The graph contains eight district nodes:

```text
old-quarter
glasshouse
foundry
harbor-north
canal-west
canal-east
blackwater
harbor-south
```

Each node records:

```text
bounds
center
neighbours
traffic density
police presence
```

Twelve undirected edges describe the accepted district connectivity and a coarse travel duration. The graph is deliberately district-level; it is not a replacement for local streets, sidewalks or collision queries.

## Abstract traffic

Traffic outside active chunks is represented by numeric tokens on macro edges.

Token count is derived from the average traffic density of the two connected districts. Each token has a deterministic phase from `0` to `1` along the edge. A macro tick advances phases according to the edge travel duration and records completed trips.

Traffic tokens:

- have no Phaser container;
- do not collide with the player, NPCs, buildings or props;
- do not produce noise, exposure or police heat;
- do not reserve local road space;
- are not saved as individual vehicles;
- provide district traffic-load diagnostics for future traffic spawning and scheduling.

This prevents the dangerous illusion of remote physical cars whose collision state does not exist locally.

## Dormant police travel

Only ordinary police NPCs currently classified as `dormant` may use the macro graph.

Excluded police include units that are:

- dead or inactive;
- dragged;
- alarmed or chasing the player;
- attacking;
- investigating heat or another target;
- mission-intercepted;
- stunned.

These exclusions preserve the existing `pinned` authority for active investigations, pursuit and combat.

### Identity and movement

A travelling patrol retains the existing NPC object. The macro system updates only model fields:

```text
x / y
travel leg
leg progress
direction and velocity metadata
completed macro legs
```

It deliberately does not move the Phaser container or add the NPC to the local spatial index. When the model reaches a currently active chunk, macro progression stops. On the following normal entity-stream update, the existing NPC wakes and local simulation resumes.

### Route selection

For each eligible patrol:

1. determine the current district from position;
2. select a neighbouring district deterministically from the NPC id and hop count;
3. avoid immediately reversing the previous leg when another neighbour exists;
4. interpolate toward the next district center using the edge travel duration;
5. continue with a new leg if a forced coarse tick contains surplus time.

No random choices are required, making browser regressions and replay diagnostics stable.

## District-local patrol recovery

The original prototype police routes are authored inside Old Quarter. A police NPC waking in another district must not attempt to walk directly back to those coordinates.

`PoliceSystem` therefore overrides ordinary patrol targets outside Old Quarter:

- gather `streetNavigationPoints` belonging to the current district;
- choose the nearest point when entering that district;
- cycle through district-local points on arrival;
- retain core behaviour for player pursuit, search and heat investigations.

Wanted escalation and investigations remain authoritative over local patrol routing.

## Runtime order

The relevant authority order becomes:

```text
ChunkStreamSystem
DistrictPackSystem
EntityStreamSystem
DistantSimulationSystem
MacroTrafficPoliceSystem
PedestrianSystem
```

`EntityStreamSystem` first decides which actors are dormant. Macro systems then advance only eligible dormant models. Local systems continue to simulate awake actors.

## Defaults

```text
macro interval          2 seconds
police budget           4 patrols per macro tick
maximum catch-up        2 ticks per frame
```

The traffic-token budget is fixed by the graph and district density profiles rather than by per-frame object creation.

## Diagnostics

```js
window.NBD_MACRO_CITY.snapshot()
window.NBD_MACRO_CITY.forceTick(seconds)
window.NBD_MACRO_CITY_READY
```

The snapshot exposes:

- graph id and readiness;
- abstract traffic-token count;
- per-edge phases and completed trips;
- district traffic load;
- eligible dormant police count;
- travelling police ids, legs and progress;
- completed police legs;
- the last police advanced by the macro tick;
- interval and budget configuration.

## Deliberately deferred

- creation and destruction pools for real traffic vehicles;
- converting traffic tokens into nearby physical cars;
- distant vehicle ownership, damage or trunk state;
- police response-time gameplay driven by macro distance;
- dispatch routing toward active heat across multiple districts;
- macro hunters, criminals or faction patrols;
- schedules based on time of night;
- persistence of in-progress macro legs across save reloads;
- road-segment-level macro navigation.

## Acceptance criteria

- the eight-node macro graph loads independently;
- abstract traffic phases advance deterministically without creating physical vehicles;
- traffic diagnostics report token counts, completed trips and district load;
- only eligible ordinary dormant police travel;
- active, investigating, chasing and combat police never enter macro travel;
- macro police movement changes model position without moving the Phaser container;
- a travelling patrol that enters an active chunk wakes as the same NPC object;
- an awakened patrol outside Old Quarter receives a district-local navigation target;
- pursuit, search and heat targets still override ordinary patrol routing;
- all unit, boot, system and campaign browser domains remain green;
- the visible city, campaign and save schema remain unchanged.

## Acceptance record

City Streaming 4B was accepted on 2026-07-22 through PR #24.

Validated on implementation head `ace0b35228220766ea7417d4511b6fe303015fb7`:

```text
unit-tests         success
browser-boot       success
browser-systems    success
browser-campaign   success
```

The first browser attempt exposed a test-only authority mismatch: diagnostic `forceFocus()` was used without moving the real scene focus, so the next frame correctly restored chunk authority around the player. The accepted regression moves the real scene focus to the travelling patrol before verifying wake-up.
