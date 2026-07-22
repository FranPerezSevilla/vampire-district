# City Streaming

_Last updated: 2026-07-22_

## Status

**City Streaming 1 and 2 are implemented as the compatibility foundation for a much larger city.**

The current playable city remains the same size and retains the same authored content. Static geometry is queried through chunks, while ordinary NPCs and parked vehicles outside the active window now become dormant instead of continuing full per-frame simulation.

## Goals

- allow the world dimensions and total content count to grow without increasing per-frame work proportionally;
- keep the current campaign, saves and generated Foundry layout stable;
- make rendering, collision and ordinary entity simulation depend on nearby chunks;
- preserve mission targets, active combat, pursuit and body interactions across chunk boundaries;
- expose deterministic diagnostics before asynchronous files and asset packs are introduced.

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

## Chunk runtime states

Every chunk has one state:

```text
unloaded
prefetched
active
dormant
```

The current policy is:

```text
3×3 active window      radius 1 around the player or driven vehicle
5×5 prefetch window    radius 2 around the focus
predictive prefetch    one additional 3×3 area ahead of a fast vehicle
dormant retention      two focus changes before returning to unloaded
```

At world edges the windows are clipped naturally, so fewer than nine active chunks can be present.

## Static integration

Static urban operations use chunk-local indexes:

- street rendering;
- roads, sidewalks and crosswalks;
- buildings;
- streetlights and broken-light shadows;
- shadow zones;
- sewer tunnels and manholes;
- player collision against buildings;
- vehicle collision against buildings;
- current-light and current-shadow lookup;
- local street-navigation node selection.

The render window remains approximately `1360 × 960`. It reads the active and prefetched loaded rings so a camera edge can safely cross a fourth chunk, while gameplay simulation authority remains limited to active chunks.

## Entity dormancy

NPCs and vehicles use a separate runtime state:

```text
active     inside an active chunk
pinned     outside the active window but required by gameplay
dormant    abstracted and excluded from per-frame simulation
```

Ordinary remote civilians, quiet patrols, rats and parked vehicles become dormant. Their existing data and Phaser container are retained; the container is hidden and inactive rather than destroyed. Waking reuses the same object, avoiding allocation churn.

Dormant NPCs:

- do not execute movement or AI;
- are removed from the NPC spatial index;
- cannot witness, collide, attack or be selected by local interactions;
- retain position, route progress, combat state and persistent identity;
- continue advancing passive countdowns such as stun and reaction timers.

### Pinned exceptions

These actors remain simulated across chunk boundaries:

- mission informants;
- the journalist or any target NPC;
- bodies currently being dragged;
- drain victims;
- active enemy attacks;
- NPCs chasing or alarmed by the player;
- Whisper/lure and sound reactions;
- active investigations;
- hostile mission thugs;
- mission-intercepted actors;
- staggered combatants;
- revealed hunters at maximum exposure;
- occupied or still-moving vehicles.

Police spawned in response to Wanted pressure receive an investigation target immediately, so they remain pinned until reaching the active area. Quiet baseline patrols may sleep when remote. Police population targets count both active and dormant units to avoid spawning duplicates.

## Data model

`CityChunkManifest` records:

- world dimensions;
- chunk size and grid shape;
- chunk bounds and neighbours;
- counts by category;
- stable item IDs owned or referenced by each chunk.

`ChunkSpatialIndex` stores runtime object references by category and chunk. Objects crossing a boundary are indexed in every touched chunk but deduplicated in query results.

`EntityStreamSystem` stores a lightweight record per NPC and vehicle:

```text
state
reason
chunkId
chunkState
transition count
dormant elapsed time
```

No save schema changes are required because dormancy is runtime-only and does not replace authoritative NPC, body or vehicle state.

## Diagnostics

The browser exposes chunk diagnostics:

```js
window.NBD_CITY_STREAM.snapshot()
window.NBD_CITY_STREAM.stateOf("3:0")
window.NBD_CITY_STREAM.chunkIdAt(x, y)
window.NBD_CITY_STREAM.inspectBounds(bounds)
window.NBD_CITY_STREAM.forceFocus(x, y, velocityX, velocityY)
```

And entity diagnostics:

```js
window.NBD_ENTITY_STREAM.snapshot()
window.NBD_ENTITY_STREAM.stateOf("civ_harbor_1")
window.NBD_ENTITY_STREAM.resync()
```

The entity snapshot reports active, pinned and dormant NPC/vehicle counts, pinned reasons and recent transitions.

## What is intentionally not streamed yet

- separately fetched chunk JSON files;
- Phaser texture and audio packs;
- full destroy/recreate object pools for procedurally spawned crowds;
- distant route progression and schedules;
- abstract city-wide traffic and police travel;
- blood, corpse and prop delta files per chunk;
- RenderTexture or Tilemap chunk caches.

## Next stages

### City Streaming 3 — asynchronous chunk files

- emit one data file per chunk from City Compiler;
- keep only the manifest permanently loaded;
- fetch the prefetch ring with cancellation and retry;
- enforce a per-frame activation budget;
- retain recently used chunks through an LRU cache;
- serialize body, evidence, prop and vehicle deltas by chunk.

### City Streaming 4 — asset packs and distant simulation

- district-level visual and audio asset packs;
- predictive loading from velocity and road direction;
- true reusable pools for generated crowds and traffic;
- abstract distant pedestrians, traffic and police;
- local and macro navigation graphs;
- stress traversal across the enlarged city at maximum vehicle speed.

## Acceptance policy

City Streaming must not change the visible layout or campaign flow. Required checks:

- deterministic chunk and entity-state transitions;
- no duplicate cross-chunk query results;
- remote ordinary NPCs stop updating and leave the spatial index;
- local NPCs and parked vehicles wake without recreation;
- mission targets and engaged actors remain pinned;
- police and hunter escalation still reaches the player;
- forward prefetch while driving;
- local building collision, light and shadow queries;
- all existing boot, system and campaign browser domains remain green.