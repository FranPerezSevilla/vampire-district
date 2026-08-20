# Performance Pass 6 — Mission vs NPC summary drill-down

_State: the durable MissionActors refinement selects `PublishState.Summary.MissionActors.MissionNpc` decisively. This increment only splits that selected pair into mission-objective and NPC phases; no runtime optimization or gameplay/state-publication behavior change is authorized here._

## MissionActors refinement authority — 2026-08-20

Workflow `32314488184` completed successfully on head `ab6bd6bfb04f9d1a465e1213671bf31c3bee388f`.

Durable artifact:

- name: `runtime-performance-capture-shard-3`;
- artifact id: `9387656717`;
- archive digest: `sha256:9926623f48ca41651a74643a3d9c139329366a5df8c94cf4a852bc46b9314acc`.

The complete workflow passed, and the branch remained 0 commits behind `main` when the artifact was consumed.

The established hierarchy remains stable:

- outer: `GameplayRuntimeCore` wins **24/24**, mean reported average **7.144 ms**, peak recent max **21.0 ms**;
- core: `Core.Finalize` wins **24/24**, mean **3.376 ms**, peak **6.6 ms**;
- finalize: `Finalize.PublishState` wins **24/24**, mean **2.834 ms**, peak **4.9 ms**;
- grouped publishState: `PublishState.Summaries` wins **24/24**, mean **0.255 ms**, peak **1.5 ms**.

The refined summary ranking selects the mission/NPC half of MissionActors decisively:

- `PublishState.Summary.MissionActors.MissionNpc`: **24/24 snapshots**, all three phases, mean **0.081 ms**, peak **0.4 ms**;
- `PublishState.Summary.PressureEvidence`: **0.061 ms** mean, peak **0.4 ms**;
- `PublishState.Summary.ResponseAI.Security`: **0.053 ms** mean, peak **0.3 ms**;
- `PublishState.Summary.MissionActors.NeedsPowers`: **0.025 ms** mean, peak **0.2 ms**;
- `PublishState.Summary.ResponseAI.WorldAI`: **0.008 ms** mean, peak **0.1 ms**;
- `PublishState.Summary.Tail`: effectively **0.000 ms** mean.

Per phase, `MissionNpc` wins 8/8 settled-street, 8/8 harbor-stream and 8/8 street-return samples. The sibling `NeedsPowers` phase is therefore ruled out as the current MissionActors hotspot.

## MissionNpc-only refinement

`MissionNpc` contains exactly two sequential operations in `GameSceneCore.publishState()`:

1. `MissionSystem.objectiveText()`;
2. `NpcSystem.summary()`.

This increment adds exactly one new existing-method boundary at `NpcSystem.summary()` and replaces the broad pair with two concrete phases:

- `PublishState.Summary.MissionActors.Mission` — mission objective text only;
- `PublishState.Summary.MissionActors.Npc` — `NpcSystem.summary()` only, ending at the existing `FeedingSystem.summary()` boundary.

The existing `PublishState.Summary.MissionActors.NeedsPowers`, PressureEvidence, ResponseAI Security/WorldAI and Tail phases remain unchanged. The browser artifact needs no schema change because both new labels remain under the existing `PublishState.Summary.` prefix and are automatically included in `publishStateSummaries`.

The instrumentation remains active only while `publishState()` is executing, reuses the existing `RuntimeDiagnostics` sampling stride, and restores the original `NpcSystem.summary()` method during cleanup. No state payload field, summary order, return value, density, AI behavior, traffic, police behavior, audio or gameplay rule is changed.

## Decision gate

Consume the next successful durable browser artifact from this split.

- If `PublishState.Summary.MissionActors.Npc` wins repeatedly across all 24 snapshots and all three phases, `NpcSystem.summary()` is concrete enough to become the measured owner for a later optimization increment with a before/after capture.
- If `PublishState.Summary.MissionActors.Mission` wins repeatedly, `MissionSystem.objectiveText()` becomes the concrete measured owner for a later optimization increment.
- If the two phases trade wins or the difference collapses into profiler noise, repeat/refine measurement rather than optimizing.
- Any actual optimization remains a separate subsequent increment; this checkpoint is measurement only.
