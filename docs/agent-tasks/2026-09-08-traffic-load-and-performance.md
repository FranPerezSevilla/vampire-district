# M15 · Lower traffic load and measure performance

## Goal

Apply the approved reduction to 600 civilian cars and identify the highest-value performance work from native measurements.

## In scope

- Population authority: TrafficPopulationPolicy, with the existing road/district circuit allocator.
- Files: the population constant, existing density assertions, current technical architecture and traffic progress/status documents.
- Measure the production traffic pipeline and CPU profile with rendering/file transport substituted, before and after the population change.
- Inspect driver, materialization, junction and accounting costs to propose a concrete performance plan.

## Out of scope

- Browser tests/playtests, merging PR 73, new gameplay/input/persistence owners, generated geometry, removing bus service, unmeasured rewrites or a claim that all interactive traffic blockages are solved.

## Acceptance criteria

- Exactly 600 civilian identities plus the existing six service buses.
- Both avenue lanes, broad circuits and all fourteen districts remain represented.
- Existing three-minute density/flow and physical recovery tests remain meaningful and pass.
- Report measured traffic CPU costs separately from full browser frame rate and distinguish the proposed simulation changes from implemented work.
- Publish on the existing PR and Pages branch after native validation.

## Validation

Run check:fast, review the cumulative affected plan, execute its non-browser checks, and compare the same native viewpoint before/after. No browser execution by explicit user instruction.

## Native CPU measurement

Compare M14 source `261d227da0456b83504d096b83aed621e65913ca` against the same source with `CITY_TRAFFIC_POPULATION = 600`. Use `createTrafficDensityRuntime({ center: { x: 2265, y: 3280 }, transit: true })`, run 200 warmup steps and then 1,200 steps with Node inspector CPU sampling at 1,000 microseconds. Each step advances 0.05 simulated seconds. Runs were sequential on the same runner, with no simultaneous test suite.

| Metric | 1,000 cars + 6 buses | 600 cars + 6 buses |
| --- | ---: | ---: |
| Setup | 11,085 ms | 7,603 ms |
| Traffic pipeline mean | 24.67 ms | 17.29 ms |
| Traffic pipeline p95 | 35.83 ms | 25.96 ms |
| Visible cars/buses, mean after warmup | 28.33 | 24.98 |
| Materialized vehicles, mean after warmup | 64.00 | 60.37 |
| Body overlaps / traffic contacts / guarded-camera spawns | 0 / 0 / 0 | 0 / 0 / 0 |

Mean cost falls 29.9% and p95 27.5%. The timing helper includes all 1,400 pipeline updates in the mean/p95; CPU sampling covers only the final 1,200. The helper's additional overlap assertions happen outside the pipeline timer but are present in the CPU profile. Setup includes population allocation, topology and file parsing. Rendering and file transport are substituted; this does not measure complete gameplay, browser FPS, GPU time or commuter walking. One paired run establishes direction and likely hotspots, not a hardware-independent performance guarantee. The 70-second sample alone is too short to establish long-stop recovery; the separate 180-second regressions remain the gate.

At 600 cars, sampled inclusive stacks spend approximately 53.5% in `TrafficDriverRuntime.step`, 15.3% in `token`, 12.1% in runtime `snapshot`, and 12.0% in junction `prepare`; garbage collection accounts for 4.6%. These percentages overlap and must not be added. The helper's direct pairwise overlap assertion accounts for 2.4% of samples. Evidence in the production source explains actionable costs:

- Every non-hijacked global driver computes steering, shared vehicle kinematics and route projection on every runtime update, even without a local proxy. The 0.05-second cap is a maximum integration interval, not a fixed 20 Hz scheduler.
- Materialization rebuilds all tokens and sorts candidates on every reconciliation, including when the local pool is already full. Its snapshot builds all tokens again just to obtain a count. Publication constructs the snapshot before checking whether its membership key changed.
- Route update returns a full snapshot; global route records and macro projection are rebuilt each tick. Several readers request diagnostics through the frame pipeline.
- Active drivers predict their physical path repeatedly; junction permits compare sampled body paths, while obstacle queries rebuild candidate collections. These require optimization that preserves contact and right-of-way decisions.

## Proposed performance sequence (not implemented in M15)

1. Remove repeated bookkeeping first: stable token storage, a cheap population count, incremental lane/district totals and lazy diagnostic snapshots. Reconcile spatial candidates on membership/region changes or a bounded cadence, retaining immediate collision/hijack/visibility invalidation. Do not expose mutable cached diagnostic records as immutable snapshots. Verify identical identities, poses and admission decisions against the current deterministic runtime.
2. Introduce distance-dependent scheduling inside the existing driver authority. Nearby cars, occupied buses and interacting vehicles retain full physical integration and immediate reactions. Distant cars retain their route, identity and schedule, with coarse route progress or event updates as a candidate design; benchmark an initial 1–2 Hz distant tier. Promotion must happen outside the guarded camera with hysteresis, whole-body clearance, valid route progress and no visible position reset. Waiting buses and passenger transfers must preserve their existing service rules. This needs its own continuity and conservation acceptance boundary.
3. Separate expensive decisions from physical integration: benchmark 5–10 Hz path prediction for clear-road drivers, with immediate re-evaluation for contact, a new obstacle, junction entry and recovery. Keep the existing bounded fair manoeuvre budget; cache static junction geometry and add dynamic spatial candidate filtering before exact body tests.
4. Reduce startup cost separately by sharing immutable route-search results/candidate data while keeping per-driver state and reservations independent. Profile setup before selecting further caching or precomputation.

Use the same viewpoints, seeded encounters and bus service cases to compare CPU time, allocation pressure and queue outcomes. A proposed budget is **2–3 ms of traffic CPU per gameplay frame** on an explicitly chosen reference machine, with a separate tail-latency limit; this is a target, not achieved or guaranteed. Full-game rendering and frame-rate claims remain unmeasured while browser testing is excluded. Merely moving expensive work to a worker would not remove its CPU cost.

## Validation result and limits

All **897 native tests pass**, including 300-second six-bus service and real commuter walking, passenger/theft interaction boundaries, physical recovery at 20/60 Hz and the three 180-second density viewpoints. Static suite ownership passes for 41 specs across eight suites; no browser tests ran. City validation reports zero errors/warnings and 87.9/A; generated geometry is unchanged.

The 600-car circuits retain **567/574 eligible directed lanes**, both avenue lanes in both directions and all fourteen districts; district share error is 0.04748. All three density fixtures have zero contacts, body overlaps, camera-guarded appearances and old unresolved queues. These are the existing contact/conservation/recovery gates; only the civilian count and expected visible-density lower bounds changed.

The longest stops are **25.45 s in Old Quarter, 35.70 s in Blackwater and 7.05 s in North Harbor**. Blackwater's 180-second visible mean is 29.01, despite the smaller global population. Reducing population is not a monotonic guarantee of lower local density or shorter waits: deterministic route allocation changes the cohort, and local queues still concentrate it. The prior user-reported interactive blockages remain a limitation, not a resolved claim.
