# Performance Pass 6 — publishState drill-down

_State: the leaf-method capture proved inconclusive and instrumentation-heavy; a grouped low-overhead phase profiler is now the next measurement authority. No runtime optimization or gameplay behavior change is authorized by this document._

## Grouped low-overhead refinement checkpoint — 2026-08-19

The first successful `PublishState.*` artifact is useful precisely because it **does not** justify an optimization yet.

The original browser workflow `32300349044` was cancelled across several browser jobs while installing Chromium before product tests. A rerun of the failed jobs succeeded far enough to execute the performance-bearing shard and produced `runtime-performance-capture-shard-3`:

- artifact id: `9384767697`;
- archive digest: `sha256:7bbe62b1de63468645356f965594e6747970a9b9f1c4f2035bdc82f02068e0a1`;
- outer: `GameplayRuntimeCore` wins **24/24**, mean reported average **4.476 ms**, peak recent max **12.8 ms**;
- core: `Core.Finalize` wins **24/24**, mean **2.061 ms**, peak **4.6 ms**;
- finalize: `Finalize.PublishState` wins **24/24**, mean **1.650 ms**, peak **3.1 ms**.

The leaf-level `publishState` ranking is not stable enough to select an owner:

- `PublishState.Npc` wins **17/24** overall (share **0.708**) with mean **0.027 ms**;
- `PublishState.RegistryCommit` wins the other **7/24** (share **0.292**) with mean **0.026 ms**;
- settled-street selects `RegistryCommit` in **7/8** samples, while harbor-stream and street-return select `Npc` in **8/8** each;
- every other measured leaf is at or below **0.023 ms mean**.

More importantly, those leaf timings explain only a small fraction of the parent `Finalize.PublishState` time. The previous profiler wrapped seventeen tiny methods, and each wrapper introduced its own argument-array/function call plus `RuntimeDiagnostics.beginSystem()` bookkeeping on every frame. At this scale, that measurement machinery is material relative to the operations it is trying to rank. Treating the 0.027 ms vs 0.026 ms leaf difference as an optimization signal would therefore be false precision.

This increment replaces that leaf profiler with **five coarse sequential phases** while leaving `GameSceneCore.publishState()` itself unchanged:

- `PublishState.Prepare` — entry through `visibilityText()`, including layer/zone and prompt preparation;
- `PublishState.Summaries` — the mission/system summary and derived state payload body after visibility through the final scalar/text fields;
- `PublishState.InteractionMenu` — the existing interaction snapshot;
- `PublishState.PayloadTail` — final payload completion between the interaction snapshot and the registry call;
- `PublishState.RegistryCommit` — the existing `RegistryPublisher.setMany()` call.

Only three existing boundary methods are wrapped (`visibilityText`, `interactionSystem.snapshot`, `statePublisher.setMany`) plus the existing outer `publishState` wrapper. Individual summary methods are deliberately left untouched. This keeps the observable publication order and return values unchanged while reducing profiler overhead enough to answer the real next question: **is the cost in payload preparation/summaries or in the registry commit?**

**Decision gate:** consume the next durable browser artifact from this grouped profiler. If one coarse phase wins consistently across snapshots/phases, deepen only that phase in a later increment. Any actual optimization remains a separate subsequent increment with a comparable before/after capture.

## Why this drill-down exists

The durable Performance Pass 6 capture on workflow `32295425070` narrowed the stable hotspot from `GameplayRuntimeCore` to `Core.Finalize`, then to `Finalize.PublishState`.

The authoritative before evidence for this drill-down is artifact `runtime-performance-capture-shard-3`, artifact id `9381206757`, archive digest `sha256:d6ada140a82b501d0713855faae5c9b1adf45fee881e560ec997f60198c3fa3d`:

- outer: `GameplayRuntimeCore` wins 24/24 snapshots, mean reported average 6.683 ms;
- core: `Core.Finalize` wins 24/24, mean reported average 3.014 ms;
- finalize: `Finalize.PublishState` wins 24/24 and all three phases, mean reported average 2.464 ms, peak recent max 3.9 ms;
- next finalize owner: `Finalize.Markers` at 0.252 ms mean.

The same workflow finished unit tests, City Compiler, Foundry, browser campaign and the performance-bearing browser-systems shard 3/3 successfully. Shards 1/3, 2/3 and browser boot were cancelled while installing Chromium and never entered product-test steps, so those cancellations are treated as transient infrastructure rather than product regressions.

## Instrumentation contract

`GameSceneCore.publishState()` is intentionally left unchanged. A measurement-only wrapper installed by `GameplayRuntime` profiles the existing calls only while the original `publishState()` body is active. Calls to the same methods outside state publication remain unmeasured by this family.

The first drill-down exposed concrete `PublishState.*` timings for:

- `Zone` and `Visibility` derived scene text;
- `Mission` objective text;
- `Npc`, `Hunger`, `Powers`, `Exposure`, `Heat`, `WantedLevel`, `Witness`, `Evidence`, `Police`, `Hunter`, `Props` and `Ai` summaries;
- `InteractionMenu` snapshot construction;
- `RegistryCommit`, the final existing `RegistryPublisher.setMany()` call.

That leaf-level layout is now retained only as historical evidence. The active grouped profiler uses the five phases documented above so profiling overhead cannot dominate tiny leaf operations.

Every timer reuses `RuntimeDiagnostics.beginSystem/endSystem`, therefore inherits the existing 1-in-6 sampling stride and bounded sample history. The wrapper is installed once, cleaned up with the runtime, and does not change the return values, arguments or ordering of the original methods.

## Durable browser evidence

`tests/browser/runtime-performance-capture.spec.js` keeps the existing outer, `core` and `finalize` rankings intact and adds a parallel `publishState` ranking filtered only by the `PublishState.` prefix. The same JSON remains persisted at:

`.artifacts/performance/runtime-performance-capture.json`

and uploaded by the existing browser-systems artifact step.

## Decision gate

Do not optimize from source inspection. Consume a successful durable browser artifact and require one `PublishState.*` phase to win repeatedly across the 24 snapshots and all three phases, or otherwise repeat measurement.

- If `PublishState.RegistryCommit` wins decisively, the next independent increment may prepare a before/after optimization specifically around redundant registry publication.
- If `PublishState.Summaries` wins decisively, deepen only that group in a later independent increment with a lower-overhead subgroup design.
- If `Prepare`, `InteractionMenu` or `PayloadTail` is material, isolate that phase rather than guessing from source inspection.
- If phases trade wins, repeat/refine measurement instead of optimizing.

Any actual optimization remains a separate future increment with the same capture methodology before and after.
