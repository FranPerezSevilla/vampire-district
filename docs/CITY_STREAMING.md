# City Streaming

_Last updated: 2026-07-22_

## Status

**City Streaming 1 is implemented as the compatibility foundation for a much larger city.**

The current playable city remains the same size and retains the same authored content. The change introduces chunk ownership, local static queries and explicit loading states before any district is split into separately downloaded files.

## Goals

- allow the world dimensions and total content count to grow without increasing per-frame static queries proportionally;
- keep the current campaign, saves and generated Foundry layout stable;
- make rendering and collision depend on nearby chunks rather than complete-city arrays;
- expose deterministic diagnostics and browser regressions before adding asynchronous files or dormant NPC simulation.

## Chunk grid

The current `2400 × 1440` city is compiled into `512 × 512` chunks:

```text
5 columns × 3 rows = 15 chunks
```

Chunk IDs use stable grid coordinates:

```text
0:0
1:0
2:0
...
4:2
```

Partial edge chunks preserve the exact world boundary.

## Runtime states

Every chunk has one state:

```text
unloaded
prefetched
active
dormant
```

The initial policy is:

```text
3×3 active window      radius 1 around the player or driven vehicle
5×5 prefetch window    radius 2 around the focus
predictive prefetch    one additional 3×3 area ahead of a fast vehicle
dormant retention      two focus changes before returning to unloaded
```

At world edges the windows are clipped naturally, so fewer than nine active chunks can be present.

## Current integration boundary

City Streaming 1 moves these operations to chunk-local indexes:

- street rendering;
- roads, sidewalks and crosswalks;
- buildings;
- streetlights and broken-light shadows;
- shadow zones;
- sewer tunnels and manholes;
- player collision against buildings;
- current-light and current-shadow lookup.

The render window remains approximately `1360 × 960`. It reads the active and prefetched loaded rings so a camera edge can safely cross a fourth chunk, while gameplay simulation authority remains limited to active chunks.

## Data model

`CityChunkManifest` records:

- world dimensions;
- chunk size and grid shape;
- chunk bounds and neighbours;
- counts by category;
- stable item IDs owned or referenced by each chunk.

`ChunkSpatialIndex` stores runtime object references by category and chunk. Objects crossing a boundary are indexed in every touched chunk but deduplicated in query results.

The current categories are:

```text
roads
sidewalks
crosswalks
buildings
roofs
rooftopRoutes
fireEscapes
sewerTunnels
sewerAccesses
lights
dumpsters
shadowZones
pedestrianRoutes
navigationPoints
vehicles
```

## Diagnostics

The browser exposes:

```js
window.NBD_CITY_STREAM.snapshot()
window.NBD_CITY_STREAM.stateOf("3:0")
window.NBD_CITY_STREAM.chunkIdAt(x, y)
window.NBD_CITY_STREAM.inspectBounds(bounds)
window.NBD_CITY_STREAM.forceFocus(x, y, velocityX, velocityY)
```

The snapshot includes active, prefetched, dormant and unloaded IDs, recent transitions and category counts represented by the loaded window.

## What is intentionally not streamed yet

- NPC containers and AI;
- police and traffic simulation;
- Phaser textures and audio packs;
- JSON files fetched over the network;
- blood, corpses and mission state serialization by chunk;
- RenderTexture or Tilemap chunk caches.

All of these need the chunk authority established here, but changing them in the same step would make regressions difficult to diagnose.

## Next stages

### City Streaming 2 — entity dormancy

- classify NPCs as local, persistent-critical or abstract;
- stop per-frame AI outside active chunks;
- pool NPC and vehicle display objects;
- serialize local body, evidence, prop and vehicle deltas;
- activate Foundry and adjacent districts as the first real streaming corridor.

### City Streaming 3 — asynchronous chunk files

- emit one data file per chunk from City Compiler;
- keep only the manifest permanently loaded;
- fetch the prefetch ring with cancellation and retry;
- enforce a per-frame activation budget;
- retain recently used chunks through an LRU cache.

### City Streaming 4 — asset packs and distant simulation

- district-level visual and audio asset packs;
- predictive loading from velocity and road direction;
- abstract distant pedestrians, traffic and police;
- local and macro navigation graphs;
- stress traversal across the enlarged city at maximum vehicle speed.

## Acceptance policy

City Streaming 1 must not change the visible layout or campaign flow. Required checks:

- deterministic `5 × 3` manifest;
- no duplicate cross-chunk query results;
- correct state transitions at opposite world edges;
- forward prefetch while driving;
- render safety across the active/prefetched boundary;
- local building collision, light and shadow queries;
- all existing boot, system and campaign browser domains remain green.
