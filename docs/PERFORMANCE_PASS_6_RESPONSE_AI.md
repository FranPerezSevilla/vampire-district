# Performance Pass 6 — ResponseAI summary drill-down

_State: the first durable summary-group capture selects `PublishState.Summary.ResponseAI` decisively. This increment only splits that broad group into two low-overhead phases; no runtime optimization or gameplay/state-publication behavior change is authorized here._

## Summary-group authority — 2026-08-20

Workflow `32307816150` completed successfully on head `11e87a26678bb2a20702ea557af369dae67a71c8`.

Durable artifact:

- name: `runtime-performance-capture-shard-3`;
- artifact id: `9385452788`;
- archive digest: `sha256:e05344c827718e85f39d40ede4228931ae249db978cc156ec2f65199047d278b`.

The complete workflow passed unit tests, City Compiler, Foundry, browser campaign, browser boot and all three browser-system shards.

The established hierarchy remains stable:

- outer: `GameplayRuntimeCore` wins **24/24**, mean reported average **6.778 ms**, peak recent max **18.4 ms**;
- core: `Core.Finalize` wins **24/24**, mean **3.101 ms**, peak **5.1 ms**;
- finalize: `Finalize.PublishState` wins **24/24**, mean **2.608 ms**, peak **3.7 ms**;
- grouped publishState: `PublishState.Summaries` wins **24/24**, mean **0.208 ms**, peak **1.1 ms**.

The new summary-group ranking is decisive:

- `PublishState.Summary.ResponseAI` wins **24/24 snapshots** and all three phases, mean **0.088 ms**, peak recent max **0.4 ms**;
- `PublishState.Summary.MissionActors`: **0.058 ms** mean, peak **0.3 ms**;
- `PublishState.Summary.PressureEvidence`: **0.051 ms** mean, peak **0.3 ms**;
- `PublishState.Summary.Tail`: **0.002 ms** mean, peak **0.1 ms**.

Per phase, `ResponseAI` wins 8/8 settled-street, 8/8 harbor-stream and 8/8 street-return samples. This is stable enough to narrow measurement, but `ResponseAI` is still a broad sequence containing Police, Hunter, prop and AI summaries, so it is not yet a concrete optimization owner.

## ResponseAI-only refinement

This increment deepens only the selected `ResponseAI` block and adds just one new existing-method boundary at `PropDamageSystem.summary()`.

The former broad `PublishState.Summary.ResponseAI` phase is replaced by two contiguous phases:

- `PublishState.Summary.ResponseAI.Security` — `PoliceSystem.summary()` plus `HunterSystem.summary()`;
- `PublishState.Summary.ResponseAI.WorldAI` — `PropDamageSystem.summary()` plus `AiStateSystem.summary()`.

The existing Police boundary starts `Security`, the new prop boundary transitions to `WorldAI`, and the existing AI boundary transitions to `Tail`. Individual Police/Hunter/Prop/AI summaries are not wrapped separately, avoiding the profiler-overhead problem observed in the historical leaf capture.

Because both new labels remain under the existing `PublishState.Summary.` prefix, the durable browser artifact continues using the same `publishStateSummaries` ranking. Outer/core/finalize/grouped publishState controls are unchanged.

## Decision gate

Consume the next successful durable browser artifact from this two-phase ResponseAI split.

- If `Security` wins repeatedly across the 24 snapshots and all three phases, deepen only Police vs Hunter in a later independent increment if needed.
- If `WorldAI` wins repeatedly, deepen only Props vs AI in a later independent increment if needed.
- If the two phases trade wins or the difference collapses into profiler noise, repeat/refine measurement rather than optimizing.
- Any actual optimization remains a separate subsequent increment with comparable before/after evidence.

No density, gameplay, AI behavior, police behavior, traffic, audio, state payload, summary ordering or registry publication semantics are changed by this checkpoint.
