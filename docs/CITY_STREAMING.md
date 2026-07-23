# City Streaming

_Last updated: 2026-07-23_

## Status

**City Streaming 1, 2 and 3 are implemented as the compatibility foundation for a much larger city.**

The playable city is `4800 × 3600` and retains the same campaign, generated Foundry identity and save authority. Static geometry is now emitted as one JSON payload per chunk and loaded asynchronously around the player or driven vehicle. Ordinary remote entities continue to use chunk-aware dormancy.

## Goals

- allow world dimensions and content counts to grow without increasing per-frame work proportionally;
- keep the current campaign, saves and generated Foundry layout stable;
- make rendering, collision and ordinary entity simulation depend on nearby chunks;
- preserve mission targets, active combat, pursuit and body interactions across chunk boundaries;
- avoid traversal hitches through predictive prefetch, request cancellation and bounded activation;
- retain deterministic browser diagnostics before district asset packs and macro simulation are introduced.

## Chunk grid

The current city is compiled into `512 × 512` chunks:

```text
10 columns × 8 rows = 80 chunks
```

Chunk IDs use stable grid coordinates:

```text
0:0
1:0
2:0
...
9:7
```

Partial edge chunks preserve the exact world boundary.

## Compiler output

Run:

```bash
npm run city:streaming
```

The City Compiler writes:

```text
phaser/assets/city/current/manifest.json
phaser/assets/city/current/chunks/0-0.json
phaser/assets/city/current/chunks/1-0.json
...
phaser/assets/city/current/chunks/9-7.json
```

The manifest contains only world/chunk metadata, file locations and neighbours. Each payload contains the static records intersecting that chunk.

Objects crossing boundaries are intentionally written into every touched payload. Records use their authored `id`; anonymous records receive a deterministic `streamId`, so the incremental spatial index deduplicates cloned JSON records across chunk boundaries.

The compiler source remains the selected authored/generated city data. The runtime chunk index no longer imports the complete city collections through `CurrentCityChunks.js`.

## Chunk authority states

Every chunk has one gameplay-authority state:

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

## Asynchronous load states

Authority and residency are tracked independently. A chunk payload has one load state:

```text
unloaded   no resident index and no cached payload
loading    network request in flight
queued     payload downloaded and awaiting activation
resident   payload hydrated into the spatial index
cached     raw payload retained by the LRU but not resident
error      retries exhausted
```

This separation allows a chunk to be desired as `active` while its payload is still loading without pretending that collision/render data is already available.

### Request policy

- Active chunks are requested before prefetched chunks.
- Requests that leave the desired active/prefetch set are cancelled with `AbortController`.
- Transient failures receive two retries with short increasing delays.
- Repeated requests share one in-flight promise.
- Downloaded payloads enter an activation queue rather than hydrating immediately inside a fetch callback.

### Activation budget

At most two downloaded chunks are hydrated per normal frame:

```text
activationBudget = 2
```

Active chunks are activated before prefetched chunks. A single redraw is requested after the frame budget is processed. Diagnostic `forceFocus()` may drain the queue deliberately for deterministic browser tests and debugging.

### LRU cache

The raw-payload cache retains up to twelve recently used chunks by default:

```text
cacheLimit = 12
```

Desired chunks are never evicted merely to satisfy the limit. Dormant or unloaded chunks are removed least-recently-used first. Evicting a cached/resident remote chunk also removes its records from the incremental spatial index.

## Static integration

Static urban operations use resident chunk-local indexes:

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

The render window remains approximately `1360 × 960`. It reads the active and prefetched resident rings so a camera edge can safely cross an adjacent chunk, while gameplay simulation authority remains limited to active chunks.

The authored modules remain the compiler source and still support systems not yet converted to streamed lifecycle ownership. They no longer build the complete chunk spatial index at runtime.

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

## Chunk delta index

Bodies, blood/evidence, broken street props and vehicle conditions already belong to campaign/world state. City Streaming 3 does not introduce a competing save file.

Before a resident chunk leaves local authority, `ChunkDeltaStore` serializes a chunk-local projection of that authoritative state:

```text
bodies
blood/evidence
broken dumpsters and streetlights
vehicle position, angle, health and parked state
```

The projection is stored under versioned `cityChunkDelta.<chunkId>` world flags and can be inspected independently. Existing campaign services remain responsible for restoring their domain state; the delta index provides chunk ownership for future destroy/recreate pools and separately persisted district files.

## Incremental spatial index

`ChunkSpatialIndex` supports:

```text
hydrateChunk(id, collections)
evictChunk(id)
isResident(id)
residentChunkIds()
```

It no longer needs complete-city collections in its constructor. Queries deduplicate by stable serialized identity instead of JavaScript object identity, which is required because the same cross-boundary object is parsed into separate objects from separate JSON files.

## Diagnostics

The browser exposes:

```js
window.NBD_CITY_STREAM.snapshot()
window.NBD_CITY_STREAM.stateOf("3:0")
window.NBD_CITY_STREAM.loadStateOf("3:0")
window.NBD_CITY_STREAM.chunkIdAt(x, y)
window.NBD_CITY_STREAM.inspectBounds(bounds)
await window.NBD_CITY_STREAM.forceFocus(x, y, velocityX, velocityY)
await window.NBD_CITY_STREAM.waitUntilReady()
window.NBD_CITY_STREAM.deltaSnapshot()
```

The snapshot reports:

- gameplay authority states;
- asynchronous load states;
- resident and queued chunk IDs;
- activation budget;
- loaded category counts;
- manifest/chunk request counts;
- cache hits, retries, cancellations, failures and evictions;
- recent authority and load transitions;
- chunk-delta domain totals.

`window.NBD_CITY_STREAM_READY` becomes true only when every currently active chunk is resident.

## What remains deliberately deferred

- district-level Phaser texture and audio packs;
- true destroy/recreate pools for generated crowds and traffic;
- distant route progression and schedules;
- abstract city-wide traffic and police travel;
- local and macro navigation graphs;
- RenderTexture or Tilemap chunk caches;
- removal of every remaining authored-array dependency from systems outside the chunk index.

## Next stage

### City Streaming 4 — asset packs and distant simulation

- district-level visual and audio asset packs;
- predictive loading informed by road direction as well as velocity;
- true reusable pools for generated crowds and traffic;
- abstract distant pedestrians, traffic and police;
- local and macro navigation graphs;
- stress traversal across an enlarged city at maximum vehicle speed.

## Acceptance policy

City Streaming must not change the visible layout or campaign flow. Required checks:

- deterministic `5 × 3` manifest and fifteen payload files;
- stable payload IDs and no duplicate cross-chunk query results;
- active-first asynchronous requests with cancellation and retry;
- no more than the configured activation budget in a normal frame;
- LRU eviction never removes currently desired chunks;
- remote ordinary NPCs stop updating and leave the NPC spatial index;
- local NPCs and parked vehicles wake without recreation;
- mission targets and engaged actors remain pinned;
- police and hunter escalation still reaches the player;
- forward prefetch while driving;
- local building collision, light and shadow queries after opposite-edge traversal;
- body, evidence, prop and vehicle deltas are indexed by chunk without replacing campaign authority;
- all existing boot, system and campaign browser domains remain green.

## Acceptance record

City Streaming 3 was accepted on 2026-07-22 through PR #22 after correcting manifest resolution for both `/` and `/phaser/` entry paths.

Validated on final head `ad8c7ff3817014eee17129a36180dce630922080`:

```text
unit-tests         success
browser-boot       success
browser-systems    success
browser-campaign   success
```
