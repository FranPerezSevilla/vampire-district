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

The deterministic 72-pedestrian benchmark must remain below 10% of the old all-pairs candidate count while preserving zero-overlap behavior. Existing pedestrian collision, route expansion and entity streaming tests must remain valid. If in-game hitching remains after this pass, the next performance increment should add per-system wall-time sampling before changing another subsystem.
