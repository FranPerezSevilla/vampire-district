# Performance Pass 6 — repeatable browser hotspot capture

_State: measurement harness implemented on PR #55; optimization intentionally deferred until the browser capture identifies a repeatable winner._

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
- top-system win count and share across all snapshots;
- per-system mean of the runtime-reported average wall time and peak recent maximum;
- per-phase winner, mean frame time and peak recent frame time.

The test does **not** impose an FPS threshold and does not claim an FPS improvement. Its regression contract is observational: diagnostics must exist, all three phases must complete, at least four named systems must have timing data, and a ranked winner must be produced without page errors.

## Commands and CI

Run only the capture with:

`npm run test:browser:performance`

The same spec is included in `npm run test:browser:systems`, so PR CI records a real Chromium result instead of leaving performance selection to source inspection. The console still carries `NBD_PERF_CAPTURE`, while the browser-systems job now also uploads the persisted JSON from whichever shard executes the spec.

## Decision rule for the next pass

Do not optimize from intuition. Use the first completed browser capture and confirm that the top system wins repeatedly across the 24 snapshots or across repeated CI/browser runs.

- If a concrete outer pipeline such as `TrafficPipeline`, `PedestrianSystem`, `StreamingPipeline`, `MotorizedPoliceSystem` or `TerritoryRuntimeSystem` is the stable winner, the next pass may optimize that owner only.
- If `GameplayRuntimeCore` wins consistently, instrument that core loop internally first; do not guess which child subsystem is responsible.
- If rankings are unstable, extend/repeat measurement before modifying gameplay behavior.

This pass deliberately contains **measurement only**. The next code optimization is a separate increment so before/after evidence remains attributable.