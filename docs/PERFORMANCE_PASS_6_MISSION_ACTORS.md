# Performance Pass 6 — MissionActors summary drill-down

_State: the durable ResponseAI-refinement capture shifted the decisive summary hotspot to `PublishState.Summary.MissionActors`. This increment only splits that selected group into two balanced low-overhead phases; no runtime optimization or gameplay/state-publication behavior change is authorized here._

## ResponseAI refinement authority — 2026-08-20

Workflow `32309937959` completed successfully on head `6b7d5e8d77625e4f942c934357a39a02ef7445e5`.

Durable artifact:

- name: `runtime-performance-capture-shard-3`;
- artifact id: `9386167590`;
- archive digest: `sha256:e6305c00a6a1577a2d2207704a3ea02146de296e1439681c40c5841dee88fd73`.

The complete workflow passed unit tests, City Compiler, Foundry, browser campaign, browser boot and all three browser-system shards. The branch remained 0 commits behind `main` when this artifact was consumed.

The established measurement hierarchy remains stable:

- outer: `GameplayRuntimeCore` wins **24/24**, mean reported average **6.553 ms**, peak recent max **20.4 ms**;
- core: `Core.Finalize` wins **24/24**, mean **3.049 ms**, peak **6.2 ms**;
- finalize: `Finalize.PublishState` wins **24/24**, mean **2.651 ms**, peak **3.8 ms**;
- grouped publishState: `PublishState.Summaries` wins **24/24**, mean **0.205 ms**, peak **1.3 ms**.

The refined summary ranking no longer selects either half of the former ResponseAI winner. Instead, `MissionActors` becomes the stable top group:

- `PublishState.Summary.MissionActors`: **24/24 snapshots**, all three phases, mean **0.068 ms**, peak **0.4 ms**;
- `PublishState.Summary.PressureEvidence`: **0.053 ms** mean, peak **0.4 ms**;
- `PublishState.Summary.ResponseAI.Security`: **0.034 ms** mean, peak **0.2 ms**;
- `PublishState.Summary.ResponseAI.WorldAI`: **0.025 ms** mean, peak **0.1 ms**;
- `PublishState.Summary.Tail`: effectively **0.000 ms** mean.

Per phase, `MissionActors` wins 8/8 settled-street, 8/8 harbor-stream and 8/8 street-return samples. The ResponseAI split therefore did its job: it showed that neither Police+Hunter nor Props+AI is now the dominant measured summary phase. The next measurement target is the independently stable `MissionActors` group.

## MissionActors-only refinement

`MissionActors` still contains four sequential operations: mission objective text, NPC summary, Hunger summary and Powers summary. Optimizing any one of them from source inspection would still be guesswork.

This increment adds exactly one new existing-method boundary at `FeedingSystem.summary()` and replaces the broad `PublishState.Summary.MissionActors` phase with two balanced contiguous phases:

- `PublishState.Summary.MissionActors.MissionNpc` — mission objective text plus `NpcSystem.summary()`;
- `PublishState.Summary.MissionActors.NeedsPowers` — `FeedingSystem.summary()` plus `PowersSystem.summary()`.

`NpcSystem.summary()`, mission objective text and `PowersSystem.summary()` remain unwrapped. The single Feeding boundary transitions between the two phases. Existing PressureEvidence, ResponseAI Security/WorldAI and Tail boundaries remain unchanged.

Because both new labels retain the `PublishState.Summary.` prefix, the existing durable `publishStateSummaries` ranking automatically includes them alongside PressureEvidence, Security, WorldAI and Tail. Outer/core/finalize/grouped publishState controls remain unchanged.

## Decision gate

Consume the next successful durable browser artifact from this MissionActors split.

- If `MissionNpc` wins repeatedly across all 24 snapshots and all three phases, deepen only mission objective vs NPC in a later independent increment if the difference is still worth measuring.
- If `NeedsPowers` wins repeatedly, deepen only Hunger vs Powers in a later independent increment if needed.
- If the two phases trade wins or their difference collapses into profiler noise, repeat/refine measurement rather than optimizing.
- Any actual optimization remains a separate later increment with comparable before/after evidence.

No density, gameplay, AI behavior, traffic, police, audio, state payload, summary ordering or registry publication semantics are changed by this checkpoint.
