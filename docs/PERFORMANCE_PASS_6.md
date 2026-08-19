# Performance Pass 6 — repeatable browser hotspot capture

_State: measurement harness implemented on PR #55; optimization intentionally deferred until the browser capture identifies a repeatable winner._

## Main sync checkpoint — 2026-08-19

A fresh `main` check was performed before any further performance work, as required by the post-playtest backlog.

- Current `main`: `dcc0d6996a16ff5b20c2148fdbf57a55ba5f5b45` (`fix: avoid local Phaser 404 on hosted builds (#59)`).
- Current feature merge base with `main`: the same `dcc0d6996a16ff5b20c2148fdbf57a55ba5f5b45`.
- `audio/playtest-p0` is therefore **0 commits behind `main`**. There is no newer `main` commit to merge or rebase in this checkpoint, so creating a synthetic no-op merge would add history without integrating content.
- The previously imported finalized ViceBlood splash/main-menu work and hosted Phaser loader fix remain present on the feature branch.
- This checkpoint intentionally changes no runtime behavior. The next allowed implementation step remains evidence-driven Performance Pass 6 capture/analysis after CI confirms this documentation head.

## Why this pass exists

The runtime already exposes bounded wall-time samples through `window.NBD_RUNTIME_DIAGNOSTICS.snapshot({ force: true })`, including `slowestSystems`, but the previous performance passes still relied on a human opening DevTools and copying an ad-hoc snapshot. That is not reproducible enough to choose the next optimization safely.

This pass adds a Playwright capture that exercises a normal settled street, forces a distant harbor streaming transition, then returns to the original street. Each phase settles before collecting eight forced diagnostics snapshots at 300 ms intervals. The 24-snapshot run therefore samples ordinary gameplay plus the streaming/materialization pressure most likely to expose a repeatable outer-pipeline winner without changing simulation order or adding production instrumentation.

## Capture output

`tests/browser/runtime-performance-capture.spec.js` prints one machine-readable line:

`NBD_PERF_CAPTURE=<json>`

The payload contains:

- total browser sample count;
- top-system win count and share across all snapshots;
- per-system mean of the runtime-reported average wall time and peak recent maximum;
- per-phase winner, mean frame time and peak recent frame time.

The test does **not** impose an FPS threshold and does not claim an FPS improvement. Its regression contract is observational: diagnostics must exist, all three phases must complete, at least four named systems must have timing data, and a ranked winner must be produced without page errors.

## Commands and CI

Run only the capture with:

`npm run test:browser:performance`

The same spec is included in `npm run test:browser:systems`, so PR CI records a real Chromium result instead of leaving performance selection to source inspection. The browser-systems log is the evidence source for the `NBD_PERF_CAPTURE` line.

## Decision rule for the next pass

Do not optimize from intuition. Use the first completed browser capture and confirm that the top system wins repeatedly across the 24 snapshots or across repeated CI/browser runs.

- If a concrete outer pipeline such as `TrafficPipeline`, `PedestrianSystem`, `StreamingPipeline`, `MotorizedPoliceSystem` or `TerritoryRuntimeSystem` is the stable winner, the next pass may optimize that owner only.
- If `GameplayRuntimeCore` wins consistently, instrument that core loop internally first; do not guess which child subsystem is responsible.
- If rankings are unstable, extend/repeat measurement before modifying gameplay behavior.

This pass deliberately contains **measurement only**. The next code optimization is a separate increment so before/after evidence remains attributable.