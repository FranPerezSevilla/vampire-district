# Performance Pass 6 — Pressure/Evidence repeatability checkpoint

_State: the bounded Pressure/Evidence split confirms both children are sub-0.1 ms and neither is a material optimization target. No further microinstrumentation is justified by this branch; the next independent increment should close Performance Pass 6 explicitly as `no optimization warranted` and move to the grouped final playtest._

## Pressure/Evidence two-way split capture — 2026-08-20

The bounded refinement requested by the repeatability checkpoint completed on code head `30becdb3bc7cb95e253fd40b21e9a4ed427f503c`.

Implementation commits:

- `776b6eafbf1975589c7ef72b012331fd2ecccb8b` — add the single `WitnessSystem.summary()` boundary and split the former broad PressureEvidence phase;
- `30becdb3bc7cb95e253fd40b21e9a4ed427f503c` — regression coverage for the two child phases and cleanup/restoration contract.

The instrumentation changes only measurement. `GameSceneCore.publishState()` and its observable payload/order remain unchanged. The former broad phase is replaced by exactly two contiguous children:

- `PublishState.Summary.PressureEvidence.Pressure` — Exposure + Heat/Wanted;
- `PublishState.Summary.PressureEvidence.WitnessEvidence` — Witness + Evidence.

No Exposure/Heat/Witness/Evidence leaf wrapper set was added. The only new existing-method boundary is `WitnessSystem.summary()`, preserving the low-overhead rule established after the historical leaf-profiler capture.

Validation workflow `32321957805` reached and passed the performance-bearing browser shard. Unit tests, City Compiler, Foundry and browser campaign also passed before the capture was consumed. Netlify deploy preview succeeded for the code head.

Durable artifact:

- name: `runtime-performance-capture-shard-3`;
- artifact id: `9390134779`;
- archive digest: `sha256:359a79b155848ab4f9082e6f317e1d17fc65abda2fe1f9e4b5b16071b3a478a0`;
- workflow: `32321957805`;
- head: `30becdb3bc7cb95e253fd40b21e9a4ed427f503c`.

The control hierarchy remains stable:

- outer `GameplayRuntimeCore`: **24/24**, mean reported average **5.258 ms**, peak recent max **15.6 ms**;
- core `Core.Finalize`: **24/24**, mean **2.412 ms**, peak **4.9 ms**;
- finalize `Finalize.PublishState`: **24/24**, mean **1.920 ms**, peak **2.5 ms**;
- grouped `PublishState.Summaries`: **24/24**, mean **0.201 ms**, peak **1.1 ms**;
- `PublishState.RegistryCommit`: only **0.011 ms** mean.

The two Pressure/Evidence children are both microcosts:

- `PublishState.Summary.PressureEvidence.WitnessEvidence`: **0.039 ms mean**, peak **0.2 ms**;
- `PublishState.Summary.PressureEvidence.Pressure`: **0.018 ms mean**, peak **0.1 ms**.

Neither child is the summary winner. The same capture selects `PublishState.Summary.MissionActors.NeedsPowers` **24/24 snapshots and all three phases** at only **0.048 ms mean** / **0.3 ms peak**. `ResponseAI.Security` is **0.040 ms**, NPC **0.025 ms**, Tail **0.013 ms**, Mission **0.009 ms** and WorldAI **0.009 ms**.

This is the important decision signal: once the profiler is narrowed to concrete summary work, all contenders are clustered below **0.05 ms mean** in this run. The Pressure/Evidence split did not reveal a material child hotspot; instead, the top microgroup shifted again while remaining tiny. Pursuing another boundary would make profiler overhead increasingly comparable to the work and would not be an evidence-backed performance optimization.

**Decision gate:** do not add another summary boundary and do not optimize any of these microgroups from this capture. The next independent increment should record the Performance Pass 6 closure as **`no optimization warranted`**, preserving the durable evidence chain, then proceed to the required grouped automated/in-game validation path. An optimization should only be reopened if a future comparable outer capture shows a materially larger concrete owner.

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

That bounded refinement is now complete above. It confirms that both resulting children remain sub-0.1 ms and that no material concrete optimization owner emerges. Performance Pass 6 should therefore be closed in the next independent increment rather than pursuing profiler noise indefinitely.
