# Performance Pass 5 — interaction selection hot path

_State: implemented on PR #55; browser frame-time impact still requires in-game observation._

## Confirmed repeated cost

`GameplayRuntimeCore` asks for the nearest movement and interaction options before simulation and again after simulation. Before this pass, every nearest lookup called `InteractionSystem.sortOptions()`, which cloned and fully sorted the candidate array even though the caller only consumed element zero. A normal active frame therefore performed at least four unnecessary full sorts and four candidate-array clones; traversal input could perform an additional redundant selection.

At 60 FPS, that baseline is at least 240 full sorts plus 240 candidate-array clones per second, or 14,400 of each per minute, before counting extra input-driven lookups. The exact wall-time cost depends on candidate count, so this pass does not claim an FPS increase from static analysis alone.

## Change

- `InteractionSystem.bestOption()` uses a zero-clone linear scan for ordinary interactions, preserving priority, distance and stable-id tie breaking.
- `GameplayRuntimeCore` uses `bestOption()` for nearest-only queries. `sortOptions()` remains the authority when a real ordered interaction menu is needed.
- Traversal candidate selection moves from `map -> filter -> sort` to one deterministic pass. This removes the temporary mapped/filter arrays and wrapper objects while preserving traversal score and stable-id tie breaking.
- A traversal press reuses `scene.nearestMovement` already calculated for the frame instead of selecting the same option again.
- Runtime diagnostics now claim both `InteractionSystem.sortOptions` and `InteractionSystem.bestOption` ownership so the optimized path remains explicit.

## Complexity and allocation result

For nearest-only ordinary interaction selection, the hot path changes from O(n log n) plus one full-array clone to O(n) with no candidate-array clone. Traversal selection changes from three array passes plus sort and wrapper allocation to a single candidate pass (candidate evaluation objects remain unchanged).

## Regression coverage

`tests/interaction-selection-performance.test.js` checks that:

- ordinary selection returns the same winner as the fully sorted menu path without mutating the source array;
- traversal selection preserves deterministic tie breaking and no longer uses map/filter/sort internally;
- `GameplayRuntimeCore` routes nearest-only queries through `bestOption()` and reuses the already selected traversal option.

## Browser validation

Use the existing `RuntimeDiagnostics.slowestSystems` and frame-time telemetry in a stutter-prone street area. Compare sustained frame time and GC spikes with interaction-heavy locations versus open road. This optimization is retained because it removes a deterministic repeated hot-path cost even if another system remains the dominant browser bottleneck.
