# ViceBlood performance review

_Last updated: 2026-08-18_

This document records measured performance work for PR #55. Optimizations must be evidence-driven and preserve gameplay behavior.

## Pass 1 — pedestrian crowd broadphase

**State: implemented; pending in-game frame-time validation.**

### Measured hotspot

The pedestrian route expansion raised the routed population to **72**. Before this pass, `PedestrianSystem` performed an all-pairs crowd scan during separation, repeated full-pair overlap/minimum-separation diagnostics, and scanned the full crowd again for each moving pedestrian's clearance check. With 72 participants, a single all-pairs pass costs **2,556 pair checks** before the second post-update crowd pass and per-pedestrian clearance work are counted.

A deterministic 12×6 benchmark at 18-unit spacing now records **126 local candidate checks instead of 2,556**, a **95.1% reduction** in crowd-resolution pair checks for the same 72 actors.

This makes pedestrian crowd separation/clearance the first confirmed CPU-scaling hotspot associated with the larger population. Browser wall-time profiling still owns the final ranking against traffic, rendering, collision and audio.

### Implementation

`PedestrianSystem` now uses the existing `NpcSystem` `SpatialHash` via `queryRadius()` for crowd resolution and movement clearance instead of repeatedly walking the entire NPC list. Pair ordering prevents duplicate A↔B checks. Scenes and isolated tests without `queryRadius()` retain the previous brute-force fallback.

The runtime exposes `pairChecks`, `metricPairChecks` and `broadphase` in the pedestrian crowd snapshot. The large pedestrian debug/state snapshot is published at **4 Hz** instead of every render frame; gameplay movement and collision remain frame-rate updates, while diagnostic allocation pressure is reduced.

### Regression contract

The deterministic 72-pedestrian benchmark must remain below 10% of the old all-pairs candidate count while preserving zero-overlap behavior. Existing pedestrian collision, route expansion and entity streaming tests must remain valid.

## Pass 2 — bounded outer-pipeline wall-time sampling

**State: implemented; pending in-game browser capture and ranking.**

### Why this pass exists

Pass 1 proved that pedestrian broadphase scaled badly, but it did not establish whether pedestrians are still the dominant cause of the intermittent hitching after that optimization. Before changing another gameplay subsystem, the runtime now measures the major outer pipelines directly so traffic, streaming, pedestrians and the core gameplay loop can be compared on the same browser clock.

### Instrumentation

`RuntimeDiagnostics` samples named sections with `performance.now()` at a bounded cadence: **one sample every 6 invocations per named pipeline**. Cadence is tracked independently for each name, so call ordering cannot cause one subsystem to monopolize the samples.

The first coarse categories are:

- `StreamingPipeline`: chunk stream, district packs, entity streaming and distant simulation.
- `TrafficPipeline`: macro traffic, materialization, vehicle witnesses, local traffic behavior and physical/impact consequences.
- `MotorizedPoliceSystem`.
- `PedestrianSystem`.
- `GameplayRuntimeCore`: the existing input/combat/NPC/witness/police/mission/presentation loop as one coarse owner.
- `TerritoryRuntimeSystem`.

Each runtime snapshot now exposes per-pipeline call count, sample count, average sampled wall time, recent sampled maximum and lifetime sampled maximum, plus a ranked `slowestSystems` list. If `GameplayRuntimeCore` wins consistently, the next pass should drill into that loop rather than guessing which internal system is responsible.

### Diagnostic allocation pressure

The nested runtime diagnostics object is cached for **250 ms**. `GameplayRuntimeCore` may continue asking for a snapshot every frame, but calls inside that window reuse the same object instead of rebuilding maps, sorted arrays and timing records. At a 60 FPS target this bounds heavy snapshot construction to roughly **4 times per second instead of 60**, a **93.3% reduction** in those diagnostic object rebuilds. Frame samples themselves are still recorded every frame.

### Playtest capture

In a hitch-prone area, let the game run normally for several seconds and inspect `window.NBD_RUNTIME_DIAGNOSTICS.snapshot({ force: true })`. Compare `slowestSystems`, `systemTimings`, `averageFrameMs` and `recentMaxFrameMs`. The next optimization must target the top repeatable pipeline from that capture; if the ranking changes wildly between captures, gather a longer sample before modifying gameplay behavior.

### Regression contract

Pipeline timing must remain observational: it cannot alter system update order or gameplay cadence. Sampling must stay bounded, snapshots must reuse their heavy object inside the 250 ms cache window, and the pedestrian broadphase regression benchmark from Pass 1 must continue to pass.

## Pass 3 — remove per-frame vehicle-adapter allocation churn

**State: implemented; pending in-game hitch validation.**

### Confirmed allocation hotspot

Source-level inspection of the profiled outer runtime found an allocation pattern independent of which gameplay pipeline wins the wall-time ranking: `GameplayRuntime.update()` recreated two wrapper functions on every frame (`input.beginFrame` and `scene.collectInteractions`) and also cloned the input frame into an `enriched` object before the core runtime consumed it. At a 60 FPS target, ordinary on-foot play therefore produced at least **180 adapter-owned short-lived allocations per second** (two functions plus one object per frame), or **10,800 per minute**, before any subsystem-specific allocations are counted. Driving added another filtered input-frame object on top of that.

This kind of constant short-lived churn is a plausible contributor to intermittent garbage-collection hitches even when its average CPU time is small, so it is safe to remove without waiting for the browser wall-time winner.

### Implementation

The two adapters are now bound once for the lifetime of `GameplayRuntime` and temporarily installed only around the existing core update, preserving the previous ownership window and restoration semantics. The raw input frame is enriched **in place** with `vehicleActionPressed`, `handbrakeHeld` and the vehicle-action traversal edge instead of being spread into a second object. Interaction options return the original array when no vehicle/traversal edge requires filtering; when filtering is required, a simple loop avoids an extra callback closure.

The remaining `VehicleSystem.filterInputFrame()` object created while actively driving is intentionally retained because it is the central authority that suppresses on-foot actions during vehicle control. This pass removes the unconditional adapter churn rather than bypassing that safety boundary.

### Measured allocation reduction

The adapter layer drops from at least **3 short-lived allocations per ordinary frame to 0** outside active vehicle filtering. At 60 FPS that removes the deterministic **10,800 allocations/minute** identified above. While driving, the adapter drops from at least 4 allocations per frame to the single authoritative filtered-frame object, a **75% reduction** in this layer.

### Regression contract

Vehicle input enrichment must preserve the same frame object, vehicle entry/exit must still route through the movement/traversal path, and interaction filtering must preserve the original options array when no filter edge is active. `GameplayRuntime.update()` must not reintroduce frame-local `beginFrame` or `collectInteractions` function literals. Pass 2 wall-time sampling remains active so the next optimization can still target the top repeatable browser pipeline rather than guessing.
