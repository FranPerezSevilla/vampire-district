# M16 · Reduce traffic CPU without losing physical interaction

## Goal

Implement the performance sequence approved after M15 and measure the same 600-car/six-bus workload before and after.

## In scope

- Authority: TrafficDriverRuntime remains the only civilian mover; shared VehicleModel integrates every materialized vehicle. TransitSystem retains bus schedules and passengers.
- Files: driver runtime/controller/world/junctions, route accounting and policy, materialization/lifecycle, native traffic helpers/tests and a reproducible native performance command; current architecture and progress documents.
- Reuse population records, maintain incremental accounting and make diagnostic publication lazy.
- Schedule distant unmaterialized civilian progress less frequently, with early promotion and hysteresis; retain full physical integration for buses, assigned vehicles and recovery.
- Reuse expensive clear-road predictions only while relevant obstacles are unchanged; retain immediate exact movement clearance.
- Cache immutable geometry and spatially filter collision candidates without changing body dimensions or movement ownership.

## Out of scope

Browser tests/playtests, automatic merge, population or bus-service reduction, generated road geometry, a second gameplay loop, speculative renderer/worker rewrites, or claiming every interactive jam is solved.

## Acceptance criteria

- Exactly 600 civilian identities plus six buses; broad circuits, avenue lanes and district coverage remain.
- Same shared physical controls near the player; new obstacles/impacts invalidate prediction immediately, with no visible pose reset on promotion.
- Distant service preserves schedules; occupied buses never enter coarse simulation.
- Diagnostic reads are detached and cannot corrupt runtime state. Incremental accounting matches independent projection through stage changes and hijacks.
- Existing native circulation, collision/reverse/reassessment, queue recovery, camera guards and passenger/theft regressions pass.
- Sequential before/after native measurements show savings; report actual means/p95 and limits, without claiming browser FPS or a guaranteed target.

## Validation and delivery

Run focused native correctness/performance regressions, check:fast and city validation; review affected plan and execute its non-browser portions. Publish a meaningful reviewed commit on draft PR 73, then observe CI/Pages with the repository's bounded checks. No browser execution by explicit user instruction.

## Implemented boundary

The four approved areas are implemented. Runtime tokens reuse pose/navigation storage; lane/stage changes update conservative macro accounting. Gameplay requests no implicit diagnostic snapshot. Materialization still validates retention and collision clearance each frame, but skips allocation when full and filters the catchment before sorting. Public snapshots, agent metadata, contact values and browser token reads are detached from mutable caches.

Unmaterialized civilians beyond the physical catchment advance their existing journey at staggered 2 Hz. Wake radius is 780 units and sleep radius 940 in this city. Assigned bodies, all buses, recovery/panic and finite routes stay physically integrated. Promotion completes accumulated distant time before local driving; camera, residency and body guards still decide appearance. No materialized body is moved by distant route sampling. Approximate unseen travel can change arrival times but cannot replace a driver's circuit or identity.

Clear predictions can be reused for 0.1 seconds only if obstacle membership/poses/dimensions remain unchanged, heading and movement remain close, and the car is outside junction approach, panic and recovery. Every committed movement still checks exact clearance. Dynamic obstacle cells preserve the former first-blocker order and update after each car moves. Static junction paths, body boxes and building geometry are cached with pose/dimension invalidation. Convex single-road containment is equivalent to the existing footprint; junction unions keep the original nine-point test.

## Measurement

Run the production traffic helper from Blackwater (2265,3280), with 600 cars and six buses, sequentially on the same runner. Baseline is M15 source `91dcf2392a21875b607b3ae1a191a760876fe6e9`. Node inspector samples at 1 ms over the final 60 seconds after ten seconds of warmup. Pipeline mean/p95 include all 70 simulated seconds. The helper's overlap assertions run outside pipeline timing. Rendering and file transport are substituted; this is not browser FPS, GPU time or full-game CPU.

| Workload | Mean per update | p95 per update | Setup |
| --- | ---: | ---: | ---: |
| M15, 20 Hz | 16.75 ms | 25.51 ms | 6.87 s |
| M16, 20 Hz | 6.64 ms | 9.59 ms | 6.94 s |
| M16, 60 Hz (additional workload) | 5.51 ms | 7.74 ms | 6.73 s |

The matched 20 Hz comparison saves **60.4% mean CPU / 62.4% p95**. The 60 Hz row has no before measurement and must not be treated as another percentage improvement. Both final profiles have zero contacts, overlaps and guarded-camera spawns. They are too short to establish long-stop recovery; the three-minute regression remains the gate.

At the end of the 20 Hz sample, 113 drivers use full integration and 493 are distant. Full driver updates fall from the baseline's 848,400 (606 × 1,400) to 142,683; distant progression adds 70,619 inexpensive updates. The dense scenario only reuses 524 clear predictions against 78,007 builds: moving neighbors still demand immediate decisions. The optimization does not obtain its savings by delaying queue reactions.

Reproduce with:

```bash
node tools/dev/profile-traffic.js --hz 20 --seconds 60 --warmup 10 --cpu /tmp/traffic-20.cpuprofile
node tools/dev/profile-traffic.js --hz 60 --seconds 60 --warmup 10 --cpu /tmp/traffic-60.cpuprofile
```

Avoid concurrent test/benchmark processes. Omitting `--cpu` disables sampling and writes only JSON metrics to stdout.

## Remaining limits

The proposed 2–3 ms traffic budget is not reached in the dense Blackwater case. Setup remains around seven seconds; a bootstrap grid experiment was removed after it failed to demonstrate a stable startup gain. Population, bootstrap itineraries and initial poses remain unchanged: the measured initial-agent SHA-256 is `5b680d25e016eb1d960c197bd0bbad15ae698cf4ceac60c7d16cb35ad4e0c64e` before and after. No generated geometry changed. Native circulation evidence does not establish that every interactive blockage is solved.

## Final validation

**903/903 native tests pass**, including the six new performance-boundary regressions. The body-cache audit compares fresh geometry through movement, rotation and size changes; road containment matches 4,440 complete rotated-bus footprints. Independent projection matches incremental accounting through movement and hijack. Camera promotion preserves identities and existing physical poses; the existing native service test retains all six buses and actual commuter walking over 300 seconds. Static ownership of 41 browser specs across eight suites passes. City validation reports zero errors/warnings and 87.9/A.

The three 180-second density scenarios keep all 606 identities, both avenue lanes and fourteen districts, with **567/574 eligible directed lanes** covered. They record zero contacts, overlaps, guarded-camera appearances or old unresolved queues. Longest stops are **20.65 s / 32.50 s / 7.05 s** in Old Quarter / Blackwater / North Harbor. No density or recovery threshold was relaxed.

The full gate initially found a source-text frame-order check that did not recognize the new diagnostics argument. It now checks the same physical-preflight-before-route ordering while accepting additional update arguments; the final complete gate is green. The native dynamic-index test explicitly excludes building queries to check dynamic membership/order, while production density and recovery tests retain real building clearance.
