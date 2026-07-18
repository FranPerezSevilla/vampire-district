# Milestone 10 — Consolidation, browser smoke tests and performance

The playable build now uses one directly composed runtime instead of the previous import-order patch stack.

Start with:

- [`docs/MILESTONE_10_STATUS.md`](docs/MILESTONE_10_STATUS.md)
- [`docs/RUNTIME_CONSOLIDATION.md`](docs/RUNTIME_CONSOLIDATION.md)
- [`docs/MILESTONE_10_REGRESSION.md`](docs/MILESTONE_10_REGRESSION.md)

Current status: **core implementation complete; CI confirmation and complete browser/mission regression pending**.

Primary changes:

- `GameScene.update()` delegates to one `GameplayRuntime`.
- Narrative tutorial, task reveals, objective arrow, district outskirts, sensory awareness and police-violence escalation are first-class systems.
- Runtime owner conflicts fail immediately through `RuntimeDiagnostics`.
- `SpatialHash`, camera culling and change-aware registry/DOM publication reduce repeated work.
- Keyboard binding persistence/conflict helpers provide remapping groundwork.
- Playwright Chromium smoke tests cover both playable routes.
- GitHub Actions runs unit tests and browser smoke tests.
