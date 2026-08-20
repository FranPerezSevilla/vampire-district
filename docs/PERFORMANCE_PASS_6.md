# Performance Pass 6 — repeatable browser hotspot capture

_State: **CLOSED — `no optimization warranted`**. Durable browser evidence narrowed the original outer hotspot to concrete publish-state summary work, but the final owners are microcosts below ~0.05 ms mean and the winner shifts as profiler boundaries are refined. No runtime optimization is justified on current evidence._

## Closure — 2026-08-20

Performance Pass 6 is complete. The pass achieved its purpose: it replaced intuition-based optimization with a durable browser measurement chain, repeatedly narrowed the apparent hotspot, and stopped when the remaining concrete work became smaller than a useful optimization target.

### Durable evidence chain

The accepted chain is:

1. **Outer runtime:** workflow `32283936765`, artifact `9377004371`, digest `sha256:0bf8d29c96325e558f401e899a25fe40843e6f2078c51e2aa515911369d4006f` — `GameplayRuntimeCore` won **24/24** snapshots and all three phases, mean **6.555 ms**.
2. **Core drill-down:** workflow `32289072702`, artifact `9379073165`, digest `sha256:5a171ed22c4ed115cfa9ca546d10f8a619e29508a077468b10fbefc0baa45e76` — `Core.Finalize` won **23/24** snapshots and all three phases, mean **2.477 ms**.
3. **Finalize drill-down:** workflow `32295425070`, artifact `9381206757`, digest `sha256:d6ada140a82b501d0713855faae5c9b1adf45fee881e560ec997f60198c3fa3d` — `Finalize.PublishState` won **24/24** snapshots and all three phases, mean **2.464 ms**.
4. **Historical leaf publishState capture:** rerun of workflow `32300349044`, artifact `9384767697`, digest `sha256:7bbe62b1de63468645356f965594e6747970a9b9f1c4f2035bdc82f02068e0a1` — tiny leaf methods split wins and profiler overhead was material, so this capture is evidence against leaf-level false precision rather than optimization authority.
5. **Grouped publishState authority:** workflow `32307180336`, artifact `9385238276`, digest `sha256:4e4e626ef144cfefb1052d5ebf2496325eead9936eb8df1c410f5dc832a938c1` — `PublishState.Summaries` won **24/24** snapshots and all three phases, mean **0.221 ms**; `RegistryCommit` was only **0.010 ms** mean.
6. **Summary-group authority:** workflow `32307816150`, artifact `9385452788`, digest `sha256:e05344c827718e85f39d40ede4228931ae249db978cc156ec2f65199047d278b` — `PublishState.Summary.ResponseAI` won **24/24**, mean **0.088 ms**.
7. **ResponseAI refinement:** workflow `32309937959`, artifact `9386167590`, digest `sha256:e6305c00a6a1577a2d2207704a3ea02146de296e1439681c40c5841dee88fd73` — after splitting ResponseAI, neither child remained dominant; `MissionActors` became the stable winner at **0.068 ms** mean.
8. **MissionActors refinement:** workflow `32314488184`, artifact `9387656717`, digest `sha256:9926623f48ca41651a74643a3d9c139329366a5df8c94cf4a852bc46b9314acc` — `MissionActors.MissionNpc` won **24/24**, mean **0.081 ms**.
9. **Mission vs NPC split:** workflow `32314947563`, artifact `9387794064`, digest `sha256:4ce06ea416adeaced615324f92172f2afb7a263b753c83eadf7e8da0c9189ff7` — `PressureEvidence` won **16/24** while `Npc` won **8/24`; the same unchanged runtime/profiler was therefore repeated before any optimization.
10. **Unchanged repeat:** rerun of `browser-systems (shard 3/3)` from workflow `32314947563`, artifact `9388906180`, digest `sha256:76b04c7d77a11b0eb5b678676e895cc2a9eb1c02339c55fe4365f06e8d74376b` — `PressureEvidence` won **24/24** and all phases, but at only **0.074 ms** mean.
11. **Bounded Pressure/Evidence split:** workflow `32321957805`, artifact `9390134779`, digest `sha256:359a79b155848ab4f9082e6f317e1d17fc65abda2fe1f9e4b5b16071b3a478a0` — `Pressure` measured **0.018 ms** mean and `WitnessEvidence` **0.039 ms** mean. Neither is material or the winner. The top concrete group shifted to `MissionActors.NeedsPowers` at only **0.048 ms** mean; `ResponseAI.Security` was **0.040 ms**, NPC **0.025 ms**, Tail **0.013 ms**, Mission **0.009 ms**, WorldAI **0.009 ms**, and `RegistryCommit` **0.011 ms**.

### Decision

**No optimization warranted.**

The pass found no concrete owner large enough to justify a behavior-preserving runtime change with meaningful expected payoff. Once the instrumentation reaches concrete summary groups, all contenders are clustered at or below roughly **0.05 ms mean**, while the identity of the micro-winner changes as boundaries are refined. At that scale, additional wrappers and timing bookkeeping become comparable to the work being ranked, so further drill-down would increase measurement distortion rather than confidence.

No runtime optimization is made as part of this closure. No density, gameplay, AI, traffic, police, audio, rendering, state-publication semantics or simulation order is changed.

### Reopen criteria

Reopen Performance Pass 6 only if new comparable evidence shows a materially larger concrete opportunity, for example:

- the same concrete owner wins repeatedly across the 24-snapshot capture and all three phases at a cost clearly outside the current sub-0.05 ms microcost cluster;
- a future change causes a repeatable outer/core/finalize regression and drill-down attributes it to one concrete owner;
- the grouped playtest exposes a user-visible hitch that can be reproduced and correlated with `NBD_RUNTIME_DIAGNOSTICS` / `NBD_PERF_CAPTURE` evidence;
- a system's workload or update contract changes materially enough that the current artifact chain no longer represents production behavior.

Do not reopen merely because a different microgroup wins one capture.

### Next step

Performance optimization is no longer the gate. The next independent increment is the **grouped final automated/browser playtest** covering the accepted PR #55 behavior: death/hospital recovery, vehicle explosions/damage presentation, traffic flow and obstacle avoidance, civilian gunshot panic, police pursuit/tactics, Blood Sense-only overlays, pause/controls/upright aim, main-menu/audio gate, vehicle-wall collision audio, and the remaining horn/collision/skid/siren/footstep/engine checks that can be automated. Any runtime change after this point requires a real regression found by that validation; otherwise the branch should proceed to human in-game listening/feel validation.

## Core.Finalize drill-down checkpoint — 2026-08-19

The first internal-core capture is decisive enough to narrow measurement one level further, but it still does **not** authorize an optimization.

- Workflow `32289072702` completed the performance-bearing browser shard successfully and produced `runtime-performance-capture-shard-3`.
- Artifact id: `9379073165`.
- Archive digest: `sha256:5a171ed22c4ed115cfa9ca546d10f8a619e29508a077468b10fbefc0baa45e76`.
- The outer ranking still selects `GameplayRuntimeCore` in **24/24** snapshots and all three phases, with mean reported average **5.071 ms** and peak recent max **12.9 ms** on this run.
- The internal `core` ranking selects `Core.Finalize` in **23/24** snapshots (**0.958 share**) and in all three phases. `Core.Finalize` reports mean average **2.477 ms** and peak recent max **6.2 ms**.
- `Core.WorldState` wins the remaining single snapshot and reports mean average **1.679 ms** / peak recent max **4.1 ms**. Every other `Core.*` bucket is below **0.25 ms mean** on this capture.

Because `Core.Finalize` is still an orchestration bucket, this increment drills down only that path. No gameplay, AI, traffic, police, audio, density, simulation order or rendering semantics are deliberately changed.

The finalize family now exposes seven bounded measurement labels:

- `Finalize.MovementNoise` — the existing movement-noise update;
- `Finalize.UxGuidance` — the existing UX-guidance update;
- `Finalize.Camera` — cinematic ownership check plus layer-camera update;
- `Finalize.Markers` — outskirts presentation, objective marker and prompt marker;
- `Finalize.Diagnostics` — frame accounting plus diagnostics snapshot;
- `Finalize.StatePublisher` — performance/runtime diagnostics publication into the state publisher;
- `Finalize.PublishState` — final scene state publication.

These labels reuse `RuntimeDiagnostics.beginSystem/endSystem`, therefore retain the existing **1-in-6 sampling stride** and bounded sample history. The existing outer ranking and `core` ranking remain explicit and uncontaminated; the persisted performance JSON now adds a third parallel `finalize` ranking using only `Finalize.*` timings.

The workflow-level browser boot job for `32289072702` was cancelled while installing Chromium and never entered a product test step. Unit tests, City Compiler, Foundry, browser campaign and all three browser-systems shards completed successfully, including the shard that produced the performance artifact. This is treated as transient infrastructure rather than a product regression.

**Decision gate:** consume the next successful artifact and require a repeatable `Finalize.*` winner before touching behavior. If the winning label is still a broad orchestration bucket, deepen only that label. Any actual optimization remains a separate later increment with a comparable before/after capture.

## Internal core instrumentation checkpoint — 2026-08-19

The first durable browser capture is decisive at the outer-pipeline level, but it does **not** authorize an optimization yet.

- Workflow `32283936765` produced artifact `runtime-performance-capture-shard-3` (artifact id `9377004371`, archive digest `sha256:0bf8d29c96325e558f401e899a25fe40843e6f2078c51e2aa515911369d4006f`).
- `GameplayRuntimeCore` won **24/24** outer snapshots and all three phases with mean reported average **6.555 ms** and peak recent max **28.0 ms**.
- The next outer entries were `StreamingPipeline` **2.202 ms**, `TrafficPipeline` **0.971 ms** and `PedestrianSystem` **0.739 ms**.
- Because the winning owner is an orchestration core rather than a concrete subsystem, this increment adds bounded internal timers only. It does **not** change simulation order, gameplay behavior, density, AI, traffic, police, audio or rendering semantics.

The core is split along existing sequential boundaries into seven measurement labels:

- `Core.Input` — death recovery, input frame, player-damage pre/filter, AI pre-update and weapon update;
- `Core.Combat` — debug-layer edge handling, powers, combat and drain update;
- `Core.InteractionQuery` — first interaction collection/ranking plus pressed traversal/interaction dispatch;
- `Core.WorldActors` — movement/feeding, NPC and witness actor updates;
- `Core.WorldState` — evidence, Heat/Exposure, police/firearms, hunters, spatial rebuild, damage/AI post-update, mission and tutorial state;
- `Core.InteractionRefresh` — post-simulation interaction collection/ranking;
- `Core.Finalize` — movement-noise/UX update plus camera/marker/state publication in `finishFrame()`.

These labels reuse `RuntimeDiagnostics.beginSystem/endSystem`, so they inherit the existing **1-in-6 sampling stride** and bounded sample history. No callback timer or per-frame allocation layer is introduced.

The browser capture now derives the existing outer ranking from the six explicit outer systems in `systemTimings` instead of from the global top-five list, so adding child timers cannot contaminate the outer before/after baseline. The persisted JSON keeps the existing outer fields and adds a parallel `core` ranking with winner shares, per-phase winners and timing aggregates.

**Decision gate:** consume the next successful capture artifact and require a repeatable internal winner before touching runtime behavior. If the internal ranking is unstable across phases/runs, repeat measurement rather than optimizing by intuition. Any actual optimization is a separate later increment.

## Durable CI evidence checkpoint — 2026-08-19

The baseline PR validation is fully green again, so Performance Pass 6 can proceed. Before choosing an optimization, the capture evidence is now made durable instead of relying only on a successful job's console stream.

- `tests/browser/runtime-performance-capture.spec.js` still emits the canonical `NBD_PERF_CAPTURE=<json>` console line, preserving the existing human/log inspection path.
- The same summarized payload is also written to `.artifacts/performance/runtime-performance-capture.json` after a complete 24-snapshot capture.
- The `browser-systems` workflow attempts to upload that exact file on every shard with `if-no-files-found: ignore`; only the shard that owns the performance spec produces the artifact, so sharding can change without hard-coding a shard number.
- Successful capture evidence is retained for 14 days under a shard-qualified artifact name. A failing run that reaches summary persistence can still publish its evidence because upload uses `if: always()`.
- Unit/source regression coverage guards both the file persistence and workflow upload contract.
- No runtime instrumentation cadence, simulation order, gameplay behavior, density, audio, traffic, police, or recent human-feedback contract changes in this checkpoint.

This is still a **measurement-only** increment. The next step is to consume the generated JSON from completed browser runs, repeat the same capture if necessary, and optimize only after a repeatable winner is demonstrated.

## Main sync checkpoint — 2026-08-19 17:41 Europe/Madrid

`main` advanced again after CI cleanup, so Performance Pass 6 remains gated behind a real synchronization checkpoint.

- Previously synchronized runtime authority: `c7bb5e433a59388eb8f996a4916af6a68286798b` (`POC: modular top-down character presentation (#62)`).
- New `main` authority: `b0bca65a20e3aa177f6d05f8165a51b2a7315583` (`CI: install hourly autonomous building visual polish agent`).
- The new default-branch commit adds only `.github/workflows/building-visual-polish-hourly.yml`, targeting the separate `agent/building-visual-poc` branch and issue #64. It does not change gameplay runtime, tests, density, PR #55 audio/combat/city policies, or the Performance Pass 6 harness.
- The workflow file is integrated unchanged from `main`; no conflict resolution or runtime adaptation is required.
- Performance work is intentionally not started in this same increment. The merged head must first re-establish the 0-behind invariant and pass the normal PR validation before a measurement-only Performance Pass 6 increment resumes.

## Previous main sync checkpoint — 2026-08-19

Before any further performance work, `main` was checked again because it advanced after the earlier synchronization checkpoint.

- Previous synchronized authority: `dcc0d6996a16ff5b20c2148fdbf57a55ba5f5b45` (`fix: avoid local Phaser 404 on hosted builds (#59)`).
- New `main` authority detected in this increment: `c7bb5e433a59388eb8f996a4916af6a68286798b` (`POC: modular top-down character presentation (#62)`).
- The new main commit adds the approved modular top-down player/NPC presentation, continuous upper-body mouse aim, faster unarmed/pipe cadence and world-bounded pistol range.
- `GameScene.js` and `NpcSystem.js` overlapped with active PR #55 work, so the sync is resolved explicitly rather than by replacing either side: modular character presentation is retained together with the PR's vehicle explosion presentation, death-recovery interaction, civilian panic path, streaming behavior and other current systems.
- The remaining files introduced or changed by #62 are taken directly from the new `main` authority.
- This sync changes no density target and does not start Performance Pass 6 optimization. CI/browser validation of the integrated head remains the gate before measured hotspot work resumes.

## Why this pass exists

The runtime already exposes bounded wall-time samples through `window.NBD_RUNTIME_DIAGNOSTICS.snapshot({ force: true })`, including `slowestSystems`, but the previous performance passes still relied on a human opening DevTools and copying an ad-hoc snapshot. That is not reproducible enough to choose the next optimization safely.

This pass adds a Playwright capture that exercises a normal settled street, forces a distant harbor streaming transition, then returns to the original street. Each phase settles before collecting eight forced diagnostics snapshots at 300 ms intervals. The 24-snapshot run therefore samples ordinary gameplay plus the streaming/materialization pressure most likely to expose a repeatable outer-pipeline winner without changing simulation order or adding production instrumentation.

## Capture output

`tests/browser/runtime-performance-capture.spec.js` prints one machine-readable line:

`NBD_PERF_CAPTURE=<json>`

The same JSON summary is persisted at:

`.artifacts/performance/runtime-performance-capture.json`

The payload contains:

- total browser sample count;
- outer top-system win count and share across all snapshots;
- outer per-system mean of the runtime-reported average wall time and peak recent maximum;
- outer per-phase winner, mean frame time and peak recent frame time;
- a parallel `core` object with the same winner/system/phase structure for `Core.*` child timings;
- a parallel `finalize` object with the same structure for `Finalize.*` child timings.

The test does **not** impose an FPS threshold and does not claim an FPS improvement. Its regression contract is observational: diagnostics must exist, all three phases must complete, at least four named outer systems, four internal core phases and four finalize substeps must have timing data, and all three rankings must produce a winner without page errors.

## Commands and CI

Run only the capture with:

`npm run test:browser:performance`

The same spec is included in `npm run test:browser:systems`, so PR CI records a real Chromium result instead of leaving performance selection to source inspection. The console still carries `NBD_PERF_CAPTURE`, while the browser-systems job also uploads the persisted JSON from whichever shard executes the spec.

## Decision rule for the next pass

Do not optimize from intuition. Use durable browser capture evidence and confirm that the top owner wins repeatedly across the 24 snapshots or across repeated CI/browser runs.

- If a concrete outer pipeline such as `TrafficPipeline`, `PedestrianSystem`, `StreamingPipeline`, `MotorizedPoliceSystem` or `TerritoryRuntimeSystem` is the stable winner, the next pass may optimize that owner only.
- If `GameplayRuntimeCore` wins consistently, require the `core` child ranking and identify a repeatable `Core.*` winner first; do not guess which child subsystem is responsible.
- If `Core.Finalize` wins consistently, require the `finalize` child ranking and identify a repeatable `Finalize.*` winner before any optimization.
- If any ranking is unstable, extend/repeat measurement before modifying gameplay behavior.

The finalize drill-down added here remains **measurement only**. The next code optimization is a separate increment so before/after evidence remains attributable.
