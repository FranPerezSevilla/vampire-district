# Performance Pass 6 — publishState summaries drill-down

_State: `PublishState.Summaries` is the decisive grouped hotspot. This checkpoint adds summary-group measurement only; no runtime optimization or gameplay change is authorized here._

## Grouped publishState authority — 2026-08-19

The low-overhead five-phase profiler completed successfully on workflow `32307180336` for head `41c87d62f76b8427a575c61950df7607123f02c5`.

Durable artifact:

- name: `runtime-performance-capture-shard-3`;
- artifact id: `9385238276`;
- archive digest: `sha256:4e4e626ef144cfefb1052d5ebf2496325eead9936eb8df1c410f5dc832a938c1`.

The complete workflow passed unit tests, City Compiler, Foundry, browser campaign, browser boot and all three browser-system shards.

The capture keeps the previously established hierarchy stable:

- outer: `GameplayRuntimeCore` wins **24/24**, mean reported average **6.295 ms**, peak recent max **16.6 ms**;
- core: `Core.Finalize` wins **24/24**, mean **3.040 ms**, peak **6.4 ms**;
- finalize: `Finalize.PublishState` wins **24/24**, mean **2.479 ms**, peak **4.3 ms**.

The new grouped `publishState` ranking is decisive:

- `PublishState.Summaries` wins **24/24 snapshots** and all three phases, mean **0.221 ms**, peak recent max **1.4 ms**;
- `PublishState.Prepare`: **0.025 ms** mean;
- `PublishState.RegistryCommit`: **0.010 ms** mean;
- `PublishState.InteractionMenu`: **0.009 ms** mean;
- `PublishState.PayloadTail`: **0.008 ms** mean.

Per phase, `PublishState.Summaries` wins 8/8 settled-street, 8/8 harbor-stream and 8/8 street-return samples. The previous leaf profiler had split wins between tiny methods; the grouped result removes that ambiguity and specifically rules out `RegistryCommit` as the dominant measured phase.

The grouped timings still account for much less than the enclosing `Finalize.PublishState` mean. That gap is treated as instrumentation/parent-wrapper overhead, not as permission to invent an unmeasured optimization. Any optimization must target a concrete measured summary subgroup and be evaluated against a comparable capture with measurement overhead held constant.

## Summary-only drill-down

Because `PublishState.Summaries` remains a broad sequential block, this increment deepens only that phase. It deliberately does **not** return to seventeen leaf wrappers.

Four coarse summary groups are measured:

- `PublishState.Summary.MissionActors` — mission objective, NPC, Hunger and Powers summaries;
- `PublishState.Summary.PressureEvidence` — Exposure, Heat/Wanted, Witness and Evidence summaries;
- `PublishState.Summary.ResponseAI` — Police, Hunter, prop and AI summaries;
- `PublishState.Summary.Tail` — final player/prompt/status scalar construction before the interaction-menu snapshot.

The profiler adds only three new existing-method boundaries (`ExposureSystem.summary`, `PoliceSystem.summary`, `AiStateSystem.summary`) while reusing the already wrapped `visibilityText` and `InteractionSystem.snapshot` boundaries. Individual summaries remain unwrapped. All timers still reuse `RuntimeDiagnostics.beginSystem/endSystem` and therefore inherit the 1-in-6 sampling stride and bounded sample history.

The browser capture keeps `publishState` as an explicit five-name ranking so the new `PublishState.Summary.*` children cannot contaminate the grouped authority. A new parallel `publishStateSummaries` ranking is persisted in the same `.artifacts/performance/runtime-performance-capture.json` artifact.

## Decision gate

Consume the next successful durable artifact from this summary-group profiler.

- If one `PublishState.Summary.*` group wins repeatedly across all 24 snapshots and all three phases, deepen only that group in a later independent increment if it is still too broad.
- If the winning group is already narrow enough to identify a concrete owner, record it as the before authority; any optimization remains a separate subsequent increment.
- If groups trade wins or the measured differences collapse into noise, repeat/refine measurement rather than guessing.

No density, gameplay, AI, traffic, police, audio, state-publication semantics or method ordering is changed by this checkpoint.
