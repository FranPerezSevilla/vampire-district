# Performance Pass 6 — Pressure/Evidence repeatability checkpoint

_State: the unchanged repeat capture selects `PublishState.Summary.PressureEvidence` decisively, but this remains a four-summary orchestration group. This increment records repeatability only; no runtime optimization or gameplay/state-publication change is authorized._

## Repeat capture authority — 2026-08-20

The exact same performance-bearing browser job was re-run on unchanged head `2a6c67cf1c3cb48eb66f39864ebc888bdc9bcb94`; no runtime or profiler code was changed between the two measurements.

Re-run job:

- workflow: `32314947563`;
- job: `browser-systems (shard 3/3)`;
- durable artifact: `runtime-performance-capture-shard-3`;
- artifact id: `9388906180`;
- archive digest: `sha256:76b04c7d77a11b0eb5b678676e895cc2a9eb1c02339c55fe4365f06e8d74376b`;
- head: `2a6c67cf1c3cb48eb66f39864ebc888bdc9bcb94`.

The re-run completed successfully. The branch remained 0 commits behind `main` before the repeat was started.

## Control hierarchy

The established parent hierarchy remains stable on the repeat:

- outer `GameplayRuntimeCore`: **24/24**, mean reported average **5.530 ms**, peak recent max **14.2 ms**;
- core `Core.Finalize`: **24/24**, mean **2.545 ms**, peak **5.7 ms**;
- finalize `Finalize.PublishState`: **24/24**, mean **2.096 ms**, peak **5.1 ms**;
- grouped `PublishState.Summaries`: **24/24**, mean **0.250 ms**, peak **1.3 ms**.

The grouped publish-state control again rules out the registry commit as the hotspot: `PublishState.RegistryCommit` is only **0.006 ms mean** on this repeat.

## Summary-group repeat result

The previous artifact (`9387794064`) did not provide a universal summary winner: `PressureEvidence` won 16/24 overall while `MissionActors.Npc` won the 8/8 street-return samples.

The unchanged repeat is more decisive:

- `PublishState.Summary.PressureEvidence`: **24/24 snapshots**, **share 1.000**, all three phases, mean **0.074 ms**, peak **0.5 ms**;
- `PublishState.Summary.MissionActors.Npc`: mean **0.033 ms**, peak **0.1 ms**;
- `PublishState.Summary.MissionActors.NeedsPowers`: mean **0.028 ms**, peak **0.2 ms**;
- `PublishState.Summary.ResponseAI.Security`: mean **0.027 ms**, peak **0.2 ms**;
- `PublishState.Summary.Tail`: mean **0.021 ms**, peak **0.1 ms**;
- `PublishState.Summary.ResponseAI.WorldAI`: mean **0.019 ms**, peak **0.1 ms**;
- `PublishState.Summary.MissionActors.Mission`: mean **0.009 ms**, peak **0.1 ms**.

Per phase, `PressureEvidence` wins **8/8 settled-street**, **8/8 harbor-stream** and **8/8 street-return** samples.

This repeat therefore rejects the earlier interpretation that the summary hotspot is inherently phase-dependent. The stable owner at the current profiler resolution is `PublishState.Summary.PressureEvidence`.

## Why this still does not authorize optimization

`PublishState.Summary.PressureEvidence` is still a broad sequential group containing four current-state summary families:

1. Exposure;
2. Heat / Wanted;
3. Witness;
4. Evidence.

Its measured mean is only **0.074 ms**, so adding many leaf wrappers would risk profiler overhead becoming comparable to the work being measured. The correct next step is one bounded refinement only, not an optimization and not a full leaf profiler.

A later independent measurement increment may add at most one new existing-method boundary inside this group—for example at `WitnessSystem.summary()`—to split pressure (`Exposure + Heat/Wanted`) from witness/evidence work. If that repeatable split still produces only sub-0.1 ms costs with no materially dominant child, Performance Pass 6 should be closed with an explicit **no optimization warranted** decision rather than pursuing profiler noise indefinitely.

Any runtime optimization remains a separate later increment and must preserve observable published state and use comparable before/after evidence.
