# Performance Pass 6 — publishState drill-down

_State: measurement-only instrumentation added; no runtime optimization or gameplay behavior change is authorized by this document._

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

The drill-down exposes concrete `PublishState.*` timings for:

- `Zone` and `Visibility` derived scene text;
- `Mission` objective text;
- `Npc`, `Hunger`, `Powers`, `Exposure`, `Heat`, `WantedLevel`, `Witness`, `Evidence`, `Police`, `Hunter`, `Props` and `Ai` summaries;
- `InteractionMenu` snapshot construction;
- `RegistryCommit`, the final existing `RegistryPublisher.setMany()` call.

Every timer reuses `RuntimeDiagnostics.beginSystem/endSystem`, therefore inherits the existing 1-in-6 sampling stride and bounded sample history. The wrapper is installed once, cleaned up with the runtime, and does not change the return values, arguments or ordering of the original methods.

## Durable browser evidence

`tests/browser/runtime-performance-capture.spec.js` keeps the existing outer, `core` and `finalize` rankings intact and adds a parallel `publishState` ranking filtered only by the `PublishState.` prefix. The same JSON remains persisted at:

`.artifacts/performance/runtime-performance-capture.json`

and uploaded by the existing browser-systems artifact step.

## Decision gate

Do not optimize from source inspection. Consume a successful durable browser artifact and require one `PublishState.*` label to win repeatedly across the 24 snapshots and all three phases, or otherwise repeat measurement.

- If `PublishState.RegistryCommit` wins decisively, the next independent increment may prepare a before/after optimization specifically around redundant registry publication.
- If one concrete summary wins decisively, optimize only that summary owner in a later independent increment.
- If several summary labels trade wins or the residual unprofiled work remains material, refine measurement instead of guessing.

Any actual optimization remains a separate future increment with the same capture methodology before and after.
