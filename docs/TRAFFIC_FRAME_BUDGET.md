# Traffic frame budget

## Goal
Reduce traffic CPU time in the full moving-camera game toward the 16.7 ms frame budget, without changing texture quality or resolution.

## In scope
- Authority: TrafficDriverRuntime remains the sole physical driver; VehicleModel integrates every frame.
- Files: TrafficDriverRuntime.js, a TrafficDriverPrediction.js helper, TrafficLocalBehaviorSystem.js, TrafficPhysicalConsequencesSystem.js, focused traffic regressions.
- Reuse short-lived prediction geometry, checking current obstacles every frame. Avoid obsolete lane planning for bodies already owned by the physical driver.
- TrafficJunctionReservationPolicy: when every materialized body has a physical driver, retire its legacy lane reservations without projecting those same cars again. Mixed/legacy traffic retains the original policy. Physical crossing permits remain owned by TrafficDriverJunctions; test transitions between the two modes.
- TrafficDriverWorld neighbour cache: invalidate only regions touching a changed spatial cell, preserving exact live filtering and source order. Validate against exhaustive membership through movement, addition, removal and reordering.
- Bounded recovery search (TrafficDriverController/Runtime): split manoeuvre search across existing frame updates, with at most one search active and a 0.5–2 ms/512-probe slice (1.25 ms at 60 Hz). The time quota is checked between probes; a single probe/reservation or garbage collection can exceed it. Brake while waiting; cancel on changed ownership, contact, route, blocker, pose or body. Candidate checks use current obstacles and every actual move retains its collision gate. Keep synchronous planning helpers for direct callers and compare both search results on a static scene. After 4096 probes at a 50 ms integration step (scaled by integration rate), try a bounded reverse rather than leave the car waiting on an expensive bypass. If reversing is blocked, resume the existing bypass frontier. The existing cumulative reverse cap is preserved.
- Follow-up authority: EntityStreamSystem and NpcSystem presentation. Repeated zero-time eligibility checks must retain immediate alert/chunk changes, without reapplying unchanged state. Animate only rendered character views. No AI frequency reduction.
- GameplayRuntime composition batches redundant NPC spatial rebuild requests within its existing synchronous update. NpcSystem flushes before spatial queries, visibility refresh and frame exit (also on exceptions). Calls outside a batch retain eager behaviour. Tests cover moved/added/removed bodies and nested batches.
- Renderer composition: main.js requests the browser's high-performance GPU preference (a hint only). Retain full resolution and linear texture filtering; disable the additional WebGL multisample framebuffer after an on/off/off/on benchmark and screenshot comparison. Inspect the actual WebGL renderer in measurements.

## Out of scope
Population reductions, lower texture resolution, lower render resolution, changed city geometry, another update loop, save changes, publication.

## Acceptance
- Current obstacles and road clearance are checked on every committed physical step.
- Prediction geometry expires and invalidates on sharp turns, impacts, route changes, speed changes, and obstacle membership changes.
- Stops, intersections, recovery, buses, impacts, and materialization retain their authority and pass focused checks.
- Same viewport and movement benchmark before/after; report measured FPS, not an assumed 60 FPS result.

## Validation / delivery
Focused native traffic tests; affected plan and execution; production build and local browser measurement. Remain local; no push requested.

## Results so far (2026-09-18)
- Prediction caches hold relative proposed geometry for at most 100 ms, with a <8 world-unit translation, <0.01 rad heading and <8 speed-change guard. Obstacle membership/route/body changes invalidate it; current obstacle poses and road boundaries are queried every time. Clearing an old blocker cannot treat the unexamined path as clear. Physical integration/contact rejection remains per frame.
- Legacy lane planning returns the physical driver's published result for driver-owned slots, preserving feedback decorators and impact handling. Fallback traffic retains its old planner.
- Contact broad phase rejects definitely distant pairs before constructing validated oriented boxes. Character presentation skips invisible/dormant views, resuming at current absolute animation time.
- 45 focused traffic/streaming/transit checks passed; subsequent spatial-batch/navigation/audio run passed 24 checks (overlap between these sets; do not add the totals).
- Full native suite was executed directly after the affected runner failed to spawn npm on Windows: 1,244 tests, 1,201 passed, 43 failed. This is NOT a passing global suite. Failures include old city-count/layout assertions, campaign/preload fixtures, retired-label assertions, UI fixtures, and an alarmed-pedestrian scenario. Full log: work-performance-unit-suite.log. The 600-car density/recovery scenario passed, as did traffic prediction/recovery/bus coverage. Spatial batching was subsequently covered separately.
- Initial post-change six-second Vesper movement sample: 27.40 ms mean (36.5 FPS), p95 34.4 ms. Traffic routes 7.15 ms; obsolete behavior 1.41 ms. Further sample after broad phase/zero-time refresh/hidden animation changes: 27.97 ms mean, p95 45.6 ms, maximum 92.3 ms; route 7.16 ms, physical contacts 0.62 ms (previous 1.16), render 6.78 ms/frame. These are evolving fresh sessions, not deterministic speedup guarantees.
- Actual renderer remains Intel HD 530/D3D11 despite the high-performance preference; framebuffer is 2160x1440. No resolution, texture filtering, mesh, or density change has been applied. Sustained 60 FPS throughout the city is not established.
- Four unprofiled six-second Vesper camera-motion trials, fresh sessions, MSAA on/off/off/on: 38.5 / 47.0 / 43.9 / 36.9 FPS. Off trials had zero frames above 50 ms (max 25.8 / 34.9 ms). Hospital screenshots at identical resolution retained texture detail; no visible edge degradation at displayed size. This removes additional multisampling, not linear texture sampling or render resolution. Final multi-location movement validation follows.
- Subsequent moving-player samples (8 seconds/location, no profiler, 1400x850 viewport, .9 zoom, framebuffer unchanged) reached 49–52 FPS from Vesper, 60 FPS at the hospital, and 53 FPS on the route east from the police station. These are route samples, not fixed-building averages: the player travels about 440 / 228 / 1350 world units respectively, with hospital movement eventually blocked by geometry.
- The police route exposed a 309.8 ms frame, 298.9 ms inside traffic drivers. This motivated slicing recovery searches rather than claiming the average FPS fixed the hitches.
- Post-slicing native validation: 24 checks passed, including the 600-car population/queue scenarios (three simulated 180-second district runs), shared kinematics, 20/60 Hz recovery, pending-search cancellation, spatial cache membership, and bus service. No overlaps, visible spawns or unresolved long stops in those density fixtures. Log: work-performance-recovery-checks.log. City validation passed (0 errors/warnings); canonical browser suite coverage passed. The earlier full-suite failures remain unresolved; this is not a globally green branch.

## Final local movement sample

Same eight-second routes, with the recovery work slices enabled. Fresh production session; Intel HD 530; 2160x1440 framebuffer; normal traffic and drawing; no CPU profiler. Three locations share the session, so traffic evolves between samples. The hospital route hits a building partway through; these are short samples, not a whole-game 60 FPS guarantee.

| Route starts at | Mean FPS | p95 frame | Worst frame | Frames >50 ms |
| --- | ---: | ---: | ---: | ---: |
| Vesper | 52.8 | 24.5 ms | 52.0 ms | 1/422 |
| Hospital | 60.0 | 17.8 ms | 18.4 ms | 0/479 |
| Police station, travelling east | 53.4 | 23.7 ms | 120.5 ms | 8/427 |

On the police route, driver update maximum was 10.4 ms, with 52 recovery slices, 5 completed searches and 3 cancellations. The pre-slicing sample reached 298.9 ms in that update. Sessions are not deterministic replays, but the new search is explicitly bounded and its correctness/slicing tests passed. A remaining 94 ms simulation spike (120.5 ms whole frame) came from work outside the traffic-driver update and still needs isolation. No browser page errors in these three samples.

Runtime build and whitespace checks passed. Preview rebuilt at http://127.0.0.1:4174/. No commit or publication. Measurement: work-performance-movement-final.json. The broad affected run stopped on the unit failures; the entire selected browser regression suite has not been executed. Custom browser movement/visual checks are not a substitute for a passing full suite.

VehicleView inspection also found roughly 25–40 independently rendered shapes per car. Baking or batching those shapes needs to preserve live damage/hood/wheel changes and zoom quality; no vehicle-rasterization change is included in this delivery.
